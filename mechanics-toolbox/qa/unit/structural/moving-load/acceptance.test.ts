import { describe, expect, it } from 'vitest'

import {
  evaluateMovingLoadResponseAt,
  solveMovingLoadEnvelope,
} from '../../../../src/core/structural/moving-load'
import type { MovingLoadRequest } from '../../../../src/core/structural/contracts'

function request(
  direction: 'left-to-right' | 'right-to-left' = 'left-to-right',
  dynamicFactor = 1,
): MovingLoadRequest {
  return {
    analysis: 'moving-load', units: 'SI',
    beam: { topology: 'simply-supported', span: 10 },
    response: { type: 'left-reaction' },
    movingLoad: {
      axles: [{ id: 'front', load: 100_000 }, { id: 'rear', load: 60_000 }],
      adjacentSpacings: [3],
      direction,
      dynamicFactor,
    },
    search: {
      strategy: 'event-points-and-stationary-points',
      adaptivePositionTolerance: 1e-6,
    },
  }
}

function solved(input: MovingLoadRequest) {
  const result = solveMovingLoadEnvelope(input)
  expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.value
}

describe('Gate P2-3 moving-load acceptance', () => {
  it('P2-ML-A01: left-to-right group finds rear-entering maximum', () => {
    const envelope = solved(request())
    expect(envelope.maximum.value).toBeCloseTo(130_000, 6)
    expect(envelope.maximum.controllingAxleId).toBe('rear')
    expect(envelope.maximum.axlePositions).toEqual([
      expect.objectContaining({ axleId: 'front', position: 3, effectiveLoad: 100_000 }),
      expect.objectContaining({ axleId: 'rear', position: 0, effectiveLoad: 60_000 }),
    ])
    expect(envelope.minimum.value).toBe(0)
    expect(envelope.minimum.axlePositions.every(({ onBridge }) => !onBridge)).toBe(true)
    expect(envelope.responseUnit).toBe('N')
  })

  it('P2-ML-A02: right-to-left direction keeps front/rear physical order', () => {
    const envelope = solved(request('right-to-left'))
    expect(envelope.maximum.value).toBeCloseTo(142_000, 6)
    expect(envelope.maximum.controllingAxleId).toBe('front')
    expect(envelope.maximum.axlePositions).toEqual([
      expect.objectContaining({ axleId: 'front', position: 0 }),
      expect.objectContaining({ axleId: 'rear', position: 3 }),
    ])
    expect(envelope.maximum.value).not.toBe(130_000)
    expect(envelope.minimum.value).toBe(0)
  })

  it('P2-ML-A03: dynamic factor scales loads, not control position', () => {
    const base = solved(request())
    const dynamic = solved(request('left-to-right', 1.2))
    expect(dynamic.maximum.value).toBeCloseTo(156_000, 6)
    expect(dynamic.maximum.value).toBeCloseTo(1.2 * base.maximum.value, 6)
    expect(dynamic.maximum.controllingAxleId).toBe(base.maximum.controllingAxleId)
    expect(dynamic.maximum.axlePositions.map(({ position }) => position))
      .toEqual(base.maximum.axlePositions.map(({ position }) => position))
    expect(dynamic.maximum.axlePositions.map(({ effectiveLoad }) => effectiveLoad))
      .toEqual([120_000, 72_000])
  })

  it('superposes only axles currently on the bridge', () => {
    const response = evaluateMovingLoadResponseAt(request(), 1)
    expect(response.axlePositions[0]).toMatchObject({ axleId: 'front', position: 1, onBridge: true })
    expect(response.axlePositions[1]).toMatchObject({ axleId: 'rear', position: -2, onBridge: false })
    expect(response.value).toBe(90_000)
  })

  it('finds interior stationary point for displacement response without fixed stepping', () => {
    const displacementRequest: MovingLoadRequest = {
      ...request(),
      response: { type: 'displacement', position: 4, E: 200e9, I: 8e-6 },
      movingLoad: {
        axles: [{ id: 'single', load: 1 }],
        adjacentSpacings: [],
        direction: 'left-to-right',
        dynamicFactor: 1,
      },
    }
    const envelope = solved(displacementRequest)
    const expectedPosition = 10 - Math.sqrt(28)
    expect(envelope.minimum.frontAxlePosition).toBeCloseTo(expectedPosition, 9)
    expect(envelope.minimum.value).toBeLessThan(0)
    expect(envelope.maximum.value).toBe(0)
    expect(envelope.evaluatedCandidateCount).toBeGreaterThan(5)
  })

  it('retains moving section-shear limits and moment units', () => {
    const single: MovingLoadRequest['movingLoad'] = {
      axles: [{ id: 'single', load: 100_000 }],
      adjacentSpacings: [], direction: 'left-to-right', dynamicFactor: 1,
    }
    const shear = solved({
      ...request(),
      response: { type: 'section-shear', position: 4, retainBothLimits: true },
      movingLoad: single,
    })
    expect(shear.maximum).toMatchObject({ value: 60_000, side: 'right', controllingAxleId: 'single' })
    expect(shear.minimum).toMatchObject({ value: -40_000, side: 'left', controllingAxleId: 'single' })
    expect(shear.maximum.frontAxlePosition).toBe(4)

    const moment = solved({
      ...request(),
      response: { type: 'section-moment', position: 4 },
      movingLoad: single,
    })
    expect(moment.maximum.value).toBeCloseTo(240_000, 8)
    expect(moment.maximum.frontAxlePosition).toBe(4)
    expect(moment.responseUnit).toBe('N*m')
  })
})
