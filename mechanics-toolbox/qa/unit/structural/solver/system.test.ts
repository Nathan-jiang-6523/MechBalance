import { describe, expect, it } from 'vitest'

import {
  StructuralSolverError,
  assembleDenseSystem,
  partitionZeroConstraints,
  recoverReactions,
  solveEquilibratedStiffnessSystem,
  solveLinearSystem,
} from '../../../../src/core/structural/solver'

describe('structural dense system assembly', () => {
  it('assembles overlapping element stiffness and loads', () => {
    const result = assembleDenseSystem([
      { dofIndices: [0, 1], stiffness: [[10, -10], [-10, 10]], load: [0, 5] },
      { dofIndices: [1, 2], stiffness: [[20, -20], [-20, 20]], load: [3, 7] },
    ], 3)
    expect(result.stiffness).toEqual([
      [10, -10, 0],
      [-10, 30, -20],
      [0, -20, 20],
    ])
    expect(result.load).toEqual([0, 8, 7])
  })

  it('rejects invalid element mapping', () => {
    expect(() => assembleDenseSystem([
      { dofIndices: [0, 0], stiffness: [[1, 0], [0, 1]] },
    ], 2)).toThrowError(expect.objectContaining({ code: 'P2_DUPLICATE_DOF' }))
    expect(() => assembleDenseSystem([
      { dofIndices: [0, 2], stiffness: [[1, 0], [0, 1]] },
    ], 2)).toThrowError(expect.objectContaining({ code: 'P2_DOF_OUT_OF_RANGE' }))
    expect(() => assembleDenseSystem([
      { dofIndices: [0, 1], stiffness: [[1]] },
    ], 2)).toThrowError(expect.objectContaining({ code: 'P2_MATRIX_DIMENSION_MISMATCH' }))
  })
})

describe('zero constraints', () => {
  it('returns sorted constrained and complementary free DOFs', () => {
    expect(partitionZeroConstraints(6, [5, 0, 2])).toEqual({
      constrainedDofs: [0, 2, 5],
      freeDofs: [1, 3, 4],
    })
  })

  it('rejects absent, duplicate, and out-of-range constraints', () => {
    expect(() => partitionZeroConstraints(3, [])).toThrowError(
      expect.objectContaining({ code: 'P2_NO_CONSTRAINTS' }),
    )
    expect(() => partitionZeroConstraints(3, [1, 1])).toThrowError(
      expect.objectContaining({ code: 'P2_DUPLICATE_DOF' }),
    )
    expect(() => partitionZeroConstraints(3, [3])).toThrowError(
      expect.objectContaining({ code: 'P2_DOF_OUT_OF_RANGE' }),
    )
  })
})

describe('linear solve and reaction recovery', () => {
  it('solves with partial pivoting and reports residual/pivot diagnostics', () => {
    const result = solveLinearSystem([[0, 2], [1, 3]], [4, 5])
    expect(result.solution[0]).toBeCloseTo(-1)
    expect(result.solution[1]).toBeCloseTo(2)
    expect(result.diagnostics.residualNorm).toBeLessThan(1e-12)
    expect(result.diagnostics.pivotRatio).toBeGreaterThan(0)
  })

  it('distinguishes singular and ill-conditioned matrices', () => {
    expect(() => solveLinearSystem([[1, 2], [2, 4]], [1, 2])).toThrowError(
      expect.objectContaining({ code: 'P2_SINGULAR_STIFFNESS' }),
    )
    expect(() => solveLinearSystem([[1, 0], [0, 1e-13]], [1, 1e-13])).toThrowError(
      expect.objectContaining({ code: 'P2_ILL_CONDITIONED_STIFFNESS' }),
    )
  })

  it('equilibrates mixed stiffness scales before pivot diagnosis', () => {
    const result = solveEquilibratedStiffnessSystem(
      [[1e12, 0], [0, 1e-6]],
      [2e12, 3e-6],
    )
    expect(result.solution[0]).toBeCloseTo(2, 12)
    expect(result.solution[1]).toBeCloseTo(3, 12)
    expect(result.diagnostics.pivotRatio).toBeCloseTo(1, 12)

    const epsilon = 1e-13
    expect(() => solveEquilibratedStiffnessSystem(
      [[1, 1 - epsilon], [1 - epsilon, 1]],
      [2 - epsilon, 2 - epsilon],
    )).toThrowError(expect.objectContaining({ code: 'P2_ILL_CONDITIONED_STIFFNESS' }))
  })

  it('recovers full residual and constrained reactions as Kd-F', () => {
    const result = recoverReactions(
      [[10, -10], [-10, 10]],
      [0, 0.5],
      [0, 5],
      [0],
    )
    expect(result.full).toEqual([-5, 0])
    expect(result.constrained).toEqual([{ dof: 0, value: -5 }])
  })

  it('rejects dimension and constraint errors explicitly', () => {
    expect(() => solveLinearSystem([[1]], [1, 2])).toThrowError(StructuralSolverError)
    expect(() => recoverReactions([[1]], [0], [0], [])).toThrowError(
      expect.objectContaining({ code: 'P2_NO_CONSTRAINTS' }),
    )
    expect(() => recoverReactions([[1]], [0], [0], [0, 0])).toThrowError(
      expect.objectContaining({ code: 'P2_DUPLICATE_DOF' }),
    )
  })
})
