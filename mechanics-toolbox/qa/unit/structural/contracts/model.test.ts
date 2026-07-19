import { describe, expect, it } from 'vitest'

import {
  STRUCTURAL_INPUT_UNITS,
  STRUCTURAL_MODEL_LIMITS,
  type InfluenceLineRequest,
  type MovingLoadRequest,
  validateStructuralModelBoundary,
  type BeamModel2D,
  type FrameModel2D,
  type TrussModel2D,
} from '../../../../src/core/structural/contracts'

describe('P2 结构输入契约', () => {
  it('冻结 SI、2D 与梁 u/v/theta 自由度', () => {
    const model = {
      analysis: 'beam',
      topology: 'single-span',
      propertyPolicy: 'uniform',
      uniformProperties: { source: 'inline', E: 2e11, A: 0.001, I: 8e-6 },
      units: STRUCTURAL_INPUT_UNITS,
      nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 2, y: 0 }],
      materials: [],
      sections: [],
      elements: [{ type: 'beam', id: 'e1', nodeI: 'n1', nodeJ: 'n2' }],
      constraints: [{ nodeId: 'n1', dof: 'u', value: 0 }, { nodeId: 'n1', dof: 'v', value: 0 }, { nodeId: 'n1', dof: 'theta', value: 0 }],
      loads: [{ type: 'nodal', id: 'p1', nodeId: 'n2', fx: 100_000 }],
    } satisfies BeamModel2D

    expect(model.units).toBe('SI')
    expect(model.constraints.map(({ dof }) => dof)).toEqual(['u', 'v', 'theta'])
    expect(STRUCTURAL_MODEL_LIMITS).toEqual({ nodes: 100, elements: 200, freeDofs: 300 })
    expect(validateStructuralModelBoundary(model)).toEqual([])
  })

  it('在契约边界拒绝多跨内部支点、重复 ID、缺失引用和超限', () => {
    const nodes = Array.from({ length: 101 }, (_, index) => ({ id: `n${index}`, x: index, y: 0 }))
    const model = {
      analysis: 'beam', units: STRUCTURAL_INPUT_UNITS, topology: 'single-span', propertyPolicy: 'uniform',
      uniformProperties: { source: 'library', materialId: 'missing-material', sectionId: 'missing-section' },
      nodes: [...nodes, { id: 'n1', x: 1, y: 0 }], materials: [], sections: [],
      elements: [
        { type: 'beam', id: 'e1', nodeI: 'n0', nodeJ: 'n1' },
        { type: 'beam', id: 'e2', nodeI: 'n1', nodeJ: 'n2' },
        { type: 'beam', id: 'bad', nodeI: 'n2', nodeJ: 'absent' },
      ],
      constraints: [{ nodeId: 'n1', dof: 'v', value: 0 }], loads: [],
    } satisfies BeamModel2D
    const issues = validateStructuralModelBoundary(model)

    expect(issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'P2_MODEL_LIMIT_EXCEEDED',
      'P2_DUPLICATE_ID',
      'P2_REFERENCE_NOT_FOUND',
      'P2_FEATURE_NOT_INCLUDED',
    ]))
    expect(issues.find(({ code }) => code === 'P2_FEATURE_NOT_INCLUDED')?.field).toBe('constraints')
  })

  it('冻结简支梁影响线和单轴组移动载荷输入', () => {
    const influence = {
      analysis: 'influence-line',
      units: STRUCTURAL_INPUT_UNITS,
      beam: { topology: 'simply-supported', span: 10 },
      response: { type: 'section-shear', position: 4, retainBothLimits: true },
      samplePositions: [0, 4, 10],
    } satisfies InfluenceLineRequest
    const moving = {
      analysis: 'moving-load',
      units: STRUCTURAL_INPUT_UNITS,
      beam: { topology: 'simply-supported', span: 10 },
      response: { type: 'left-reaction' },
      movingLoad: {
        axles: [{ id: 'front', load: 100_000 }, { id: 'rear', load: 60_000 }],
        adjacentSpacings: [3],
        direction: 'left-to-right',
        dynamicFactor: 1.2,
      },
      search: {
        strategy: 'event-points-and-stationary-points',
        adaptivePositionTolerance: 1e-6,
      },
    } satisfies MovingLoadRequest

    expect(influence.response).toMatchObject({ retainBothLimits: true })
    expect(moving.movingLoad).toMatchObject({ direction: 'left-to-right', dynamicFactor: 1.2 })
    expect(moving.search.strategy).not.toContain('fixed-step')
  })

  it('覆盖桁架温度/初应变/自重与刚架区间均布载荷', () => {
    const base = { units: STRUCTURAL_INPUT_UNITS, nodes: [], materials: [], sections: [], elements: [], constraints: [] } as const
    const truss = { ...base, analysis: 'truss', loads: [
      { type: 'uniform-temperature', id: 't', elementId: 'e', deltaT: 50 },
      { type: 'initial-strain', id: 'i', elementId: 'e', strain: 500e-6 },
      { type: 'truss-self-weight', id: 'w', elementId: 'e', gravity: 9.80665 },
    ] } satisfies TrussModel2D
    const frame = { ...base, analysis: 'frame', loads: [
      { type: 'frame-uniform', id: 'q', elementId: 'e', qY: -10_000, interval: { a: 0, b: 2 } },
    ] } satisfies FrameModel2D

    expect(truss.loads.map(({ type }) => type)).toEqual(['uniform-temperature', 'initial-strain', 'truss-self-weight'])
    expect(frame.loads[0]!.interval).toEqual({ a: 0, b: 2 })
  })
})
