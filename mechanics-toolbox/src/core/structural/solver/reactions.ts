import { assertFiniteVector, matVec, matrixShape, subtract, type Matrix, type Vector } from '../math'
import { StructuralSolverError, assertDofIndex } from './linear'

export interface ConstrainedReaction {
  readonly dof: number
  readonly value: number
}

export interface ReactionRecovery {
  readonly full: Vector
  readonly constrained: readonly ConstrainedReaction[]
}

export function recoverReactions(
  stiffness: Matrix,
  displacements: Vector,
  appliedLoads: Vector,
  constrainedDofs: readonly number[],
): ReactionRecovery {
  const [rows, columns] = matrixShape(stiffness, 'stiffness')
  assertFiniteVector(displacements, 'displacements')
  assertFiniteVector(appliedLoads, 'appliedLoads')
  if (rows === 0 || rows !== columns || displacements.length !== rows || appliedLoads.length !== rows) {
    throw new StructuralSolverError(
      'P2_MATRIX_DIMENSION_MISMATCH',
      'reaction recovery requires square stiffness and matching displacement/load vectors',
    )
  }
  if (constrainedDofs.length === 0) {
    throw new StructuralSolverError('P2_NO_CONSTRAINTS', 'reaction recovery requires constrained DOFs')
  }
  const unique = new Set<number>()
  for (const dof of constrainedDofs) {
    assertDofIndex(dof, rows, 'constrainedDofs')
    if (unique.has(dof)) {
      throw new StructuralSolverError('P2_DUPLICATE_DOF', `duplicate constrained DOF ${dof}`)
    }
    unique.add(dof)
  }
  const full = subtract(matVec(stiffness, displacements), appliedLoads)
  const constrained = [...unique]
    .sort((left, right) => left - right)
    .map((dof) => ({ dof, value: full[dof]! }))
  return { full, constrained }
}
