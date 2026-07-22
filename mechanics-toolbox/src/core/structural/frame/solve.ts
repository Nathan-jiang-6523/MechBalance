import {
  createStructuralIssue,
  type ElementEndForceResult,
  type FrameModel2D,
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
  createGlobalDofMap,
  elementDofIndices,
  partitionZeroConstraints,
  recoverReactions,
  solveEquilibratedStiffnessSystem,
  StructuralSolverError,
} from '../solver'
import { frameLocalStiffness, type FrameVector6 } from './element'
import { frameRecoveredNodeEquilibriumChecks } from './checks'
import {
  createFrameEndForceResult,
  recoverFrameElementOnNodeEndForces,
  recoverFrameResistingVector,
} from './end-forces'
import type { FrameDistributedLoadSegment } from './field'
import { frameInitialStrainLoadVector } from './initial-strain'
import { frameDistributedLoadVector } from './load-vector'
import {
  frameGeometry,
  frameGlobalStiffness,
  frameTransformationMatrix,
  globalToLocalVector,
  localToGlobalVector,
} from './transform'
import { resolveFrameProperties, validateFrameModel, type FrameResolvedProperties } from './validation'

export interface FrameNodeSolution {
  readonly nodeId: string
  readonly u: number
  readonly v: number
  readonly theta: number
  readonly reactionFx: number
  readonly reactionFy: number
  readonly reactionMz: number
}

export interface FrameElementSolution {
  readonly elementId: string
  readonly nodeI: string
  readonly nodeJ: string
  readonly properties: FrameResolvedProperties
  readonly length: number
  readonly cosine: number
  readonly sine: number
  readonly freeStrain: number
  readonly distributedLoads: readonly FrameDistributedLoadSegment[]
  readonly equivalentDistributedLoad: FrameVector6
  readonly equivalentInitialStrainLoad: FrameVector6
  readonly consistentLoad: FrameVector6
  readonly localDisplacements: FrameVector6
  /** Conventional member resisting actions k*d-f. */
  readonly localResistingForces: FrameVector6
  /** Actions exerted by element on nodes f-k*d; opposite of localResistingForces. */
  readonly localEndForces: FrameVector6
  /** Same element-on-node actions resolved in global axes. */
  readonly globalEndForces: FrameVector6
  /** Structured local-axis element-on-node result. */
  readonly localEndForceResult: ElementEndForceResult
  /** Structured global-axis element-on-node result. */
  readonly globalEndForceResult: ElementEndForceResult
  /** Backward-compatible alias of localEndForceResult. */
  readonly endForces: ElementEndForceResult
  readonly dofIndices: readonly number[]
}

export interface FrameFiniteElementSolution {
  readonly displacements: readonly number[]
  readonly appliedLoads: readonly number[]
  readonly stiffness: Matrix
  readonly freeDofs: readonly number[]
  readonly constrainedDofs: readonly number[]
  readonly nodes: readonly FrameNodeSolution[]
  readonly elements: readonly FrameElementSolution[]
  readonly checks: readonly LinearSystemCheck[]
}

export type FrameFiniteElementSolveResult =
  | Readonly<{ ok: true; value: FrameFiniteElementSolution }>
  | Readonly<{ ok: false; issues: readonly StructuralIssue[] }>

function addVector(target: number[], source: readonly number[]): void {
  source.forEach((value, index) => { target[index] = target[index]! + value })
}

function toVector6(values: readonly number[]): FrameVector6 {
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
    throw new RangeError('刚架单元向量必须含 6 个有限分量')
  }
  return values as unknown as FrameVector6
}

function solverIssue(error: unknown): StructuralIssue {
  if (error instanceof StructuralSolverError) {
    if (error.code === 'P2_ILL_CONDITIONED_STIFFNESS') {
      return createStructuralIssue(
        error.code,
        `框架整体刚度矩阵病态：${error.message}`,
        { field: 'constraints' },
      )
    }
    return createStructuralIssue(
      'P2_SINGULAR_STIFFNESS',
      '框架整体刚度矩阵奇异：约束不足',
      { field: 'constraints' },
    )
  }
  return createStructuralIssue(
    'P2_NONFINITE_INPUT',
    error instanceof Error ? error.message : String(error),
    { field: 'model' },
  )
}

