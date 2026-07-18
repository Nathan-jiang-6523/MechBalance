import { describe, expect, it } from 'vitest'

import { findBeamExtrema, solveBeam, type BeamModel, type BeamSolution } from '../../../src/core/beam'

const E = 200e9
const I = 8e-6

function solve(model: BeamModel): BeamSolution {
  const result = solveBeam(model)
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('; '))
  return result.value
}

describe('解析场极值搜索', () => {
  it('BEAM-SS-P-01：由 θ=0 解析定位挠度最小值', () => {
    const solution = solve({
      lengthM: 1,
      elasticModulusPa: E,
      secondMomentM4: I,
      support: 'simplySupported',
      loads: [{ type: 'pointForce', positionM: 0.4, forceN: -10_000 }],
    })
    const extrema = findBeamExtrema(solution)

    expect(extrema.deflectionM.minimum.xM).toBeCloseTo(0.470849738, 8)
    expect(extrema.deflectionM.minimum.value).toBeCloseTo(-0.0001234683945, 12)
    expect(extrema.deflectionM.minimum.reasons).toContain('stationary')
    expect(extrema.momentNm.maximum.xM).toBeCloseTo(0.4, 12)
  })

  it('BEAM-MULTI-01：多载荷分段内定位 θ=0', () => {
    const solution = solve({
      lengthM: 1,
      elasticModulusPa: E,
      secondMomentM4: I,
      support: 'simplySupported',
      loads: [
        { type: 'pointForce', positionM: 0.25, forceN: -4000 },
        { type: 'pointMoment', positionM: 0.5, momentNm: 400 },
        { type: 'uniformLoad', startM: 0.5, endM: 1, intensityNPerM: -4000 },
      ],
    })
    const extrema = findBeamExtrema(solution)

    expect(extrema.deflectionM.minimum.xM).toBeCloseTo(0.443152542, 8)
    expect(extrema.deflectionM.minimum.value).toBeCloseTo(-0.0000530465518, 12)
    expect(extrema.momentNm.maximum.xM).toBeCloseTo(0.25, 12)
    expect(extrema.shearN.minimum.value).toBeCloseTo(-2100, 9)
  })

  it('均布载荷以 V=0 根定位弯矩极值，不依赖绘图采样', () => {
    const solution = solve({
      lengthM: 1,
      elasticModulusPa: E,
      secondMomentM4: I,
      support: 'simplySupported',
      loads: [{ type: 'uniformLoad', startM: 0, endM: 1, intensityNPerM: -10_000 }],
    })
    const extrema = findBeamExtrema(solution)

    expect(extrema.momentNm.maximum.xM).toBeCloseTo(0.5, 11)
    expect(extrema.momentNm.maximum.value).toBeCloseTo(1250, 9)
    expect(extrema.rotationRad.minimum.xM).toBe(0)
    expect(extrema.rotationRad.maximum.xM).toBe(1)
  })

  it('内部集中力和集中力矩保留左右候选', () => {
    const solution = solve({
      lengthM: 1,
      elasticModulusPa: E,
      secondMomentM4: I,
      support: 'simplySupported',
      loads: [
        { type: 'pointForce', positionM: 0.4, forceN: -10_000 },
        { type: 'pointMoment', positionM: 0.6, momentNm: 500 },
      ],
    })
    const extrema = findBeamExtrema(solution)
    const shearAtForce = extrema.shearN.candidates.filter((candidate) => candidate.xM === 0.4)
    const momentAtMoment = extrema.momentNm.candidates.filter((candidate) => candidate.xM === 0.6)

    expect(shearAtForce.map((candidate) => candidate.side)).toEqual(['left', 'right'])
    expect(shearAtForce[1]!.value - shearAtForce[0]!.value).toBeCloseTo(-10_000, 9)
    expect(momentAtMoment.map((candidate) => candidate.side)).toEqual(['left', 'right'])
    expect(momentAtMoment[1]!.value - momentAtMoment[0]!.value).toBeCloseTo(-500, 9)
  })

  it('自由端集中力的场极值使用梁内左极限', () => {
    const solution = solve({
      lengthM: 1,
      elasticModulusPa: E,
      secondMomentM4: I,
      support: 'cantileverLeft',
      loads: [{ type: 'pointForce', positionM: 1, forceN: -10_000 }],
    })
    const extrema = findBeamExtrema(solution)

    expect(extrema.shearN.minimum.value).toBeCloseTo(10_000, 9)
    expect(extrema.shearN.maximum.value).toBeCloseTo(10_000, 9)
    expect(extrema.deflectionM.minimum.xM).toBe(1)
  })
})
