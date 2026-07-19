import type { BeamDof, ZeroConstraint } from '../contracts'

export type BeamSupportKind = 'fixed' | 'pinned' | 'vertical-roller'

const SUPPORT_DOFS: Readonly<Record<BeamSupportKind, readonly BeamDof[]>> = {
  fixed: ['u', 'v', 'theta'],
  pinned: ['u', 'v'],
  'vertical-roller': ['v'],
}

/** Map a named support to frozen zero constraints in [u,v,theta] order. */
export function beamSupportConstraints(
  nodeId: string,
  kind: BeamSupportKind,
): readonly ZeroConstraint[] {
  if (nodeId.length === 0) throw new RangeError('支承节点 ID 不能为空')
  const dofs = SUPPORT_DOFS[kind]
  if (!dofs) throw new RangeError(`不支持的梁支承类型：${String(kind)}`)
  return dofs.map((dof) => ({ nodeId, dof, value: 0 }))
}

/** Fixed left end plus vertical roller at right: CBEAM-A03 boundary. */
export function fixedRollerBeamConstraints(
  leftNodeId: string,
  rightNodeId: string,
): readonly ZeroConstraint[] {
  return [
    ...beamSupportConstraints(leftNodeId, 'fixed'),
    ...beamSupportConstraints(rightNodeId, 'vertical-roller'),
  ]
}

/** Both ends fixed: CBEAM-A05 boundary. */
export function fixedFixedBeamConstraints(
  leftNodeId: string,
  rightNodeId: string,
): readonly ZeroConstraint[] {
  return [
    ...beamSupportConstraints(leftNodeId, 'fixed'),
    ...beamSupportConstraints(rightNodeId, 'fixed'),
  ]
}
