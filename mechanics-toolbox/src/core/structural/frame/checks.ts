import type { LinearSystemCheck } from '../checks'
import type { FrameVector6 } from './element'

export interface FrameElementGlobalEndActions {
  readonly nodeI: string
  readonly nodeJ: string
  /** Element-on-node actions in global [Fx_i,Fy_i,Mz_i,Fx_j,Fy_j,Mz_j] order. */
  readonly globalEndForces: FrameVector6
}

export interface FrameNodalAction {
  readonly nodeId: string
  readonly fx: number
  readonly fy: number
  readonly mz: number
}

function requireFiniteAction(action: FrameNodalAction, label: string): void {
  if (![action.fx, action.fy, action.mz].every(Number.isFinite)) {
    throw new RangeError(`${label} must contain finite actions`)
  }
}

/**
 * Check physical node equilibrium from recovered element-on-node actions.
 * This stays independent of the assembled Kd-F residual used by the solver.
 */
export function frameRecoveredNodeEquilibriumChecks(
  nodeIds: readonly string[],
  elements: readonly FrameElementGlobalEndActions[],
  externalNodalLoads: readonly FrameNodalAction[],
  reactions: readonly FrameNodalAction[],
  forceTolerance: number,
  momentTolerance: number,
): readonly [LinearSystemCheck, LinearSystemCheck] {
  if ([forceTolerance, momentTolerance].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('刚架节点平衡容差无效')
  }
  const totals = new Map<string, [number, number, number]>(
    nodeIds.map((nodeId) => [nodeId, [0, 0, 0]]),
  )
  if (totals.size !== nodeIds.length) throw new RangeError('刚架节点 ID 重复')
  const add = (nodeId: string, values: readonly [number, number, number], label: string): void => {
    const target = totals.get(nodeId)
    if (!target) throw new RangeError(`${label} references unknown node ${nodeId}`)
    if (!values.every(Number.isFinite)) throw new RangeError(`${label} must contain finite actions`)
    target[0] += values[0]
    target[1] += values[1]
    target[2] += values[2]
  }
  elements.forEach((element, index) => {
    add(element.nodeI, [
      element.globalEndForces[0], element.globalEndForces[1], element.globalEndForces[2],
    ], `elements[${index}].nodeI`)
    add(element.nodeJ, [
      element.globalEndForces[3], element.globalEndForces[4], element.globalEndForces[5],
    ], `elements[${index}].nodeJ`)
  })
  externalNodalLoads.forEach((action, index) => {
    requireFiniteAction(action, `externalNodalLoads[${index}]`)
    add(action.nodeId, [action.fx, action.fy, action.mz], `externalNodalLoads[${index}]`)
  })
  reactions.forEach((action, index) => {
    requireFiniteAction(action, `reactions[${index}]`)
    add(action.nodeId, [action.fx, action.fy, action.mz], `reactions[${index}]`)
  })
  const forceResidual = Math.max(0, ...[...totals.values()].flatMap(([fx, fy]) => [Math.abs(fx), Math.abs(fy)]))
  const momentResidual = Math.max(0, ...[...totals.values()].map(([, , mz]) => Math.abs(mz)))
  return [
    {
      id: 'node-equilibrium', value: forceResidual, unit: 'N',
      tolerance: forceTolerance, passed: forceResidual <= forceTolerance,
    },
    {
      id: 'node-moment-equilibrium', value: momentResidual, unit: 'N*m',
      tolerance: momentTolerance, passed: momentResidual <= momentTolerance,
    },
  ]
}
