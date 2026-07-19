import { describe, expect, it } from 'vitest'

import {
  findFrameFiberStressExtrema,
  findFrameInternalForceExtrema,
  frameInternalForceControlPositions,
  sampleFrameInternalForceField,
} from '../../../../src/core/structural/frame/extrema'

describe('P2 frame analytic control positions and extrema', () => {
  it('finds FRAME-A02 M max at x=2 without relying on plot sampling', () => {
    const input = {
      elementId: 'FRAME-A02',
      L: 4,
      elementOnNodeEndForces: [0, -20_000, -40_000 / 3, 0, -20_000, 40_000 / 3] as const,
      distributedLoads: [{ qX: 0, qY: -10_000, a: 0, b: 4 }],
    }
    const extrema = findFrameInternalForceExtrema(input)
    const maximum = extrema.find(({ field, kind }) => field === 'M' && kind === 'max')!
    expect(maximum).toMatchObject({
      elementId: 'FRAME-A02', field: 'M', kind: 'max', localX: 2, unit: 'N*m',
    })
    expect(maximum.value).toBeCloseTo(20_000 / 3, 10)

    // intervalCount=3 omits x=2 in its uniform grid; analytic control point must remain.
    const samples = sampleFrameInternalForceField(input, 3)
    expect(samples.some(({ localX }) => localX === 2)).toBe(true)
  })

  it('finds FRAME-A03 M max=11250 at x=1.5 and retains segment end', () => {
    const input = {
      elementId: 'FRAME-A03',
      L: 4,
      elementOnNodeEndForces: [0, -15_000, 0, 0, -5_000, 0] as const,
      distributedLoads: [{ qX: 0, qY: -10_000, a: 0, b: 2 }],
    }
    expect(frameInternalForceControlPositions(input)).toEqual([0, 1.5, 2, 4])
    expect(findFrameInternalForceExtrema(input).find(
      ({ field, kind }) => field === 'M' && kind === 'max',
    )).toEqual({
      elementId: 'FRAME-A03', field: 'M', kind: 'max', localX: 1.5,
      value: 11_250, unit: 'N*m',
    })
    expect(sampleFrameInternalForceField(input, 3).map(({ localX }) => localX)).toContain(2)
  })

  it('keeps every endpoint/load boundary across multiple segments', () => {
    const input = {
      elementId: 'segments',
      L: 5,
      elementOnNodeEndForces: [0, -4_000, 0, 0, -4_000, -7_000] as const,
      distributedLoads: [
        { qX: 0, qY: -2_000, a: 1, b: 2 },
        { qX: 0, qY: -3_000, a: 3, b: 5 },
      ],
    }
    const controls = frameInternalForceControlPositions(input)
    expect(controls).toEqual(expect.arrayContaining([0, 1, 2, 3, 5]))
    const samples = sampleFrameInternalForceField(input, 2).map(({ localX }) => localX)
    for (const position of [0, 1, 2, 3, 5]) expect(samples).toContain(position)
  })

  it('does not merge distinct short load segments during plotting enrichment', () => {
    const split = 1 + 5e-13
    const segmentLength = split - 1
    const qY = -1_000
    const endV = qY * segmentLength
    const endM = qY * (segmentLength - segmentLength * segmentLength / 2)
    const input = {
      elementId: 'short-segment',
      L: 2,
      elementOnNodeEndForces: [0, 0, 0, 0, endV, -endM] as const,
      distributedLoads: [{ qX: 0, qY, a: 1, b: split }],
    }
    const positions = sampleFrameInternalForceField(input, 2).map(({ localX }) => localX)
    expect(positions).toContain(1)
    expect(positions).toContain(split)
  })

  it('returns endpoint extrema for unloaded constant fields and deterministic ties', () => {
    const input = {
      elementId: 'unloaded',
      L: 2,
      elementOnNodeEndForces: [1_000, -500, 200, -1_000, 500, -1_200] as const,
    }
    expect(frameInternalForceControlPositions(input)).toEqual([0, 2])
    const extrema = findFrameInternalForceExtrema(input)
    expect(extrema.find(({ field, kind }) => field === 'N' && kind === 'min')).toMatchObject({
      localX: 0, value: 1_000, unit: 'N',
    })
    expect(extrema.find(({ field, kind }) => field === 'M' && kind === 'max')).toMatchObject({
      localX: 2, value: 1_200, unit: 'N*m',
    })
  })

  it('uses same exact candidates for fiber stress and validates sampling count', () => {
    const input = {
      elementId: 'fiber',
      L: 4,
      elementOnNodeEndForces: [0, -20_000, -40_000 / 3, 0, -20_000, 40_000 / 3] as const,
      distributedLoads: [{ qX: 0, qY: -10_000, a: 0, b: 4 }],
    }
    const stress = findFrameFiberStressExtrema(input, 0.12, 0.01, 8e-5)
    const minimum = stress.find(({ kind }) => kind === 'min')!
    expect(minimum).toMatchObject({
      elementId: 'fiber', field: 'stress', localX: 2, unit: 'Pa', fiberY: 0.12,
    })
    expect(minimum.value).toBeCloseTo(-10e6, 6)
    expect(() => sampleFrameInternalForceField(input, 0)).toThrow('positive integer')
  })

  it('finds axial-force and fiber-stress controls under qX and qY', () => {
    const input = {
      elementId: 'combined-load',
      L: 4,
      elementOnNodeEndForces: [
        0, -20_000, -40_000 / 3, 120_000, -20_000, 40_000 / 3,
      ] as const,
      distributedLoads: [{ qX: 30_000, qY: -10_000, a: 0, b: 4 }],
    }
    const forceExtrema = findFrameInternalForceExtrema(input)
    expect(forceExtrema.find(({ field, kind }) => field === 'N' && kind === 'min')).toMatchObject({
      localX: 4, value: -120_000, unit: 'N',
    })
    const stressExtrema = findFrameFiberStressExtrema(input, 0.12, 0.01, 8e-5)
    const minimum = stressExtrema.find(({ kind }) => kind === 'min')!
    expect(minimum.localX).toBeCloseTo(2.2, 12)
    expect(minimum.value).toBeCloseTo(-16.3e6, 6)
  })
})
