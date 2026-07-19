import { describe, expect, it } from 'vitest'

import { frameLocalStiffness } from '../../../../src/core/structural/frame'

describe('P2 frame local stiffness', () => {
  it('matches FRAME-E01 local 6x6 truth', () => {
    const stiffness = frameLocalStiffness({ E: 200e9, A: 0.01, I: 8e-5, L: 5 })
    const expected = [
      [400e6, 0, 0, -400e6, 0, 0],
      [0, 1.536e6, 3.84e6, 0, -1.536e6, 3.84e6],
      [0, 3.84e6, 12.8e6, 0, -3.84e6, 6.4e6],
      [-400e6, 0, 0, 400e6, 0, 0],
      [0, -1.536e6, -3.84e6, 0, 1.536e6, -3.84e6],
      [0, 3.84e6, 6.4e6, 0, -3.84e6, 12.8e6],
    ]
    stiffness.forEach((row, i) => row.forEach((value, j) => {
      expect(value).toBeCloseTo(expected[i]![j]!, 6)
      expect(value).toBeCloseTo(stiffness[j]![i]!, 8)
    }))
  })

  it('annihilates three local rigid-body modes', () => {
    const stiffness = frameLocalStiffness({ E: 200e9, A: 0.01, I: 8e-5, L: 5 })
    const modes = [
      [1, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0],
      [0, 0, 1, 0, 5, 1],
    ]
    for (const mode of modes) {
      stiffness.forEach((row) => {
        const residual = row.reduce((sum, value, index) => sum + value * mode[index]!, 0)
        expect(Math.abs(residual)).toBeLessThanOrEqual(1e-8)
      })
    }
  })

  it('rejects nonpositive or nonfinite properties', () => {
    expect(() => frameLocalStiffness({ E: 0, A: 1, I: 1, L: 1 })).toThrow('E')
    expect(() => frameLocalStiffness({ E: 1, A: 1, I: Number.NaN, L: 1 })).toThrow('I')
  })
})
