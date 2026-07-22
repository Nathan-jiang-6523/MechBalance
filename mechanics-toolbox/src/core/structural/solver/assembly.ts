import {
  assertFiniteVector,
  matrixShape,
  zeroVector,
  zeros,
  type Matrix,
  type Vector,
} from '../math'
import { StructuralSolverError, assertDofIndex, assertPositiveDofCount } from './linear'

export interface ElementSystemContribution {
  readonly dofIndices: readonly number[]
  readonly stiffness: Matrix
  readonly load?: Vector
}

export interface DenseSystem {
  readonly stiffness: Matrix
  readonly load: Vector
}

export function assembleDenseSystem(
  contributions: readonly ElementSystemContribution[],
  totalDofs: number,
): DenseSystem {
  assertPositiveDofCount(totalDofs)
  const stiffness = zeros(totalDofs, totalDofs)
  const load = zeroVector(totalDofs)

  for (let elementIndex = 0; elementIndex < contributions.length; elementIndex += 1) {
    const contribution = contributions[elementIndex]!
    const label = `contributions[${elementIndex}]`
    const [rows, columns] = matrixShape(contribution.stiffness, `${label}.stiffness`)
    const dofCount = contribution.dofIndices.length
    if (rows !== dofCount || columns !== dofCount) {
      throw new StructuralSolverError(
        'P2_MATRIX_DIMENSION_MISMATCH',
        `${label}.stiffness must be ${dofCount} x ${dofCount}`,
      )
    }
    const unique = new Set<number>()
    for (const dof of contribution.dofIndices) {
      assertDofIndex(dof, totalDofs, `${label}.dofIndices`)
      if (unique.has(dof)) {
        throw new StructuralSolverError('P2_DUPLICATE_DOF', `${label} contains duplicate DOF ${dof}`)
      }
      unique.add(dof)
    }
    if (contribution.load !== undefined) {
      assertFiniteVector(contribution.load, `${label}.load`)
      if (contribution.load.length !== dofCount) {
        throw new StructuralSolverError(
          'P2_MATRIX_DIMENSION_MISMATCH',
          `${label}.load length must be ${dofCount}`,
        )
      }
    }

    for (let localRow = 0; localRow < dofCount; localRow += 1) {
      const globalRow = contribution.dofIndices[localRow]!
      if (contribution.load !== undefined) {
        load[globalRow] = load[globalRow]! + contribution.load[localRow]!
      }
      for (let localColumn = 0; localColumn < dofCount; localColumn += 1) {
        const globalColumn = contribution.dofIndices[localColumn]!
        stiffness[globalRow]![globalColumn] = stiffness[globalRow]![globalColumn]!
          + contribution.stiffness[localRow]![localColumn]!
      }
    }
  }

  return { stiffness, load }
}
