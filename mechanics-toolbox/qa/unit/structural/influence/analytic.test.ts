import { describe, expect, it } from 'vitest'

import {
  evaluateInfluenceOrdinate,
  generateInfluenceLineSeries,
  validateInfluenceDefinition,
} from '../../../../src/core/structural/influence'
import type { InfluenceLineRequest } from '../../../../src/core/structural/contracts'

const span = 10

function request(
  response: InfluenceLineRequest['response'],
  samplePositions: readonly number[],
): InfluenceLineRequest {
  return {
    analysis: 'influence-line', units: 'SI',
    beam: { topology: 'simply-supported', span },
    response,
    samplePositions,
  }
}

describe('Gate P2-3 influence-line analytic acceptance', () => {
  it('P2-IL-A01: left and right reaction ordinates follow equilibrium', () => {
    const positions = [0, 2.5, 5, 7.5, 10]
    expect(positions.map((z) => evaluateInfluenceOrdinate(span, { type: 'left-reaction' }, z)))
      .toEqual([1, 0.75, 0.5, 0.25, 0])
    expect(positions.map((z) => evaluateInfluenceOrdinate(span, { type: 'right-reaction' }, z)))
      .toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(evaluateInfluenceOrdinate(span, { type: 'left-reaction' }, -1)).toBe(0)
    expect(evaluateInfluenceOrdinate(span, { type: 'left-reaction' }, 11)).toBe(0)
  })

  it('P2-IL-A02: section moment is continuous with unique peak', () => {
    const series = generateInfluenceLineSeries(request(
      { type: 'section-moment', position: 4 },
      [0, 2, 4, 7, 10],
    ))
    expect(series.points.map(({ ordinate }) => ordinate)).toEqual([0, 1.2, 2.4, 1.2, 0])
    expect(series.maximum).toMatchObject({ position: 4, ordinate: 2.4, side: 'continuous' })
    expect(series.ordinateUnit).toBe('m')
  })

  it('P2-IL-A03: section shear retains both limits and endpoint convention', () => {
    const response = { type: 'section-shear', position: 4, retainBothLimits: true } as const
    expect(evaluateInfluenceOrdinate(span, response, 4, 'left')).toBe(-0.4)
    expect(evaluateInfluenceOrdinate(span, response, 4, 'right')).toBe(0.6)
    expect(evaluateInfluenceOrdinate(span, response, 4, 'right')
      - evaluateInfluenceOrdinate(span, response, 4, 'left')).toBe(1)
    expect(evaluateInfluenceOrdinate(span, response, 0)).toBe(0)
    expect(evaluateInfluenceOrdinate(span, response, 10)).toBe(0)

    const series = generateInfluenceLineSeries(request(response, [0, 4, 10]))
    expect(series.points.filter(({ position }) => position === 4)).toEqual([
      { position: 4, ordinate: -0.4, side: 'left' },
      { position: 4, ordinate: 0.6, side: 'right' },
    ])
  })

  it('displacement influence satisfies reciprocity and central closed form', () => {
    const E = 200e9
    const I = 8e-6
    const at4Due7 = evaluateInfluenceOrdinate(span, { type: 'displacement', position: 4, E, I }, 7)
    const at7Due4 = evaluateInfluenceOrdinate(span, { type: 'displacement', position: 7, E, I }, 4)
    expect(at4Due7).toBeCloseTo(at7Due4, 15)
    expect(at4Due7).toBeCloseTo(-9.375e-6, 15)
    const center = evaluateInfluenceOrdinate(span, { type: 'displacement', position: 5, E, I }, 5)
    expect(center).toBeCloseTo(-(span ** 3) / (48 * E * I), 15)

    const series = generateInfluenceLineSeries(request(
      { type: 'displacement', position: 4, E, I },
      [0, 4, 10],
    ))
    expect(series.ordinateUnit).toBe('m/N')
    expect(series.points.some(({ position }) => Math.abs(position - (10 - Math.sqrt(28))) < 1e-12)).toBe(true)
    expect(series.points.some(({ position }) => Math.abs(position - Math.sqrt(64 / 3)) < 1e-12)).toBe(false)
  })

  it('rejects nonfinite/invalid response definitions with located issues', () => {
    expect(validateInfluenceDefinition(0, { type: 'left-reaction' })).toContainEqual(expect.objectContaining({
      code: 'P2_NONPOSITIVE_PROPERTY', field: 'beam.span',
    }))
    expect(validateInfluenceDefinition(10, {
      type: 'section-shear', position: 4, retainBothLimits: false as true,
    })).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'response.retainBothLimits',
    }))
    expect(validateInfluenceDefinition(10, {
      type: 'displacement', position: 4, E: Number.NaN, I: 0,
    }).map(({ field }) => field)).toEqual(['response.E', 'response.I'])
  })
})
