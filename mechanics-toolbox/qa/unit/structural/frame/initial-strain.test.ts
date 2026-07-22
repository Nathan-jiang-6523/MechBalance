import { describe, expect, it } from 'vitest'

import {
  frameFreeStrain,
  frameInitialStrainLoadVector,
} from '../../../../src/core/structural/frame'

describe('P2 frame uniform temperature and initial strain load', () => {
  it('matches FRAME-T01 equivalent local vector', () => {
    const strain = frameFreeStrain(12e-6, 50)
    expect(strain).toBeCloseTo(600e-6, 15)
    const load = frameInitialStrainLoadVector(200e9, 0.001, strain)
    ;[-120_000, 0, 0, 120_000, 0, 0].forEach((value, index) => {
      expect(load[index]).toBeCloseTo(value, 9)
    })
  })

  it('matches FRAME-IS01 and superposes free strains', () => {
    expect(frameInitialStrainLoadVector(200e9, 0.001, 500e-6)).toEqual([
      -100_000, 0, 0, 100_000, 0, 0,
    ])
    expect(frameFreeStrain(12e-6, 50, 500e-6)).toBeCloseTo(1.1e-3, 15)
  })

  it('introduces no shear or bending components', () => {
    const load = frameInitialStrainLoadVector(70e9, 0.002, -300e-6)
    expect(load[1]).toBe(0)
    expect(load[2]).toBe(0)
    expect(load[4]).toBe(0)
    expect(load[5]).toBe(0)
  })

  it('rejects invalid material and strain data', () => {
    expect(() => frameInitialStrainLoadVector(0, 1, 1)).toThrow('positive')
    expect(() => frameInitialStrainLoadVector(1, 1, Number.NaN)).toThrow('finite')
    expect(() => frameFreeStrain(Number.NaN, 1)).toThrow('finite')
  })
})