export function solveFrameFiniteElement(model: FrameModel2D): FrameFiniteElementSolveResult {
  const issues = validateFrameModel(model)
  if (issues.length > 0) return { ok: false, issues }

  try {
    const nodeById = new Map(model.nodes.map((node) => [node.id, node] as const))
    const globalDofs = createGlobalDofMap(model.nodes.map(({ id }) => id), 3)
    const elementData = model.elements.map((element) => {
      const properties = resolveFrameProperties(model, element) as FrameResolvedProperties
      const geometry = frameGeometry(nodeById.get(element.nodeI)!, nodeById.get(element.nodeJ)!)
      const transformation = frameTransformationMatrix(geometry.cosine, geometry.sine)
      const localStiffness = frameLocalStiffness({ ...properties, L: geometry.length })
      const equivalentDistributedLoad = [0, 0, 0, 0, 0, 0]
      const equivalentInitialStrainLoad = [0, 0, 0, 0, 0, 0]
      const distributedLoads: FrameDistributedLoadSegment[] = []
      let freeStrain = 0
      for (const load of model.loads) {
        if (!('elementId' in load) || load.elementId !== element.id) continue
        if (load.type === 'frame-uniform') {
          const interval = load.interval ?? { a: 0, b: geometry.length }
        addVector(equivalentDistributedLoad, frameDistributedLoadVector(load, geometry.length, interval))
        distributedLoads.push({ qX: load.qX ?? 0, qY: load.qY ?? 0, a: interval.a, b: interval.b })
        } else if (load.type === 'uniform-temperature') {
          freeStrain += properties.alpha! * load.deltaT
        } else if (load.type === 'initial-strain') {
          freeStrain += load.strain
        }
      }
      addVector(
        equivalentInitialStrainLoad,
        frameInitialStrainLoadVector(properties.E, properties.A, freeStrain),
      )
      const consistentLoad = equivalentDistributedLoad.map(
        (value, index) => value + equivalentInitialStrainLoad[index]!,
      )
      const localLoad = toVector6(consistentLoad)
      const dofIndices = elementDofIndices(element.nodeI, element.nodeJ, globalDofs)
      return {
        element,
        properties,
        geometry,
        transformation,
        localStiffness,
        freeStrain,
        distributedLoads,
        equivalentDistributedLoad: toVector6(equivalentDistributedLoad),
        equivalentInitialStrainLoad: toVector6(equivalentInitialStrainLoad),
        consistentLoad: localLoad,
        globalLoad: localToGlobalVector(localLoad, transformation),
        stiffness: frameGlobalStiffness(localStiffness, transformation),
        dofIndices,
      }
    })
    const totalDofs = model.nodes.length * 3
    const assembled = assembleDenseSystem(elementData.map(({ stiffness, globalLoad, dofIndices }) => ({
      stiffness,
      load: globalLoad,
      dofIndices,
    })), totalDofs)
    const appliedLoads = [...assembled.load]
    for (const load of model.loads) {
      if (load.type !== 'nodal') continue
      const dofs = globalDofs.get(load.nodeId)!
      appliedLoads[dofs[0]!]! += load.fx ?? 0
      appliedLoads[dofs[1]!]! += load.fy ?? 0
      appliedLoads[dofs[2]!]! += load.mz ?? 0
    }
    const constrainedIndices = model.constraints.map(({ nodeId, dof }) => {
      const localDof = dof === 'u' ? 0 : dof === 'v' ? 1 : 2
      return globalDofs.get(nodeId)![localDof]!
    })
    const partition = partitionZeroConstraints(totalDofs, constrainedIndices)
    const reducedStiffness = partition.freeDofs.map((row) => partition.freeDofs.map(
      (column) => assembled.stiffness[row]![column]!,
    ))
    const reducedLoad = partition.freeDofs.map((dof) => appliedLoads[dof]!)
    const reducedSolution = partition.freeDofs.length === 0
      ? []
      : solveEquilibratedStiffnessSystem(reducedStiffness, reducedLoad).solution
    const displacements = Array<number>(totalDofs).fill(0)
    partition.freeDofs.forEach((dof, index) => { displacements[dof] = reducedSolution[index]! })
    const recovered = recoverReactions(
      assembled.stiffness,
      displacements,
      appliedLoads,
      partition.constrainedDofs,
    )
    const constrainedSet = new Set(partition.constrainedDofs)
    const reactions = recovered.full.map((value, dof) => constrainedSet.has(dof) ? value : 0)
    const elements = elementData.map((data): FrameElementSolution => {
      const globalDisplacements = toVector6(data.dofIndices.map((dof) => displacements[dof]!))
      const localDisplacements = globalToLocalVector(globalDisplacements, data.transformation)
      const localEndForces = recoverFrameElementOnNodeEndForces(
        data.localStiffness,
        localDisplacements,
        data.consistentLoad,
      )
      const localResistingForces = recoverFrameResistingVector(
        data.localStiffness,
        localDisplacements,
        data.consistentLoad,
      )
      const globalEndForces = localToGlobalVector(localEndForces, data.transformation)
      const localEndForceResult = createFrameEndForceResult(data.element.id, localEndForces, 'local')
      const globalEndForceResult = createFrameEndForceResult(data.element.id, globalEndForces, 'global')
      return {
        elementId: data.element.id,
        nodeI: data.element.nodeI,
        nodeJ: data.element.nodeJ,
        properties: data.properties,
        length: data.geometry.length,
        cosine: data.geometry.cosine,
        sine: data.geometry.sine,
        freeStrain: data.freeStrain,
        distributedLoads: data.distributedLoads,
        equivalentDistributedLoad: data.equivalentDistributedLoad,
        equivalentInitialStrainLoad: data.equivalentInitialStrainLoad,
        consistentLoad: data.consistentLoad,
        localDisplacements,
        localResistingForces,
        localEndForces,
        globalEndForces,
        localEndForceResult,
        globalEndForceResult,
        endForces: localEndForceResult,
        dofIndices: data.dofIndices,
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
    const workScale = appliedLoads.reduce(
      (sum, load, dof) => sum + Math.abs(load * displacements[dof]!),
      0,
    )
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
      ...frameRecoveredNodeEquilibriumChecks(
        model.nodes.map(({ id }) => id),
        elements.map(({ nodeI, nodeJ, globalEndForces }) => ({ nodeI, nodeJ, globalEndForces })),
        model.loads.filter((load) => load.type === 'nodal').map((load) => ({
          nodeId: load.nodeId, fx: load.fx ?? 0, fy: load.fy ?? 0, mz: load.mz ?? 0,
        })),
        nodes.map(({ nodeId, reactionFx, reactionFy, reactionMz }) => ({
          nodeId, fx: reactionFx, fy: reactionFy, mz: reactionMz,
        })),
        forceTolerance,
        momentTolerance,
      ),
      strainEnergyCheck(
        assembled.stiffness,
        displacements,
        appliedLoads,
        Math.max(1e-9, workScale * 1e-9),
      ),
    ]
    if (checks.some(({ passed }) => !passed)) {
      return { ok: false, issues: [createStructuralIssue(
        'P2_ILL_CONDITIONED_STIFFNESS',
        '刚架求解平衡或能量残差超过容差',
        { field: 'checks' },
      )] }
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
