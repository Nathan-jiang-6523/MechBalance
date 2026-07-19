import { StructuralSolverError, assertDofIndex, assertPositiveDofCount } from './linear'

export interface ZeroConstraintPartition {
  readonly freeDofs: readonly number[]
  readonly constrainedDofs: readonly number[]
}

export function partitionZeroConstraints(
  totalDofs: number,
  constrainedIndices: readonly number[],
): ZeroConstraintPartition {
  assertPositiveDofCount(totalDofs)
  if (constrainedIndices.length === 0) {
    throw new StructuralSolverError('P2_NO_CONSTRAINTS', 'at least one constrained DOF is required')
  }
  const constrained = new Set<number>()
  for (const dof of constrainedIndices) {
    assertDofIndex(dof, totalDofs, 'constrainedIndices')
    if (constrained.has(dof)) {
      throw new StructuralSolverError('P2_DUPLICATE_DOF', `duplicate constrained DOF ${dof}`)
    }
    constrained.add(dof)
  }
  const constrainedDofs = [...constrained].sort((left, right) => left - right)
  const freeDofs = Array.from({ length: totalDofs }, (_, dof) => dof).filter(
    (dof) => !constrained.has(dof),
  )
  return { freeDofs, constrainedDofs }
}
