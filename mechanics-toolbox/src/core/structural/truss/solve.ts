import {
  createStructuralIssue,
  type StructuralIssue,
  type TrussElementResult,
  type TrussModel2D,
} from '../contracts'
import { strainEnergyCheck, type LinearSystemCheck } from '../checks'
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
import {
  trussElementAxialEquilibriumCheck,
  trussFreeDofEquilibriumCheck,
  trussGlobalBalanceChecks,
  trussNodeEquilibriumCheck,
} from './checks'
import {
  trussAxialExtension,
  trussElementGeometry,
  trussGlobalStiffness,
  type TrussVector4,
} from './element'
import { trussInitialStrainLoadVector } from './initial-strain'
import { createTrussElementResult } from './results'
import { trussSelfWeightLoadVector } from './self-weight'
import { resolveTrussProperties, validateTrussModel, type TrussResolvedProperties } from './validation'

export interface TrussNodeSolution {
  readonly nodeId: string
  readonly u: number
  readonly v: number
  readonly reactionFx: number
  readonly reactionFy: number
}

export interface TrussElementSolution extends TrussElementResult {
  readonly length: number
  readonly cosine: number
  readonly sine: number
  readonly freeStrain: number
  readonly axialExtension: number
  readonly equivalentInitialStrainLoad: TrussVector4
  readonly equivalentSelfWeightLoad: TrussVector4
  readonly mass: number
  readonly weight: number
  readonly dofIndices: readonly number[]
}

export interface TrussFiniteElementSolution {
  readonly displacements: readonly number[]
  readonly appliedLoads: readonly number[]
  readonly stiffness: Matrix
  readonly freeDofs: readonly number[]
  readonly constrainedDofs: readonly number[]
  readonly nodes: readonly TrussNodeSolution[]
  readonly elements: readonly TrussElementSolution[]
  readonly checks: readonly LinearSystemCheck[]
}

export type TrussFiniteElementSolveResult =
  | Readonly<{ ok: true; value: TrussFiniteElementSolution }>
  | Readonly<{ ok: false; issues: readonly StructuralIssue[] }>

function addVector(target: number[], source: readonly number[]): void {
  source.forEach((value, index) => { target[index] = target[index]! + value })
}

function toVector4(values: readonly number[]): TrussVector4 {
  if (values.length !== 4) throw new RangeError('桁架单元向量必须含 4 个分量')
  return values as TrussVector4
}

function mechanismIssue(
  reducedStiffness: Matrix,
  freeDofs: readonly number[],
  model: TrussModel2D,
): StructuralIssue | undefined {
  const scale = Math.max(0, ...reducedStiffness.flat().map(Math.abs))
  const local = reducedStiffness.findIndex((row, index) => Math.abs(row[index]!) <= scale * 1e-14)
  if (local < 0) return undefined
  const globalDof = freeDofs[local]!
  const node = model.nodes[Math.floor(globalDof / 2)]!
  const direction = globalDof % 2 === 0 ? 'x' : 'y'
  return createStructuralIssue(
    'P2_SINGULAR_STIFFNESS',
    `桁架存在机构：节点 ${node.id} 的 ${direction} 向自由度无刚度`,
    { field: 'constraints' },
  )
}

function solverIssue(error: unknown): StructuralIssue {
  if (error instanceof StructuralSolverError) {
    if (error.code === 'P2_ILL_CONDITIONED_STIFFNESS') {
      return createStructuralIssue(error.code, `桁架整体刚度矩阵病态：${error.message}`, { field: 'constraints' })
    }
    return createStructuralIssue('P2_SINGULAR_STIFFNESS', '桁架存在机构或约束不足', { field: 'constraints' })
  }
  return createStructuralIssue(
    'P2_NONFINITE_INPUT',
    error instanceof Error ? error.message : String(error),
    { field: 'model' },
  )
}

