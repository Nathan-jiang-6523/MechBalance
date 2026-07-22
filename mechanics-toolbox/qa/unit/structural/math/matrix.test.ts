import { describe, expect, it } from 'vitest'

import {
  StructuralMathError,
  add,
  dot,
  identity,
  matVec,
  norm,
  scale,
  subtract,
  transpose,
  zeros,
} from '../../../../src/core/structural/math'

describe('structural dense matrix primitives', () => {
  it('creates and transforms matrices without mutating inputs', () => {
    const matrix = [[1, 2, 3], [4, 5, 6]] as const
    expect(zeros(2, 3)).toEqual([[0, 0, 0], [0, 0, 0]])
    expect(identity(2)).toEqual([[1, 0], [0, 1]])
    expect(transpose(matrix)).toEqual([[1, 4], [2, 5], [3, 6]])
    expect(matrix).toEqual([[1, 2, 3], [4, 5, 6]])
  })

  it('computes vector operations deterministically', () => {
    expect(matVec([[2, 1], [-1, 3]], [4, 5])).toEqual([13, 11])
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32)
    expect(norm([3, 4])).toBe(5)
    expect(add([1, 2], [3, 4])).toEqual([4, 6])
    expect(subtract([1, 2], [3, 4])).toEqual([-2, -2])
    expect(scale([1, -2], 3)).toEqual([3, -6])
  })

  it('rejects invalid dimensions and non-finite values', () => {
    expect(() => matVec([[1, 2]], [1])).toThrowError(StructuralMathError)
    expect(() => dot([1], [1, 2])).toThrowError(
      expect.objectContaining({ code: 'P2_MATRIX_DIMENSION_MISMATCH' }),
    )
    expect(() => transpose([[1], [Number.NaN]])).toThrowError(
      expect.objectContaining({ code: 'P2_NONFINITE_MATRIX_VALUE' }),
    )
    expect(() => zeros(-1, 2)).toThrowError(
      expect.objectContaining({ code: 'P2_INVALID_MATRIX_SIZE' }),
    )
  })
})
