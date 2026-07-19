import { describe, expect, it } from 'vitest'

import { beamUniformLoadVector } from '../../../../src/core/structural/beam'

describe('P2 beam consistent uniform load', () => {
  it('matches BEAM-E02 independent vector truth', () => {
    expect(beamUniformLoadVector(-10_000, 4)).toEqual([
      0,
      -20_000,
      -40_000 / 3,
      0,
      -20_000,
      40_000 / 3,
    ])
  })

  it('preserves full-load resultant and moment about node i', () => {
    const L = 4
    const load = beamUniformLoadVector(-10_000, L)
    const resultant = load[1] + load[4]
    const momentAboutI = load[2] + load[4] * L + load[5]
    expect(resultant).toBe(-40_000)
    expect(momentAboutI).toBe(-80_000)
  })

  it('rejects nonfinite load or nonpositive length', () => {
    expect(() => beamUniformLoadVector(Number.NaN, 1)).toThrow('qY')
    expect(() => beamUniformLoadVector(1, Number.POSITIVE_INFINITY)).toThrow('L')
    expect(() => beamUniformLoadVector(1, 0)).toThrow('positive')
  })
})
