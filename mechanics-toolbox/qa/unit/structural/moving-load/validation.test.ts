import { describe, expect, it } from 'vitest'

import {
  MOVING_LOAD_LIMITS,
  positionMovingAxles,
  solveMovingLoadEnvelope,
  validateMovingLoadRequest,
} from '../../../../src/core/structural/moving-load'
import type { MovingLoadRequest } from '../../../../src/core/structural/contracts'

function baseRequest(): MovingLoadRequest {
  return {
    analysis: 'moving-load', units: 'SI',
    beam: { topology: 'simply-supported', span: 10 },
    response: { type: 'left-reaction' },
    movingLoad: {
      axles: [{ id: 'front', load: 100_000 }, { id: 'rear', load: 60_000 }],
      adjacentSpacings: [3], direction: 'left-to-right', dynamicFactor: 1,
    },
    search: { strategy: 'event-points-and-stationary-points', adaptivePositionTolerance: 1e-6 },
  }
}

describe('P2-3 moving-load validation', () => {
  it.each([
    [0, 'P2_NONPOSITIVE_PROPERTY'],
    [-1, 'P2_NONPOSITIVE_PROPERTY'],
    [Number.NaN, 'P2_NONFINITE_INPUT'],
    [Number.POSITIVE_INFINITY, 'P2_NONFINITE_INPUT'],
  ] as const)('rejects dynamic factor %s with frozen field', (dynamicFactor, code) => {
    const input = baseRequest()
    const result = solveMovingLoadEnvelope({
      ...input,
      movingLoad: { ...input.movingLoad, dynamicFactor },
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected invalid factor')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code, field: 'movingLoad.dynamicFactor',
    }))
  })

  it('rejects negative/nonfinite spacing, invalid loads and spacing count', () => {
    const input = baseRequest()
    const issues = validateMovingLoadRequest({
      ...input,
      movingLoad: {
        ...input.movingLoad,
        axles: [{ id: 'front', load: -1 }, { id: 'rear', load: Number.NaN }],
        adjacentSpacings: [-3, Number.POSITIVE_INFINITY],
      },
    } as unknown as MovingLoadRequest)
    expect(issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'P2_NONPOSITIVE_PROPERTY', 'P2_NONFINITE_INPUT', 'P2_FEATURE_NOT_INCLUDED',
    ]))
    expect(issues.map(({ field }) => field)).toEqual(expect.arrayContaining([
      'movingLoad.axles[0].load',
      'movingLoad.axles[1].load',
      'movingLoad.adjacentSpacings',
      'movingLoad.adjacentSpacings[0]',
      'movingLoad.adjacentSpacings[1]',
    ]))
  })

  it('rejects empty and over-limit axle groups', () => {
    const input = baseRequest()
    const empty = {
      ...input,
      movingLoad: { ...input.movingLoad, axles: [], adjacentSpacings: [] },
    } as unknown as MovingLoadRequest
    expect(validateMovingLoadRequest(empty)).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'movingLoad.axles',
    }))

    const axles = Array.from({ length: MOVING_LOAD_LIMITS.axles + 1 }, (_, index) => ({
      id: `a${index}`, load: 1,
    })) as unknown as MovingLoadRequest['movingLoad']['axles']
    const over = {
      ...input,
      movingLoad: {
        ...input.movingLoad,
        axles,
        adjacentSpacings: Array.from({ length: axles.length - 1 }, () => 1),
      },
    }
    expect(validateMovingLoadRequest(over)).toContainEqual(expect.objectContaining({
      code: 'P2_MODEL_LIMIT_EXCEEDED', field: 'movingLoad.axles',
    }))
  })

  it('rejects loose position tolerance and fixed-step strategy', () => {
    const input = baseRequest()
    const issues = validateMovingLoadRequest({
      ...input,
      search: {
        strategy: 'fixed-step' as MovingLoadRequest['search']['strategy'],
        adaptivePositionTolerance: 1e-5,
      },
    })
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'search.strategy',
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'search.adaptivePositionTolerance',
    }))
  })

  it('guards direct axle-position mapping inputs', () => {
    const input = baseRequest()
    expect(() => positionMovingAxles({
      ...input.movingLoad,
      adjacentSpacings: [],
    }, 0, 10)).toThrow('相邻轴距数量必须等于车轴数减一')
    expect(() => positionMovingAxles(input.movingLoad, 0, 0)).toThrow('span 必须为有限正数')
  })
})
