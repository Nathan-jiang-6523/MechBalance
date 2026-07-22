import { describe, expect, it } from 'vitest'
import type {
  BeamModel2D,
  FrameModel2D,
  InfluenceLineRequest,
  MovingLoadRequest,
  TrussModel2D,
} from '../../../src/core/structural'
import { isSafeStructuralScreenResult } from '../../../src/core/structural'
import { runStructuralCalculation } from '../../../src/features/structural/calculation'

const beam: BeamModel2D = {
  analysis: 'beam',
  units: 'SI',
  topology: 'single-span',
  propertyPolicy: 'uniform',
  uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-6 },
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }, { id: '3', x: 4, y: 0 }],
  materials: [],
  sections: [],
  elements: [
    { type: 'beam', id: '1', nodeI: '1', nodeJ: '2' },
    { type: 'beam', id: '2', nodeI: '2', nodeJ: '3' },
  ],
  constraints: [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '3', dof: 'v', value: 0 },
  ],
  loads: [{ type: 'nodal', id: 'P', nodeId: '2', fy: -40_000 }],
}

const truss: TrussModel2D = {
  analysis: 'truss',
  units: 'SI',
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }, { id: '3', x: 2, y: 3 }],
  materials: [],
  sections: [],
  elements: [
    { type: 'truss', id: '13', nodeI: '1', nodeJ: '3', properties: { source: 'inline', E: 200e9, A: 0.001 } },
    { type: 'truss', id: '23', nodeI: '2', nodeJ: '3', properties: { source: 'inline', E: 200e9, A: 0.001 } },
    { type: 'truss', id: '12', nodeI: '1', nodeJ: '2', properties: { source: 'inline', E: 200e9, A: 0.001 } },
  ],
  constraints: [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 },
  ],
  loads: [{ type: 'nodal', id: 'P', nodeId: '3', fy: -100_000 }],
}

const frame: FrameModel2D = {
  analysis: 'frame',
  units: 'SI',
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }],
  materials: [],
  sections: [],
  elements: [{
    type: 'frame', id: '1', nodeI: '1', nodeJ: '2',
    properties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-5, extremeFiberY: 0.12 },
  }],
  constraints: [
    { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '1', dof: 'theta', value: 0 }, { nodeId: '2', dof: 'u', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 }, { nodeId: '2', dof: 'theta', value: 0 },
  ],
  loads: [{ type: 'frame-uniform', id: 'q', elementId: '1', qY: -10_000 }],
}

const influence: InfluenceLineRequest = {
  analysis: 'influence-line',
  units: 'SI',
  beam: { topology: 'simply-supported', span: 8 },
  response: { type: 'section-moment', position: 4 },
  samplePositions: [0, 2, 4, 6, 8],
}

const moving: MovingLoadRequest = {
  analysis: 'moving-load',
  units: 'SI',
  beam: { topology: 'simply-supported', span: 8 },
  response: { type: 'section-moment', position: 4 },
  movingLoad: {
    axles: [{ id: 'A1', load: 100_000 }, { id: 'A2', load: 80_000 }],
    adjacentSpacings: [3],
    direction: 'left-to-right',
    dynamicFactor: 1,
  },
  search: { strategy: 'event-points-and-stationary-points', adaptivePositionTolerance: 1e-9 },
}

describe('P2 feature calculation adapter', () => {
  it.each([
    ['beam', beam],
    ['truss', truss],
    ['frame', frame],
    ['influence-line', influence],
    ['moving-load', moving],
  ] as const)('adapts %s into a safe screen result', (analysis, request) => {
    const result = runStructuralCalculation(request)
    expect(result.status).toBe('success')
    expect(isSafeStructuralScreenResult(result)).toBe(true)
    if (result.status === 'error') return
    expect(result.structural.analysis).toBe(analysis)
    expect(result.metadata.elapsedMilliseconds).toBeGreaterThanOrEqual(0)
  })

  it('invalid edit clears all prior-compatible result payloads', () => {
    const invalid: BeamModel2D = {
      ...beam,
      uniformProperties: { source: 'inline', E: Number.NaN, A: 0.01, I: 8e-6 },
    }
    const result = runStructuralCalculation(invalid)
    expect(result.status).toBe('error')
    expect(result.groups).toEqual([])
    expect(result.charts).toEqual([])
    expect(result.balanceChecks).toEqual([])
    expect('structural' in result).toBe(false)
    expect(result.messages[0]).toMatchObject({ code: 'P2_NONFINITE_INPUT' })
    expect(isSafeStructuralScreenResult(result)).toBe(true)
  })
})
