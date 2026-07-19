import { describe, expect, it } from 'vitest'

import {
  beamDisplacementPolynomials,
  beamInternalForcePolynomials,
  findBeamElementExtrema,
  realPolynomialRootsInInterval,
  recoverBeamDisplacementAt,
  recoverBeamInternalForcesAt,
} from '../../../../src/core/structural/beam'
import type { BeamVector6 } from '../../../../src/core/structural/beam'

describe('P2-2 beam field recovery and extrema', () => {
  const E = 200e9
  const I = 8e-5
  const L = 4
  const qY = -10_000
  const fixedDisplacement: BeamVector6 = [0, 0, 0, 0, 0, 0]
  const fixedEndForces: BeamVector6 = [
    0, -20_000, -40_000 / 3, 0, -20_000, 40_000 / 3,
  ]

  it('recovers exact fixed-fixed UDL N/V/M field and endpoint limits', () => {
    const input = { L, qY, elementOnNodeEndForces: fixedEndForces }
    expect(recoverBeamInternalForcesAt(input, 0)).toEqual({ N: 0, V: 20_000, M: -40_000 / 3 })
    const middle = recoverBeamInternalForcesAt(input, 2)
    expect(middle.N).toBe(0)
    expect(middle.V).toBe(0)
    expect(middle.M).toBeCloseTo(20_000 / 3, 10)
    const right = recoverBeamInternalForcesAt(input, 4)
    expect(right.N).toBe(0)
    expect(right.V).toBe(-20_000)
    expect(right.M).toBeCloseTo(-40_000 / 3, 10)
  })

  it('recovers u/v/theta with Hermite interpolation and UDL bubble', () => {
    const input = { E, I, L, qY, localDisplacements: fixedDisplacement }
    expect(recoverBeamDisplacementAt(input, 0)).toEqual({ u: 0, v: 0, theta: 0 })
    const middle = recoverBeamDisplacementAt(input, 2)
    expect(middle.u).toBe(0)
    expect(middle.v).toBeCloseTo(-1 / 2400, 12)
    expect(middle.theta).toBeCloseTo(0, 12)
    expect(recoverBeamDisplacementAt(input, 4)).toEqual({ u: 0, v: 0, theta: 0 })
    expect(beamDisplacementPolynomials(input).v).toHaveLength(5)
  })

  it('finds analytic moment extrema and both inflection points', () => {
    const forcePolynomials = beamInternalForcePolynomials({
      L, qY, elementOnNodeEndForces: fixedEndForces,
    })
    const roots = realPolynomialRootsInInterval(forcePolynomials.M, 0, L)
    expect(roots).toHaveLength(2)
    expect(roots[0]).toBeCloseTo(0.845299461620748, 9)
    expect(roots[1]).toBeCloseTo(3.15470053837925, 9)

    const extrema = findBeamElementExtrema({
      elementId: 'e0', xI: 0, E, I, L, qY,
      localDisplacements: fixedDisplacement,
      elementOnNodeEndForces: fixedEndForces,
    })
    const momentMax = extrema.find(({ field, kind }) => field === 'M' && kind === 'max')!
    const displacementMin = extrema.find(({ field, kind }) => field === 'v' && kind === 'min')!
    expect(momentMax.value).toBeCloseTo(20_000 / 3, 9)
    expect(momentMax.localX).toBeCloseTo(2, 12)
    expect(momentMax.globalX).toBeCloseTo(2, 12)
    expect(displacementMin.value).toBeCloseTo(-1 / 2400, 12)
    expect(displacementMin.localX).toBeCloseTo(2, 10)
  })

  it('keeps V=dM/dx polynomial identity', () => {
    const fields = beamInternalForcePolynomials({ L, qY, elementOnNodeEndForces: fixedEndForces })
    expect(fields.V).toEqual([fields.M[1], 2 * fields.M[2]!])
  })

  it('rejects inconsistent end forces and invalid polynomial input', () => {
    const inconsistent = {
      L,
      qY,
      elementOnNodeEndForces: [0, -20_000, -40_000 / 3, 0, -19_000, 40_000 / 3],
    } as const
    expect(() => beamInternalForcePolynomials(inconsistent)).toThrow('梁端力与单元荷载不平衡：V_j')
    expect(() => recoverBeamInternalForcesAt(inconsistent, 0)).toThrow('梁端力与单元荷载不平衡：V_j')
    expect(() => recoverBeamDisplacementAt({
      E: 0, I, L, qY, localDisplacements: fixedDisplacement,
    }, 0)).toThrow('E 必须为有限正数')
    expect(() => realPolynomialRootsInInterval([], 0, 1)).toThrow('多项式输入必须为非空有限数')
    expect(() => realPolynomialRootsInInterval([0, Number.NaN], 0, 1)).toThrow('多项式输入必须为非空有限数')
  })
})
