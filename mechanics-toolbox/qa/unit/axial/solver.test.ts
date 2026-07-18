import { describe, expect, it } from 'vitest'

import { calculateAxialResponse } from '../../../src/core/axial'

describe('calculateAxialResponse', () => {
  it('combines mechanical elongation and free thermal deformation for a uniform bar', () => {
    const result = calculateAxialResponse({
      boundary: 'free',
      axialForceN: 100_000,
      segments: [{
        id: 's1',
        lengthM: 2,
        areaM2: 1e-3,
        elasticModulusPa: 200e9,
        thermalExpansionPerK: 12e-6,
        deltaTemperatureK: 50,
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.segments[0]?.stressPa).toBeCloseTo(100e6, 6)
    expect(result.value.mechanicalDeformationM).toBeCloseTo(1e-3, 12)
    expect(result.value.freeThermalDeformationM).toBeCloseTo(1.2e-3, 12)
    expect(result.value.totalDeformationM).toBeCloseTo(2.2e-3, 12)
    expect(result.value.constraintForceN).toBe(0)
  })

  it('uses common force and sums deformation for serial segments', () => {
    const result = calculateAxialResponse({
      boundary: 'free',
      axialForceN: 10_000,
      segments: [
        {
          id: 's1', lengthM: 1, areaM2: 1e-3, elasticModulusPa: 200e9,
          thermalExpansionPerK: 0, deltaTemperatureK: 0,
        },
        {
          id: 's2', lengthM: 0.5, areaM2: 0.5e-3, elasticModulusPa: 100e9,
          thermalExpansionPerK: 0, deltaTemperatureK: 0,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.segments.map(({ stressPa }) => stressPa)).toEqual([10e6, 20e6])
    expect(result.value.segments[0]?.mechanicalDeformationM).toBeCloseTo(0.05e-3, 12)
    expect(result.value.segments[1]?.mechanicalDeformationM).toBeCloseTo(0.1e-3, 12)
    expect(result.value.totalDeformationM).toBeCloseTo(0.15e-3, 12)
  })

  it('solves compressive thermal force from explicit full restraint', () => {
    const result = calculateAxialResponse({
      boundary: 'fullyRestrained',
      segments: [{
        id: 's1',
        lengthM: 1,
        areaM2: 1e-3,
        elasticModulusPa: 200e9,
        thermalExpansionPerK: 12e-6,
        deltaTemperatureK: 50,
      }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.appliedForceN).toBe(0)
    expect(result.value.constraintForceN).toBeCloseTo(-120_000, 6)
    expect(result.value.segments[0]?.stressPa).toBeCloseTo(-120e6, 5)
    expect(result.value.mechanicalDeformationM).toBeCloseTo(-0.6e-3, 12)
    expect(result.value.freeThermalDeformationM).toBeCloseTo(0.6e-3, 12)
    expect(result.value.totalDeformationM).toBeCloseTo(0, 12)
  })

  it('enforces only global compatibility for a fully restrained segmented bar', () => {
    const result = calculateAxialResponse({
      boundary: 'fullyRestrained',
      segments: [
        {
          id: 's1', lengthM: 1, areaM2: 1e-3, elasticModulusPa: 200e9,
          thermalExpansionPerK: 12e-6, deltaTemperatureK: 50,
        },
        {
          id: 's2', lengthM: 1, areaM2: 2e-3, elasticModulusPa: 100e9,
          thermalExpansionPerK: 20e-6, deltaTemperatureK: -10,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.constraintForceN).toBeCloseTo(-40_000, 6)
    expect(result.value.segments[0]?.stressPa).toBeCloseTo(-40e6, 5)
    expect(result.value.segments[1]?.stressPa).toBeCloseTo(-20e6, 5)
    expect(result.value.totalDeformationM).toBeCloseTo(0, 12)
    expect(result.value.segments[0]?.totalDeformationM).not.toBeCloseTo(0, 12)
  })

  it.each([
    ['length', { lengthM: 0, areaM2: 1e-3, elasticModulusPa: 200e9 }],
    ['area', { lengthM: 1, areaM2: 0, elasticModulusPa: 200e9 }],
    ['elasticModulus', { lengthM: 1, areaM2: 1e-3, elasticModulusPa: -1 }],
  ])('rejects invalid %s', (field, patch) => {
    const result = calculateAxialResponse({
      boundary: 'free',
      axialForceN: 1,
      segments: [{
        id: 's1',
        lengthM: 1,
        areaM2: 1e-3,
        elasticModulusPa: 200e9,
        thermalExpansionPerK: 12e-6,
        deltaTemperatureK: 0,
        ...patch,
      }],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some(({ field: actual }) => actual.includes(field))).toBe(true)
  })

  it('accepts compression and cooling as negative signed inputs', () => {
    const result = calculateAxialResponse({
      boundary: 'free',
      axialForceN: -20_000,
      segments: [{
        id: 's1', lengthM: 1, areaM2: 1e-3, elasticModulusPa: 200e9,
        thermalExpansionPerK: 12e-6, deltaTemperatureK: -50,
      }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.internalForceN).toBe(-20_000)
    expect(result.value.segments[0]?.stressPa).toBe(-20e6)
    expect(result.value.totalDeformationM).toBeCloseTo(-0.7e-3, 12)
  })
})
