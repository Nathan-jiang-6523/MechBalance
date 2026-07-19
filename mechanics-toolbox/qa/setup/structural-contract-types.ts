import type { NodalLoad2D, PlanarNodalForce, ZeroConstraint } from '../../src/core/structural/contracts'

const frameMoment: NodalLoad2D = { type: 'nodal', id: 'm', nodeId: 'n1', mz: 1 }

// @ts-expect-error 桁架节点荷载不得含弯矩。
const trussMoment: PlanarNodalForce = { type: 'nodal', id: 'm', nodeId: 'n1', mz: 1 }

// @ts-expect-error 节点荷载不得没有任何分量。
const emptyLoad: NodalLoad2D = { type: 'nodal', id: 'p', nodeId: 'n1' }

// @ts-expect-error P2 首版只支持零位移约束。
const nonzeroConstraint: ZeroConstraint = { nodeId: 'n1', dof: 'u', value: 1 }

void frameMoment
void trussMoment
void emptyLoad
void nonzeroConstraint
