import { describe, expect, it } from 'vitest'

import type { FrameModel2D } from '../../../../src/core/structural/contracts'
import { validateFrameModel } from '../../../../src/core/structural/frame/validation'

function model(): FrameModel2D {
  return {
    analysis: 'frame', units: 'SI', materials: [], sections: [],
    nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
    elements: [{ type: 'frame', id: '1', nodeI: '1', nodeJ: '2', properties: {
      source: 'inline', E: 200e9, A: 0.001, I: 8e-6, alpha: 12e-6,
    } }],
    constraints: [{ nodeId: '1', dof: 'u', value: 0 }], loads: [],
  }
}

describe('P2 frame validation', () => {
  it.each([
    ['E', 0, 'P2_NONPOSITIVE_PROPERTY'],
    ['A', Number.NaN, 'P2_NONFINITE_INPUT'],
    ['I', -1, 'P2_NONPOSITIVE_PROPERTY'],
  ] as const)('rejects invalid %s', (name, value, code) => {
    const source = model().elements[0]!.properties
    if (source.source !== 'inline') throw new Error('inline expected')
    const candidate: FrameModel2D = {
      ...model(),
      elements: [{ ...model().elements[0]!, properties: { ...source, [name]: value } }],
    }
    expect(validateFrameModel(candidate)).toContainEqual(expect.objectContaining({ code }))
  })

  it('resolves library E/A/I and requires section I', () => {
    const base: FrameModel2D = {
      ...model(), materials: [{ id: 'steel', E: 200e9, alpha: 12e-6 }],
      sections: [{ id: 's', A: 0.001 }],
      elements: [{ ...model().elements[0]!, properties: {
        source: 'library', materialId: 'steel', sectionId: 's',
      } }],
    }
    expect(validateFrameModel(base)).toContainEqual(expect.objectContaining({
      code: 'P2_REFERENCE_NOT_FOUND', field: 'elements[0].properties.sectionId',
    }))
    expect(validateFrameModel({ ...base, sections: [{ id: 's', A: 0.001, I: 8e-6 }] })).toEqual([])
  })

  it.each([
    'releaseIMz',
    'releaseJMz',
    'internalHinge',
    'nodeIRotationReleased',
    'nodeJRotationReleased',
  ] as const)('rejects unsupported release request %s explicitly', (field) => {
    const released = {
      ...model(),
      elements: [{ ...model().elements[0]!, [field]: true }],
    } as FrameModel2D
    expect(validateFrameModel(released)).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: `elements[0].${field}`,
    }))
  })

  it('allows explicit false release flags without changing rigid connectivity', () => {
    expect(validateFrameModel({
      ...model(),
      elements: [{
        ...model().elements[0]!, releaseIMz: false, releaseJMz: false, internalHinge: false,
        nodeIRotationReleased: false, nodeJRotationReleased: false,
      }],
    })).toEqual([])
  })

  it('validates load values, temperature alpha, and distributed-load interval', () => {
    const source = model().elements[0]!.properties
    if (source.source !== 'inline') throw new Error('inline expected')
    const candidate: FrameModel2D = {
      ...model(), elements: [{ ...model().elements[0]!, properties: {
        source: 'inline', E: source.E, A: source.A, I: source.I,
      } }],
      loads: [
        { type: 'uniform-temperature', id: 'T', elementId: '1', deltaT: 20 },
        { type: 'frame-uniform', id: 'q', elementId: '1', qY: -10, interval: { a: 1, b: 3 } },
        { type: 'nodal', id: 'P', nodeId: '2', fx: Number.NaN },
      ],
    }
    const issues = validateFrameModel(candidate)
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'P2_REFERENCE_NOT_FOUND', objectId: 'T' }),
      expect.objectContaining({ code: 'P2_FEATURE_NOT_INCLUDED', objectId: 'q' }),
      expect.objectContaining({ code: 'P2_NONFINITE_INPUT', objectId: 'P' }),
    ]))
  })

  it('accepts either local distributed component and locates malformed components', () => {
    expect(validateFrameModel({
      ...model(),
      loads: [{ type: 'frame-uniform', id: 'qx', elementId: '1', qX: 5_000 }],
    })).toEqual([])

    const invalid: FrameModel2D = {
      ...model(),
      loads: [
        { type: 'frame-uniform', id: 'bad-x', elementId: '1', qX: Number.NaN },
        { type: 'frame-uniform', id: 'bad-y', elementId: '1', qY: Number.POSITIVE_INFINITY },
        { type: 'frame-uniform', id: 'missing', elementId: '1' } as FrameModel2D['loads'][number],
      ],
    }
    expect(validateFrameModel(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'P2_NONFINITE_INPUT', field: 'loads[0].qX' }),
      expect.objectContaining({ code: 'P2_NONFINITE_INPUT', field: 'loads[1].qY' }),
      expect.objectContaining({ code: 'P2_NONFINITE_INPUT', field: 'loads[2]' }),
    ]))
  })

  it('uses FRAME-N01 exact zero-length error', () => {
    const candidate: FrameModel2D = {
      ...model(), nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 0, y: 0 }],
    }
    expect(validateFrameModel(candidate)).toContainEqual(expect.objectContaining({
      code: 'P2_ZERO_LENGTH_ELEMENT', field: 'elements[0].nodeJ',
      message: '框架单元 1 长度为零',
    }))
  })
})
