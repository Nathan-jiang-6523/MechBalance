import { describe, expect, it } from 'vitest'
import { solvePlaneStress } from '../../../src/core/stress'

const MPa = 1e6

describe('plane stress core', () => {
  it('solves uniaxial tension', () => {
    const result = solvePlaneStress({ sigmaXPa: 100 * MPa, sigmaYPa: 0, tauXyPa: 0 })
    expect(result.sigma1Pa / MPa).toBeCloseTo(100, 12)
    expect(result.sigma2Pa).toBe(0)
    expect(result.principalAngleRad).toBe(0)
    expect(result.maxInPlaneShearPa / MPa).toBeCloseTo(50, 12)
    expect(result.vonMisesPa / MPa).toBeCloseTo(100, 12)
    expect(result.trescaPa / MPa).toBeCloseTo(100, 12)
    expect(result.principalStressesPa.map((value) => value / MPa)).toEqual([100, 0, 0])
  })

  it('solves pure shear and physical principal angle', () => {
    const result = solvePlaneStress({ sigmaXPa: 0, sigmaYPa: 0, tauXyPa: 50 * MPa })
    expect(result.sigma1Pa / MPa).toBeCloseTo(50, 12)
    expect(result.sigma2Pa / MPa).toBeCloseTo(-50, 12)
    expect((result.principalAngleRad! * 180) / Math.PI).toBeCloseTo(45, 12)
    expect(result.vonMisesPa / MPa).toBeCloseTo(50 * Math.sqrt(3), 12)
    expect(result.trescaPa / MPa).toBeCloseTo(100, 12)
  })

  it('keeps equibiaxial plane stress stable and marks direction arbitrary', () => {
    const result = solvePlaneStress({ sigmaXPa: 80 * MPa, sigmaYPa: 80 * MPa, tauXyPa: 0 })
    expect(result.mohrRadiusPa).toBe(0)
    expect(result.sigma1Pa / MPa).toBe(80)
    expect(result.sigma2Pa / MPa).toBe(80)
    expect(result.principalAngleRad).toBeNull()
    expect(result.maxInPlaneShearAngleRad).toBeNull()
    expect(result.principalStressesPa.map((value) => value / MPa)).toEqual([80, 80, 0])
    expect(result.vonMisesPa / MPa).toBeCloseTo(80, 12)
    expect(result.trescaPa / MPa).toBeCloseTo(80, 12)
    expect(Object.values(result).some((value) => typeof value === 'number' && Number.isNaN(value))).toBe(false)
  })

  it('computes optional utilization and overload', () => {
    const result = solvePlaneStress({
      sigmaXPa: 100 * MPa,
      sigmaYPa: 0,
      tauXyPa: 100 * MPa,
      strengthPa: 150 * MPa,
    })
    expect(result.utilization).not.toBeNull()
    expect(result.utilization?.controllingCriterion).toBe('tresca')
    expect(result.utilization?.exceedsStrength).toBe(true)
  })

  it.each([
    { sigmaXPa: Number.NaN, sigmaYPa: 0, tauXyPa: 0 },
    { sigmaXPa: 0, sigmaYPa: Number.POSITIVE_INFINITY, tauXyPa: 0 },
    { sigmaXPa: 0, sigmaYPa: 0, tauXyPa: 0, strengthPa: 0 },
  ])('rejects invalid stress input %#', (input) => {
    expect(() => solvePlaneStress(input)).toThrow(RangeError)
  })
})
