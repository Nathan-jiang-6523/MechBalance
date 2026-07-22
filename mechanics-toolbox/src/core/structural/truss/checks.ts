import {
  freeDofEquilibriumCheck,
  matrixVectorProduct,
  type LinearSystemCheck,
} from '../checks'

export interface TrussElementEndForcePair {
  readonly nodeI: readonly [number, number]
  readonly nodeJ: readonly [number, number]
}

export function trussNodeEquilibriumCheck(
  stiffness: readonly (readonly number[])[],
  displacement: readonly number[],
  appliedLoads: readonly number[],
  reactions: readonly number[],
  tolerance: number,
): LinearSystemCheck {
  if (appliedLoads.length !== reactions.length || appliedLoads.length !== displacement.length) {
    throw new RangeError('桁架节点平衡输入维度不一致')
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('桁架节点平衡容差无效')
  const internal = matrixVectorProduct(stiffness, displacement)
  const residual = Math.max(0, ...internal.map(
    (value, dof) => Math.abs(value - appliedLoads[dof]! - reactions[dof]!),
  ))
  return {
    id: 'node-equilibrium', value: residual, unit: 'N', tolerance, passed: residual <= tolerance,
  }
}

export function trussElementAxialEquilibriumCheck(
  endForces: readonly TrussElementEndForcePair[],
  tolerance: number,
): LinearSystemCheck {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('桁架单元平衡容差无效')
  const residual = Math.max(0, ...endForces.flatMap(({ nodeI, nodeJ }) => [
    Math.abs(nodeI[0] + nodeJ[0]), Math.abs(nodeI[1] + nodeJ[1]),
  ]))
  return {
    id: 'element-axial-equilibrium', value: residual, unit: 'N', tolerance, passed: residual <= tolerance,
  }
}

export function trussGlobalBalanceChecks(
  appliedLoads: readonly number[],
  reactions: readonly number[],
  nodes: readonly Readonly<{ x: number; y: number }>[] ,
  forceTolerance: number,
  momentTolerance: number,
): readonly [LinearSystemCheck, LinearSystemCheck, LinearSystemCheck] {
  if (appliedLoads.length !== reactions.length || appliedLoads.length !== nodes.length * 2) {
    throw new RangeError('桁架全局平衡输入维度不一致')
  }
  if ([forceTolerance, momentTolerance].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('桁架平衡容差无效')
  }
  let fx = 0
  let fy = 0
  let mz = 0
  nodes.forEach(({ x, y }, index) => {
    if (![x, y].every(Number.isFinite)) throw new RangeError('桁架节点坐标必须为有限数')
    const nodeFx = appliedLoads[index * 2]! + reactions[index * 2]!
    const nodeFy = appliedLoads[index * 2 + 1]! + reactions[index * 2 + 1]!
    fx += nodeFx
    fy += nodeFy
    mz += x * nodeFy - y * nodeFx
  })
  const make = (
    id: 'global-force-x-balance' | 'global-force-y-balance' | 'global-moment-balance',
    value: number,
    unit: 'N' | 'N*m',
    tolerance: number,
  ): LinearSystemCheck => ({
    id, value: Math.abs(value), unit, tolerance, passed: Math.abs(value) <= tolerance,
  })
  return [
    make('global-force-x-balance', fx, 'N', forceTolerance),
    make('global-force-y-balance', fy, 'N', forceTolerance),
    make('global-moment-balance', mz, 'N*m', momentTolerance),
  ]
}

export const trussFreeDofEquilibriumCheck = freeDofEquilibriumCheck
