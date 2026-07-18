import { describe, expect, it } from 'vitest'
import { calculateEulerBuckling } from '../../../src/core/buckling'

describe('Euler buckling', () => {
  it('uses the weak axis and effective length factor', () => {
    const result = calculateEulerBuckling({
      elasticModulusPa: 200e9,
      lengthM: 2,
      areaM2: 0.03 * 0.06,
      ixM4: 0.03 * 0.06 ** 3 / 12,
      iyM4: 0.06 * 0.03 ** 3 / 12,
      endCondition: 'pinnedPinned',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.controllingAxis).toBe('y')
    expect(result.value.controllingSlenderness).toBeCloseTo(230.9401077, 6)
    expect(result.value.criticalLoadN).toBeCloseTo(66619.830, 0)
    expect(result.value.assessment.status).toBe('notAssessed')
  })

  it.each([
    ['pinnedPinned', 1],
    ['fixedFree', 2],
    ['fixedFixed', 0.5],
    ['fixedPinned', 0.699],
  ] as const)('uses K for %s', (endCondition, factor) => {
    const result = calculateEulerBuckling({
      elasticModulusPa: 70e9, lengthM: 1, areaM2: 1e-3, ixM4: 2e-7, iyM4: 1e-7,
      endCondition,
    })
    expect(result.ok && result.value.effectiveLengthFactor).toBe(factor)
  })

  it('applies only an explicitly supplied slenderness limit', () => {
    const result = calculateEulerBuckling({
      elasticModulusPa: 200e9, lengthM: 2, areaM2: 1e-3, ixM4: 2e-7, iyM4: 1e-7,
      endCondition: 'pinnedPinned', slendernessLimit: 100,
    })
    expect(result.ok && result.value.assessment.status).toBe('meetsLimit')
  })

  it('rejects non-positive geometry and invalid limits', () => {
    const result = calculateEulerBuckling({
      elasticModulusPa: 0, lengthM: -1, areaM2: 0, ixM4: 0, iyM4: 0,
      endCondition: 'pinnedPinned', slendernessLimit: 0,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.length).toBe(6)
  })
})
