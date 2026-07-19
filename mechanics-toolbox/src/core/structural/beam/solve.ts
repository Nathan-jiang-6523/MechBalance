import {
  createStructuralIssue,
  validateStructuralModelBoundary,
  type BeamModel2D,
  type StructuralIssue,
} from '../contracts'
import {
  beamFreeDofEquilibriumChecks,
  beamGlobalBalanceChecks,
  strainEnergyCheck,
  type LinearSystemCheck,
} from '../checks'
import type { Matrix } from '../math'
import {
  assembleDenseSystem,
  partitionZeroConstraints,
  recoverReactions,
  solveEquilibratedStiffnessSystem,
  StructuralSolverError,
} from '../solver'
import { createGlobalDofMap, elementDofIndices } from './dof'
import { beamLocalStiffness, type BeamMatrix6, type BeamVector6 } from './element'
import {
  recoverBeamElementOnNodeEndForces,
  recoverBeamResistingVector,
} from './end-forces'
import { beamUniformLoadVector } from './load-vector'

export interface BeamNodeSolution {
  readonly nodeId: string
  readonly u: number
  readonly v: number
  readonly theta: number
  readonly reactionFx: number
  readonly reactionFy: number
  readonly reactionMz: number
}

export interface BeamElementSolution {
  readonly elementId: string
  readonly length: number
  readonly dofIndices: readonly number[]
  readonly consistentLoad: BeamVector6
  readonly resistingVector: BeamVector6
  readonly elementOnNodeEndForces: BeamVector6
}

export interface BeamFiniteElementSolution {
  readonly displacements: readonly number[]
  readonly appliedLoads: readonly number[]
  readonly stiffness: Matrix
  readonly freeDofs: readonly number[]
  readonly constrainedDofs: readonly number[]
  readonly nodes: readonly BeamNodeSolution[]
  readonly elements: readonly BeamElementSolution[]
  readonly checks: readonly LinearSystemCheck[]
}

export type BeamFiniteElementSolveResult =
  | Readonly<{ ok: true; value: BeamFiniteElementSolution }>
  | Readonly<{ ok: false; issues: readonly StructuralIssue[] }>

interface ResolvedBeamProperties {
  readonly E: number
  readonly A: number
  readonly I: number
}

function resolveProperties(model: BeamModel2D): ResolvedBeamProperties | undefined {
  const source = model.uniformProperties
  if (source.source === 'inline') return { E: source.E, A: source.A, I: source.I }
  const material = model.materials.find(({ id }) => id === source.materialId)
  const section = model.sections.find(({ id }) => id === source.sectionId)
  if (!material || !section || section.I === undefined) return undefined
  return { E: material.E, A: section.A, I: section.I }
}

function validateNumericInputs(model: BeamModel2D, properties: ResolvedBeamProperties | undefined): StructuralIssue[] {
  const issues: StructuralIssue[] = []
  if (properties) {
    for (const [field, value] of Object.entries(properties)) {
      if (!Number.isFinite(value)) {
        issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `${field} 非法值 ${String(value)}：必须为有限数`, {
          field: `elements[0].${field}`,
        }))
      } else if (value <= 0) {
        issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `${field} 非法值 ${String(value)}：必须大于零`, {
          field: `elements[0].${field}`,
        }))
      }
    }
  }
  for (const [index, node] of model.nodes.entries()) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `节点 ${node.id} 坐标必须为有限数`, {
        field: `nodes[${index}]`,
        nodeId: node.id,
      }))
    }
  }
  for (const [index, load] of model.loads.entries()) {
    const values = load.type === 'nodal'
      ? [load.fx, load.fy, load.mz].filter((value): value is number => value !== undefined)
      : [load.qY]
    if (values.some((value) => !Number.isFinite(value))) {
      issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `荷载 ${load.id} 必须为有限数`, {
        field: `loads[${index}]`,
        objectId: load.id,
      }))
    }
  }
  return issues
}

function solverIssue(error: unknown): StructuralIssue {
  if (error instanceof StructuralSolverError) {
    if (error.code === 'P2_SINGULAR_STIFFNESS' || error.code === 'P2_NO_CONSTRAINTS') {
      return createStructuralIssue(
        'P2_SINGULAR_STIFFNESS',
        '整体刚度矩阵奇异：存在刚体位移或约束不足',
        { field: 'constraints' },
      )
    }
    if (error.code === 'P2_ILL_CONDITIONED_STIFFNESS') {
      return createStructuralIssue(error.code, `整体刚度矩阵病态：${error.message}`, { field: 'constraints' })
    }
    return createStructuralIssue('P2_SINGULAR_STIFFNESS', error.message, { field: 'constraints' })
  }
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('水平 1D 梁单元')) {
    return createStructuralIssue('P2_FEATURE_NOT_INCLUDED', message, { field: 'elements' })
  }
  return createStructuralIssue('P2_NONFINITE_INPUT', message, { field: 'model' })
}

function toVector6(values: readonly number[]): BeamVector6 {
  if (values.length !== 6) throw new RangeError('梁单元向量必须含 6 个分量')
  return values as BeamVector6
}

