import { describe, expect, it } from 'vitest'

import { solveBeam, type BeamModel } from '../../../src/core/beam'

const base = {
  lengthM: 1,
  elasticModulusPa: 200e9,
  secondMomentM4: 8e6 / 1e12,
} as const

const expectClose = (actual: number, expected: number, digits = 9) =>
  expect(actual).toBeCloseTo(expected, digits)

function solved(model: BeamModel) {
  const result = solveBeam(model)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.value
}

describe('Euler-Bernoulli analytic beam solver', () => {
  it('BEAM-SS-P-01 point force', () => {
    const solution = solved({
      ...base,
      support: 'simplySupported',
      loads: [{ type: 'pointForce', positionM: 0.4, forceN: -10_000 }],
    })
    expectClose(solution.reactions.leftForceN, 6_000)
    expectClose(solution.reactions.rightForceN, 4_000)
    const left = solution.evaluate(0.4, 'left')
    const right = solution.evaluate(0.4, 'right')
    expectClose(left.shearN, 6_000)
    expectClose(right.shearN, -4_000)
    expectClose(left.momentNm * 1_000, 2_400_000)
    expectClose(left.rotationRad, -1e-4)
    expectClose(left.deflectionM * 1_000, -0.12)
    expectClose(solution.balanceResidual.forceN, 0)
    expectClose(solution.balanceResidual.momentAboutLeftNm, 0)
  })

  it('BEAM-SS-Q-01 full uniform load', () => {
    const solution = solved({
      ...base,
      support: 'simplySupported',
      loads: [{ type: 'uniformLoad', startM: 0, endM: 1, intensityNPerM: -10_000 }],
    })
    const middle = solution.evaluate(0.5)
    expectClose(solution.reactions.leftForceN, 5_000)
    expectClose(solution.reactions.rightForceN, 5_000)
    expectClose(middle.shearN, 0)
    expectClose(middle.momentNm * 1_000, 1_250_000)
    expectClose(middle.rotationRad, 0)
    expectClose(middle.deflectionM * 1_000, -0.0813802083, 8)
  })

  it('BEAM-SS-M-01 keeps moment jump', () => {
    const solution = solved({
      ...base,
      support: 'simplySupported',
      loads: [{ type: 'pointMoment', positionM: 0.4, momentNm: 1_000 }],
    })
    expectClose(solution.reactions.leftForceN, 1_000)
    expectClose(solution.reactions.rightForceN, -1_000)
    expectClose(solution.evaluate(0.4, 'left').momentNm, 400)
    expectClose(solution.evaluate(0.4, 'right').momentNm, -600)
    expectClose(solution.evaluate(0.4).deflectionM * 1_000, 0.01)
  })

  it('BEAM-SS-Q-02 partial uniform load', () => {
    const solution = solved({
      ...base,
      support: 'simplySupported',
      loads: [{ type: 'uniformLoad', startM: 0.25, endM: 0.75, intensityNPerM: -10_000 }],
    })
    expectClose(solution.reactions.leftForceN, 2_500)
    expectClose(solution.reactions.rightForceN, 2_500)
    const quarter = solution.evaluate(0.25)
    expectClose(quarter.shearN, 2_500)
    expectClose(quarter.momentNm * 1_000, 625_000)
    expectClose(quarter.rotationRad, -1.302083333e-4, 12)
    expectClose(quarter.deflectionM * 1_000, -0.0406901042, 9)
    const middle = solution.evaluate(0.5)
    expectClose(middle.momentNm * 1_000, 937_500)
    expectClose(middle.rotationRad, 0)
    expectClose(middle.deflectionM * 1_000, -0.0579833984, 9)
  })

  it('BEAM-CF-P-01 left-fixed end force', () => {
    const solution = solved({
      ...base,
      support: 'cantileverLeft',
      loads: [{ type: 'pointForce', positionM: 1, forceN: -10_000 }],
    })
    expectClose(solution.reactions.leftForceN, 10_000)
    expectClose(solution.reactions.leftMomentNm * 1_000, 10_000_000)
    expectClose(solution.evaluate(0, 'right').momentNm * 1_000, -10_000_000)
    const freeLeft = solution.evaluate(1, 'left')
    expectClose(freeLeft.shearN, 10_000)
    expectClose(freeLeft.momentNm, 0)
    expectClose(freeLeft.rotationRad, -0.003125)
    expectClose(freeLeft.deflectionM * 1_000, -2.083333333, 8)
  })

  it('BEAM-CF-Q-01 full uniform load', () => {
    const solution = solved({
      ...base,
      support: 'cantileverLeft',
      loads: [{ type: 'uniformLoad', startM: 0, endM: 1, intensityNPerM: -10_000 }],
    })
    expectClose(solution.reactions.leftForceN, 10_000)
    expectClose(solution.reactions.leftMomentNm * 1_000, 5_000_000)
    const middle = solution.evaluate(0.5)
    expectClose(middle.shearN, 5_000)
    expectClose(middle.momentNm * 1_000, -1_250_000)
    expectClose(middle.rotationRad, -9.114583333e-4, 12)
    expectClose(middle.deflectionM * 1_000, -0.2766927083, 9)
    const free = solution.evaluate(1)
    expectClose(free.shearN, 0)
    expectClose(free.momentNm, 0)
    expectClose(free.deflectionM * 1_000, -0.78125)
  })

  it('BEAM-CF-Q-02 partial uniform load', () => {
    const solution = solved({
      ...base,
      support: 'cantileverLeft',
      loads: [{ type: 'uniformLoad', startM: 0.5, endM: 1, intensityNPerM: -10_000 }],
    })
    expectClose(solution.reactions.leftForceN, 5_000)
    expectClose(solution.reactions.leftMomentNm * 1_000, 3_750_000)
    const start = solution.evaluate(0.5)
    expectClose(start.shearN, 5_000)
    expectClose(start.momentNm * 1_000, -1_250_000)
    expectClose(start.rotationRad, -7.8125e-4)
    expectClose(start.deflectionM * 1_000, -0.2278645833, 9)
    expectClose(solution.evaluate(1).deflectionM * 1_000, -0.6673177083, 9)
  })

  it('BEAM-CF-M-01 free-end moment', () => {
    const solution = solved({
      ...base,
      support: 'cantileverLeft',
      loads: [{ type: 'pointMoment', positionM: 1, momentNm: -1_000 }],
    })
    expectClose(solution.reactions.leftForceN, 0)
    expectClose(solution.reactions.leftMomentNm, 1_000)
    const freeLeft = solution.evaluate(1, 'left')
    expectClose(freeLeft.shearN, 0)
    expectClose(freeLeft.momentNm, -1_000)
    expectClose(freeLeft.rotationRad, -6.25e-4)
    expectClose(freeLeft.deflectionM * 1_000, -0.3125)
    expectClose(solution.evaluate(1, 'right').momentNm, 0)
  })

  it('BEAM-MULTI-01 superposes three load types independent of order', () => {
    const loads: BeamModel['loads'] = [
      { type: 'pointForce', positionM: 0.25, forceN: -4_000 },
      { type: 'pointMoment', positionM: 0.5, momentNm: 400 },
      { type: 'uniformLoad', startM: 0.5, endM: 1, intensityNPerM: -4_000 },
    ]
    const solution = solved({ ...base, support: 'simplySupported', loads })
    const reversed = solved({ ...base, support: 'simplySupported', loads: [...loads].reverse() })
    expectClose(solution.reactions.leftForceN, 3_900)
    expectClose(solution.reactions.rightForceN, 2_100)
    const at250Left = solution.evaluate(0.25, 'left')
    const at250Right = solution.evaluate(0.25, 'right')
    expectClose(at250Left.shearN, 3_900)
    expectClose(at250Right.shearN, -100)
    expectClose(at250Left.momentNm * 1_000, 975_000)
    const at500Left = solution.evaluate(0.5, 'left')
    const at500Right = solution.evaluate(0.5, 'right')
    expectClose(at500Left.momentNm * 1_000, 950_000)
    expectClose(at500Right.momentNm * 1_000, 550_000)
    for (const x of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const expected = solution.evaluate(x)
      const actual = reversed.evaluate(x)
      expectClose(actual.shearN, expected.shearN)
      expectClose(actual.momentNm, expected.momentNm)
      expectClose(actual.rotationRad, expected.rotationRad, 14)
      expectClose(actual.deflectionM, expected.deflectionM, 14)
    }
  })

  it('mirrors left cantilever to right-fixed global coordinates', () => {
    const solution = solved({
      ...base,
      support: 'cantileverRight',
      loads: [{ type: 'pointForce', positionM: 0, forceN: -10_000 }],
    })
    expectClose(solution.reactions.rightForceN, 10_000)
    expectClose(solution.reactions.rightMomentNm * 1_000, -10_000_000)
    const freeRight = solution.evaluate(0, 'right')
    expectClose(freeRight.deflectionM * 1_000, -2.083333333, 8)
    expectClose(freeRight.rotationRad, 0.003125)
    const fixedLeft = solution.evaluate(1, 'left')
    expectClose(fixedLeft.deflectionM, 0)
    expectClose(fixedLeft.rotationRad, 0)
  })

  it('mirrors full and partial uniform loads to a right-fixed cantilever', () => {
    const full = solved({
      ...base,
      support: 'cantileverRight',
      loads: [{ type: 'uniformLoad', startM: 0, endM: 1, intensityNPerM: -10_000 }],
    })
    expectClose(full.evaluate(0, 'right').momentNm, 0)
    expectClose(full.evaluate(0.5).momentNm, -1_250)
    expectClose(full.evaluate(1, 'left').momentNm, -5_000)
    expectClose(full.reactions.rightMomentNm, -5_000)

    const partial = solved({
      ...base,
      support: 'cantileverRight',
      loads: [{ type: 'uniformLoad', startM: 0, endM: 0.5, intensityNPerM: -10_000 }],
    })
    expectClose(partial.evaluate(0, 'right').momentNm, 0)
    expectClose(partial.evaluate(0.5, 'right').momentNm, -1_250)
    expectClose(partial.evaluate(1, 'left').momentNm, -3_750)
    expectClose(partial.reactions.rightMomentNm, -3_750)
  })

  it('mirrors a free-end point moment to a right-fixed cantilever', () => {
    const solution = solved({
      ...base,
      support: 'cantileverRight',
      loads: [{ type: 'pointMoment', positionM: 0, momentNm: 1_000 }],
    })
    expectClose(solution.reactions.rightMomentNm, -1_000)
    expectClose(solution.evaluate(0, 'right').momentNm, -1_000)
    expectClose(solution.evaluate(0.5).momentNm, -1_000)
    expectClose(solution.evaluate(1, 'left').momentNm, -1_000)
  })

  it('enforces simply-supported force position and raw load limit', () => {
    expect(solveBeam({
      ...base,
      support: 'simplySupported',
      loads: [{ type: 'pointForce', positionM: 0, forceN: 1 }],
    }).ok).toBe(false)
    expect(solveBeam({
      ...base,
      support: 'cantileverLeft',
      loads: Array.from({ length: 11 }, (_, index) => ({
        type: 'pointForce' as const,
        positionM: index / 10,
        forceN: 1,
      })),
    }).ok).toBe(false)
  })
})
