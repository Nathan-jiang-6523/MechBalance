import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BEAM_BASE_SAMPLE_COUNT,
  findBeamExtrema,
  sampleBeamSolution,
  solveBeam,
  type BeamModel,
  type BeamSolution,
} from '../../../src/core/beam'

function solve(model: BeamModel): BeamSolution {
  const result = solveBeam(model)
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('; '))
  return result.value
}

const pointLoadModel: BeamModel = {
  lengthM: 1,
  elasticModulusPa: 200e9,
  secondMomentM4: 8e-6,
  support: 'simplySupported',
  loads: [{ type: 'pointForce', positionM: 0.413, forceN: -10_000 }],
}

describe('梁曲线采样', () => {
  it('默认包含 401 个基础点和两端点', () => {
    const samples = sampleBeamSolution(solve(pointLoadModel))
    expect(samples.filter((sample) => sample.reasons.includes('base'))).toHaveLength(
      DEFAULT_BEAM_BASE_SAMPLE_COUNT,
    )
    expect(samples.some((sample) => sample.xM === 0)).toBe(true)
    expect(samples.some((sample) => sample.xM === 1)).toBe(true)
  })

  it('强制包含非网格载荷位置左右值', () => {
    const samples = sampleBeamSolution(solve(pointLoadModel))
    const jump = samples.filter((sample) => sample.xM === 0.413)

    expect(jump.map((sample) => sample.side)).toEqual(['left', 'right'])
    expect(jump.every((sample) => sample.reasons.includes('discontinuity'))).toBe(true)
    expect(jump[1]!.shearN - jump[0]!.shearN).toBeCloseTo(-10_000, 9)
  })

  it('端点载荷只采样梁内侧，避免绘制梁外虚假弯矩跳变', () => {
    const solution = solve({
      ...pointLoadModel,
      support: 'cantileverLeft',
      loads: [{ type: 'pointMoment', positionM: 0, momentNm: 1_000 }],
    })
    const samples = sampleBeamSolution(solution)
    const atLeftEnd = samples.filter((sample) => sample.xM === 0)

    expect(atLeftEnd.map((sample) => sample.side)).toEqual(['right'])
    expect(atLeftEnd[0]!.momentNm).toBeCloseTo(0, 12)
  })

  it('强制包含解析极值点', () => {
    const solution = solve({ ...pointLoadModel, loads: [{ ...pointLoadModel.loads[0]!, positionM: 0.4 }] })
    const extrema = findBeamExtrema(solution)
    const samples = sampleBeamSolution(solution, extrema)
    const minimumX = extrema.deflectionM.minimum.xM
    const minimumSample = samples.find(
      (sample) => Math.abs(sample.xM - minimumX) < 1e-14 && sample.side === 'right',
    )

    expect(minimumX).toBeCloseTo(0.470849738, 8)
    expect(minimumSample?.reasons).toContain('extremum')
  })

  it('粗基础网格下按曲率自适应细化', () => {
    const solution = solve({
      ...pointLoadModel,
      loads: [{ type: 'uniformLoad', startM: 0, endM: 1, intensityNPerM: -10_000 }],
    })
    const samples = sampleBeamSolution(solution, findBeamExtrema(solution), {
      basePointCount: 3,
      relativeTolerance: 1e-4,
      maxRefinementDepth: 4,
    })

    expect(samples.some((sample) => sample.reasons.includes('adaptive'))).toBe(true)
    expect(samples.length).toBeGreaterThan(3)
  })

  it('拒绝非法采样配置', () => {
    const solution = solve(pointLoadModel)
    expect(() => sampleBeamSolution(solution, findBeamExtrema(solution), { basePointCount: 1 })).toThrow(
      RangeError,
    )
    expect(() =>
      sampleBeamSolution(solution, findBeamExtrema(solution), { relativeTolerance: 0 }),
    ).toThrow(RangeError)
  })
})