export function solveBeamFiniteElement(model: BeamModel2D): BeamFiniteElementSolveResult {
  const properties = resolveProperties(model)
  const issues = [
    ...validateNumericInputs(model, properties),
    ...validateStructuralModelBoundary(model),
  ]
  if (issues.length > 0) return { ok: false, issues }
  if (!properties) {
    return {
      ok: false,
      issues: [createStructuralIssue('P2_REFERENCE_NOT_FOUND', '梁材料或截面引用不存在', {
        field: 'uniformProperties',
      })],
    }
  }

  try {
    const nodeById = new Map(model.nodes.map((node) => [node.id, node] as const))
    const globalDofs = createGlobalDofMap(model.nodes.map(({ id }) => id), 3)
    const elementData = model.elements.map((element, index) => {
      const nodeI = nodeById.get(element.nodeI)!
      const nodeJ = nodeById.get(element.nodeJ)!
      if (nodeI.y !== nodeJ.y || nodeJ.x <= nodeI.x) {
        throw new RangeError(`elements[${index}] 必须按全局 +x 定义水平 1D 梁单元`)
      }
      const length = nodeJ.x - nodeI.x
      const stiffness = beamLocalStiffness({ ...properties, L: length })
      const consistentLoad = [0, 0, 0, 0, 0, 0]
      for (const load of model.loads) {
        if (load.type !== 'beam-uniform' || load.elementId !== element.id) continue
        const vector = beamUniformLoadVector(load.qY, length)
        vector.forEach((value, dof) => { consistentLoad[dof] = consistentLoad[dof]! + value })
      }
      return {
        element,
        length,
        stiffness,
        consistentLoad: toVector6(consistentLoad),
        dofIndices: elementDofIndices(element.nodeI, element.nodeJ, globalDofs),
      }
    })
    const totalDofs = model.nodes.length * 3
    const assembled = assembleDenseSystem(
      elementData.map(({ stiffness, consistentLoad, dofIndices }) => ({
        stiffness,
        load: consistentLoad,
        dofIndices,
      })),
      totalDofs,
    )
    const appliedLoads = [...assembled.load]
    for (const load of model.loads) {
      if (load.type !== 'nodal') continue
      const dofs = globalDofs.get(load.nodeId)!
      appliedLoads[dofs[0]!]! += load.fx ?? 0
      appliedLoads[dofs[1]!]! += load.fy ?? 0
      appliedLoads[dofs[2]!]! += load.mz ?? 0
    }
    const constrainedIndices = model.constraints.map(({ nodeId, dof }) => {
      const dofs = globalDofs.get(nodeId)!
      return dofs[dof === 'u' ? 0 : dof === 'v' ? 1 : 2]!
    })
    const partition = partitionZeroConstraints(totalDofs, constrainedIndices)
    const reducedStiffness = partition.freeDofs.map((row) =>
      partition.freeDofs.map((column) => assembled.stiffness[row]![column]!),
    )
    const reducedLoad = partition.freeDofs.map((dof) => appliedLoads[dof]!)
    const linear = solveEquilibratedStiffnessSystem(reducedStiffness, reducedLoad)
    const displacements = Array<number>(totalDofs).fill(0)
    partition.freeDofs.forEach((dof, index) => { displacements[dof] = linear.solution[index]! })
    const recoveredReactions = recoverReactions(
      assembled.stiffness,
      displacements,
      appliedLoads,
      partition.constrainedDofs,
    )
    const constrainedSet = new Set(partition.constrainedDofs)
    const reactions = recoveredReactions.full.map((value, dof) => constrainedSet.has(dof) ? value : 0)
    const elements = elementData.map(({ element, length, stiffness, consistentLoad, dofIndices }) => {
      const localDisplacements = toVector6(dofIndices.map((dof) => displacements[dof]!))
      return {
        elementId: element.id,
        length,
        dofIndices,
        consistentLoad,
        resistingVector: recoverBeamResistingVector(stiffness as BeamMatrix6, localDisplacements, consistentLoad),
        elementOnNodeEndForces: recoverBeamElementOnNodeEndForces(stiffness as BeamMatrix6, localDisplacements, consistentLoad),
      }
    })
    const nodes = model.nodes.map(({ id }) => {
      const dofs = globalDofs.get(id)!
      return {
        nodeId: id,
        u: displacements[dofs[0]!]!,
        v: displacements[dofs[1]!]!,
        theta: displacements[dofs[2]!]!,
        reactionFx: reactions[dofs[0]!]!,
        reactionFy: reactions[dofs[1]!]!,
        reactionMz: reactions[dofs[2]!]!,
      }
    })
    const forceTolerance = 1e-6
    const momentTolerance = 1e-6
    const generalizedWorkScale = appliedLoads.reduce(
      (sum, load, dof) => sum + Math.abs(load * displacements[dof]!),
      0,
    )
    const energyTolerance = Math.max(1e-9, generalizedWorkScale * 1e-9)
    const checks = [
      ...beamFreeDofEquilibriumChecks(
        assembled.stiffness,
        displacements,
        appliedLoads,
        partition.freeDofs,
        forceTolerance,
        momentTolerance,
      ),
      ...beamGlobalBalanceChecks(
        appliedLoads,
        reactions,
        model.nodes,
        forceTolerance,
        momentTolerance,
      ),
      strainEnergyCheck(assembled.stiffness, displacements, appliedLoads, energyTolerance),
    ]
    if (checks.some(({ passed }) => !passed)) {
      return {
        ok: false,
        issues: [createStructuralIssue(
          'P2_ILL_CONDITIONED_STIFFNESS',
          '梁求解平衡或能量残差超过容差',
          { field: 'checks' },
        )],
      }
    }
    return {
      ok: true,
      value: {
        displacements,
        appliedLoads,
        stiffness: assembled.stiffness,
        freeDofs: partition.freeDofs,
        constrainedDofs: partition.constrainedDofs,
        nodes,
        elements,
        checks,
      },
    }
  } catch (error) {
    return { ok: false, issues: [solverIssue(error)] }
  }
}