export function solveTrussFiniteElement(model: TrussModel2D): TrussFiniteElementSolveResult {
  const issues = validateTrussModel(model)
  if (issues.length > 0) return { ok: false, issues }

  try {
    const nodeById = new Map(model.nodes.map((node) => [node.id, node] as const))
    const globalDofs = createGlobalDofMap(model.nodes.map(({ id }) => id), 2)
    const elementData = model.elements.map((element) => {
      const properties = resolveTrussProperties(model, element) as TrussResolvedProperties
      const geometry = trussElementGeometry(nodeById.get(element.nodeI)!, nodeById.get(element.nodeJ)!)
      let freeStrain = 0
      const equivalentInitialStrainLoad = [0, 0, 0, 0]
      const equivalentSelfWeightLoad = [0, 0, 0, 0]
      let mass = 0
      let weight = 0
      for (const load of model.loads) {
        if (!('elementId' in load) || load.elementId !== element.id) continue
        if (load.type === 'uniform-temperature') freeStrain += properties.alpha! * load.deltaT
        if (load.type === 'initial-strain') freeStrain += load.strain
        if (load.type === 'truss-self-weight') {
          const result = trussSelfWeightLoadVector(properties.density!, properties.A, geometry.length, load.gravity)
          mass += result.mass
          weight += result.weight
          addVector(equivalentSelfWeightLoad, result.equivalentLoad)
        }
      }
      addVector(
        equivalentInitialStrainLoad,
        trussInitialStrainLoadVector(properties.E, properties.A, freeStrain, geometry),
      )
      const consistentLoad = equivalentInitialStrainLoad.map(
        (value, index) => value + equivalentSelfWeightLoad[index]!,
      )
      return {
        element,
        properties,
        geometry,
        freeStrain,
        mass,
        weight,
        stiffness: trussGlobalStiffness(properties.E, properties.A, geometry),
        equivalentInitialStrainLoad: toVector4(equivalentInitialStrainLoad),
        equivalentSelfWeightLoad: toVector4(equivalentSelfWeightLoad),
        consistentLoad: toVector4(consistentLoad),
        dofIndices: elementDofIndices(element.nodeI, element.nodeJ, globalDofs),
      }
    })
    const totalDofs = model.nodes.length * 2
    const assembled = assembleDenseSystem(elementData.map(({ stiffness, consistentLoad, dofIndices }) => ({
      stiffness, load: consistentLoad, dofIndices,
    })), totalDofs)
    const appliedLoads = [...assembled.load]
    for (const load of model.loads) {
      if (load.type !== 'nodal') continue
      const dofs = globalDofs.get(load.nodeId)!
      appliedLoads[dofs[0]!]! += load.fx ?? 0
      appliedLoads[dofs[1]!]! += load.fy ?? 0
    }
    const constrainedIndices = model.constraints.map(({ nodeId, dof }) => globalDofs.get(nodeId)![dof === 'u' ? 0 : 1]!)
    const partition = partitionZeroConstraints(totalDofs, constrainedIndices)
    const reducedStiffness = partition.freeDofs.map((row) => partition.freeDofs.map(
      (column) => assembled.stiffness[row]![column]!,
    ))
    const directMechanism = mechanismIssue(reducedStiffness, partition.freeDofs, model)
    if (directMechanism) return { ok: false, issues: [directMechanism] }
    const reducedLoad = partition.freeDofs.map((dof) => appliedLoads[dof]!)
    const reducedSolution = partition.freeDofs.length === 0
      ? []
      : solveEquilibratedStiffnessSystem(reducedStiffness, reducedLoad).solution
    const displacements = Array<number>(totalDofs).fill(0)
    partition.freeDofs.forEach((dof, index) => { displacements[dof] = reducedSolution[index]! })
    const recovered = recoverReactions(assembled.stiffness, displacements, appliedLoads, partition.constrainedDofs)
    const constrainedSet = new Set(partition.constrainedDofs)
    const reactions = recovered.full.map((value, dof) => constrainedSet.has(dof) ? value : 0)
    const elements = elementData.map((data): TrussElementSolution => {
      const localDisplacements = toVector4(data.dofIndices.map((dof) => displacements[dof]!))
      const axialExtension = trussAxialExtension(localDisplacements, data.geometry)
      const axialForce = data.properties.E * data.properties.A
        * (axialExtension / data.geometry.length - data.freeStrain)
      return {
        ...createTrussElementResult(data.element.id, axialForce, data.properties.A),
        length: data.geometry.length,
        cosine: data.geometry.cosine,
        sine: data.geometry.sine,
        freeStrain: data.freeStrain,
        axialExtension,
        equivalentInitialStrainLoad: data.equivalentInitialStrainLoad,
        equivalentSelfWeightLoad: data.equivalentSelfWeightLoad,
        mass: data.mass,
        weight: data.weight,
        dofIndices: data.dofIndices,
      }
    })
    const nodes = model.nodes.map(({ id }) => {
      const dofs = globalDofs.get(id)!
      return {
        nodeId: id,
        u: displacements[dofs[0]!]!,
        v: displacements[dofs[1]!]!,
        reactionFx: reactions[dofs[0]!]!,
        reactionFy: reactions[dofs[1]!]!,
      }
    })
    const forceTolerance = 1e-6
    const momentTolerance = 1e-6
    const workScale = appliedLoads.reduce((sum, load, dof) => sum + Math.abs(load * displacements[dof]!), 0)
    const checks = [
      trussFreeDofEquilibriumCheck(assembled.stiffness, displacements, appliedLoads, partition.freeDofs, forceTolerance),
      trussNodeEquilibriumCheck(assembled.stiffness, displacements, appliedLoads, reactions, forceTolerance),
      trussElementAxialEquilibriumCheck(elements.map(({ axialForce, cosine, sine }) => ({
        nodeI: [-axialForce.value * cosine, -axialForce.value * sine],
        nodeJ: [axialForce.value * cosine, axialForce.value * sine],
      })), forceTolerance),
      ...trussGlobalBalanceChecks(appliedLoads, reactions, model.nodes, forceTolerance, momentTolerance),
      strainEnergyCheck(assembled.stiffness, displacements, appliedLoads, Math.max(1e-9, workScale * 1e-9)),
    ]
    if (checks.some(({ passed }) => !passed)) {
      return { ok: false, issues: [createStructuralIssue(
        'P2_ILL_CONDITIONED_STIFFNESS', '桁架求解平衡或能量残差超过容差', { field: 'checks' },
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
