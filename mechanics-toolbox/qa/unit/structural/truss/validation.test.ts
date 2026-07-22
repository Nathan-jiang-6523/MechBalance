import { describe, expect, it } from 'vitest'

import type { TrussModel2D } from '../../../../src/core/structural/contracts'
import { validateTrussModel } from '../../../../src/core/structural/truss'

function model(): TrussModel2D {
  return {
    analysis: 'truss', units: 'SI', materials: [], sections: [],
    nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 1, y: 0 }],
    elements: [{ type: 'truss', id: 'e', nodeI: '1', nodeJ: '2', properties: {
      source: 'inline', E: 200e9, A: 0.001, alpha: 12e-6, density: 7850,
    } }],
    constraints: [{ nodeId: '1', dof: 'u', value: 0 }], loads: [],
  }
}

describe('P2 truss validation', () => {
  it.each([
    ['E', 0, 'P2_NONPOSITIVE_PROPERTY'],
    ['A', Number.NaN, 'P2_NONFINITE_INPUT'],
    ['density', -1, 'P2_NONPOSITIVE_PROPERTY'],
  ] as const)('rejects invalid %s', (name, value, code) => {
    const source = model().elements[0]!.properties
    if (source.source !== 'inline') throw new Error('inline expected')
    const candidate: TrussModel2D = {
      ...model(),
      elements: [{ ...model().elements[0]!, properties: { ...source, [name]: value } }],
    }
    expect(validateTrussModel(candidate)).toContainEqual(expect.objectContaining({ code }))
  })

  it('rejects duplicate IDs, zero length, isolated nodes, and nonfinite action values', () => {
    const candidate: TrussModel2D = {
      ...model(),
      nodes: [
        { id: '1', x: 0, y: 0 }, { id: '1', x: 0, y: 0 },
        { id: '2', x: 0, y: 0 }, { id: 'orphan', x: 2, y: 0 },
      ],
      loads: [{ type: 'nodal', id: 'bad', nodeId: '2', fy: Number.POSITIVE_INFINITY }],
    }
    const codes = validateTrussModel(candidate).map(({ code }) => code)
    expect(codes).toEqual(expect.arrayContaining([
      'P2_DUPLICATE_ID', 'P2_ZERO_LENGTH_ELEMENT', 'P2_ISOLATED_NODE', 'P2_NONFINITE_INPUT',
    ]))
  })

  it('requires alpha for temperature and density for self weight', () => {
    const source = model().elements[0]!.properties
    if (source.source !== 'inline') throw new Error('inline expected')
    const candidate: TrussModel2D = {
      ...model(),
      elements: [{ ...model().elements[0]!, properties: { source: 'inline', E: source.E, A: source.A } }],
      loads: [
        { type: 'uniform-temperature', id: 't', elementId: 'e', deltaT: 1 },
        { type: 'truss-self-weight', id: 'w', elementId: 'e', gravity: 9.81 },
      ],
    }
    expect(validateTrussModel(candidate).filter(({ code }) => code === 'P2_REFERENCE_NOT_FOUND')).toHaveLength(2)
  })
})
