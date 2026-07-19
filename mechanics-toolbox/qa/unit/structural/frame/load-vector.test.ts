import { describe, expect, it } from 'vitest'

import {
  frameDistributedLoadVector,
  frameUniformLoadVector,
} from '../../../../src/core/structural/frame'

describe('P2 frame consistent constant distributed load', () => {
  it('matches FRAME-A02 full-span vector', () => {
    const load = frameUniformLoadVector(-10_000, 4)
    const expected = [0, -20_000, -40_000 / 3, 0, -20_000, 40_000 / 3]
    load.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 9))
  })

  it('matches FRAME-A03 half-span interval vector', () => {
    const load = frameUniformLoadVector(-10_000, 4, { a: 0, b: 2 })
    const expected = [0, -16_250, -27_500 / 3, 0, -3_750, 12_500 / 3]
    load.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 9))
  })

  it('preserves axial full-span and partial-span resultants', () => {
    expect(frameDistributedLoadVector({ qX: 10_000 }, 4)).toEqual([
      20_000, 0, 0, 20_000, 0, 0,
    ])
    expect(frameDistributedLoadVector({ qX: 10_000 }, 4, { a: 0, b: 2 })).toEqual([
      15_000, 0, 0, 5_000, 0, 0,
    ])
  })

  it('combines local axial and transverse components in one vector', () => {
    const combined = frameDistributedLoadVector({ qX: 2_000, qY: -10_000 }, 4)
    const expected = [4_000, -20_000, -40_000 / 3, 4_000, -20_000, 40_000 / 3]
    combined.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 9))
  })

  it.each([
    [-10_000, 4, undefined, -40_000, -80_000],
    [-10_000, 4, { a: 0, b: 2 }, -20_000, -20_000],
    [8_000, 5, { a: 1, b: 4 }, 24_000, 60_000],
  ] as const)('preserves loaded resultant and moment about node i', (qY, L, interval, force, moment) => {
    const load = interval === undefined
      ? frameUniformLoadVector(qY, L)
      : frameUniformLoadVector(qY, L, interval)
    const resultant = load[1] + load[4]
    const momentAboutI = load[2] + load[4] * L + load[5]
    expect(resultant).toBeCloseTo(force, 9)
    expect(momentAboutI).toBeCloseTo(moment, 9)
  })

  it('rejects nonconstant/nonfinite input and invalid intervals', () => {
    expect(() => frameUniformLoadVector({ type: 'triangular' } as unknown as number, 4)).toThrow('qY')
    expect(() => frameUniformLoadVector(1, 0)).toThrow('positive')
    expect(() => frameUniformLoadVector(1, 4, { a: -1, b: 2 })).toThrow('0 <= a')
    expect(() => frameUniformLoadVector(1, 4, { a: 2, b: 2 })).toThrow('0 <= a')
    expect(() => frameUniformLoadVector(1, 4, { a: 1, b: 5 })).toThrow('0 <= a')
    expect(() => frameDistributedLoadVector({} as { qX: number }, 4)).toThrow('qX or qY')
    expect(() => frameDistributedLoadVector({ qX: Number.NaN }, 4)).toThrow('qX')
  })
})
