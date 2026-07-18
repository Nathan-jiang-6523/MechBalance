import { describe, expect, it } from 'vitest'
import {
  calculateCircularShaftTorsion,
  solvePowerTransmission,
  TorsionCalculationError,
} from '../../../src/core/torsion'

describe('calculateCircularShaftTorsion', () => {
  it('calculates a solid shaft with the exact circular J', () => {
    const result = calculateCircularShaftTorsion({
      kind: 'solid',
      diameterM: 0.05,
      lengthM: 1,
      shearModulusPa: 80e9,
      torqueNm: 1000,
    })

    expect(result.torsionConstantM4).toBeCloseTo(Math.PI * 0.05 ** 4 / 32, 16)
    expect(result.maximumShearStressPa).toBeCloseTo(40.7436654315e6, 1)
    expect(result.twistAngleRad).toBeCloseTo(0.0203718327158, 12)
  })

  it('calculates a circular tube', () => {
    const result = calculateCircularShaftTorsion({
      kind: 'tube',
      outerDiameterM: 0.06,
      innerDiameterM: 0.04,
      lengthM: 1.2,
      shearModulusPa: 79e9,
      torqueNm: 750,
    })
    const expectedJ = Math.PI * (0.06 ** 4 - 0.04 ** 4) / 32
    expect(result.torsionConstantM4).toBeCloseTo(expectedJ, 16)
    expect(result.maximumShearStressPa).toBeCloseTo(750 * 0.03 / expectedJ, 4)
    expect(result.twistAngleRad).toBeCloseTo(750 * 1.2 / (79e9 * expectedJ), 12)
  })

  it('reverses stress and twist signs when torque reverses', () => {
    const positive = calculateCircularShaftTorsion({
      kind: 'solid', diameterM: 0.04, lengthM: 0.6, shearModulusPa: 81e9, torqueNm: 320,
    })
    const negative = calculateCircularShaftTorsion({
      kind: 'solid', diameterM: 0.04, lengthM: 0.6, shearModulusPa: 81e9, torqueNm: -320,
    })
    expect(negative.maximumShearStressPa).toBe(-positive.maximumShearStressPa)
    expect(negative.maximumAbsoluteShearStressPa).toBe(positive.maximumAbsoluteShearStressPa)
    expect(negative.twistAngleRad).toBe(-positive.twistAngleRad)
  })

  it('returns zero response for zero torque', () => {
    const result = calculateCircularShaftTorsion({
      kind: 'solid', diameterM: 0.04, lengthM: 1, shearModulusPa: 80e9, torqueNm: 0,
    })
    expect(result.maximumShearStressPa).toBe(0)
    expect(result.twistAngleRad).toBe(0)
  })

  it.each([
    [{ kind: 'solid', diameterM: 0, lengthM: 1, shearModulusPa: 80e9, torqueNm: 1 } as const, 'NON_POSITIVE_DIAMETER'],
    [{ kind: 'tube', outerDiameterM: 0.04, innerDiameterM: 0.04, lengthM: 1, shearModulusPa: 80e9, torqueNm: 1 } as const, 'INVALID_TUBE_GEOMETRY'],
    [{ kind: 'tube', outerDiameterM: 0.04, innerDiameterM: -0.01, lengthM: 1, shearModulusPa: 80e9, torqueNm: 1 } as const, 'INVALID_TUBE_GEOMETRY'],
    [{ kind: 'solid', diameterM: 0.04, lengthM: 0, shearModulusPa: 80e9, torqueNm: 1 } as const, 'NON_POSITIVE_LENGTH'],
    [{ kind: 'solid', diameterM: 0.04, lengthM: 1, shearModulusPa: 0, torqueNm: 1 } as const, 'NON_POSITIVE_SHEAR_MODULUS'],
  ])('rejects invalid geometry or material: %s', (input, code) => {
    try {
      calculateCircularShaftTorsion(input)
      throw new Error('expected failure')
    } catch (error) {
      expect(error).toBeInstanceOf(TorsionCalculationError)
      expect((error as TorsionCalculationError).code).toBe(code)
    }
  })
})

describe('solvePowerTransmission', () => {
  it('solves power from signed torque and speed', () => {
    const result = solvePowerTransmission({ solveFor: 'power', torqueNm: 100, rotationalSpeedRps: 25 })
    expect(result.powerW).toBeCloseTo(5000 * Math.PI, 9)
    expect(result.angularSpeedRadPerS).toBeCloseTo(50 * Math.PI, 12)
  })

  it('solves torque from 10 kW at 1500 r/min', () => {
    const result = solvePowerTransmission({ solveFor: 'torque', powerW: 10000, rotationalSpeedRps: 25 })
    expect(result.torqueNm).toBeCloseTo(63.6619772368, 9)
  })

  it('solves speed from power and torque', () => {
    const result = solvePowerTransmission({ solveFor: 'speed', powerW: 10000, torqueNm: 100 })
    expect(result.rotationalSpeedRps * 60).toBeCloseTo(954.929658551, 9)
  })

  it('keeps power sign consistent with signed torque', () => {
    const result = solvePowerTransmission({ solveFor: 'power', torqueNm: -100, rotationalSpeedRps: 25 })
    expect(result.powerW).toBeLessThan(0)
  })

  it('allows matching negative power and torque when solving speed', () => {
    const result = solvePowerTransmission({ solveFor: 'speed', powerW: -10000, torqueNm: -100 })
    expect(result.rotationalSpeedRps).toBeGreaterThan(0)
  })

  it.each([
    [{ solveFor: 'torque', powerW: 1000, rotationalSpeedRps: 0 } as const, 'ZERO_SPEED_DIVISOR'],
    [{ solveFor: 'speed', powerW: 1000, torqueNm: 0 } as const, 'ZERO_TORQUE_DIVISOR'],
    [{ solveFor: 'power', torqueNm: 100, rotationalSpeedRps: -1 } as const, 'NEGATIVE_SPEED'],
    [{ solveFor: 'speed', powerW: -1000, torqueNm: 10 } as const, 'NEGATIVE_SOLVED_SPEED'],
    [{ solveFor: 'power', torqueNm: 100 } as const, 'MISSING_KNOWN_VALUE'],
  ])('rejects invalid power relation: %s', (input, code) => {
    expect(() => solvePowerTransmission(input)).toThrowError(
      expect.objectContaining({ code }),
    )
  })
})
