import { describe, expect, it } from 'vitest'

import {
  beamSupportConstraints,
  fixedFixedBeamConstraints,
  fixedRollerBeamConstraints,
  solveBeamFiniteElement,
  validateBeamScope,
} from '../../../../src/core/structural/beam'
import type { BeamModel2D } from '../../../../src/core/structural/contracts'

function baseModel(): BeamModel2D {
  return {
    analysis: 'beam', units: 'SI', topology: 'single-span', propertyPolicy: 'uniform',
    uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-6 },
    nodes: [{ id: 'left', x: 0, y: 0 }, { id: 'right', x: 4, y: 0 }],
    materials: [], sections: [],
    elements: [{ type: 'beam', id: 'e0', nodeI: 'left', nodeJ: 'right' }],
    constraints: fixedRollerBeamConstraints('left', 'right'),
    loads: [{ type: 'beam-uniform', id: 'q0', elementId: 'e0', qY: -10_000 }],
  }
}

describe('P2-2 beam supports and scope validation', () => {
  it('maps fixed, pinned and roller supports to [u,v,theta]', () => {
    expect(beamSupportConstraints('n', 'fixed').map(({ dof }) => dof)).toEqual(['u', 'v', 'theta'])
    expect(beamSupportConstraints('n', 'pinned').map(({ dof }) => dof)).toEqual(['u', 'v'])
    expect(beamSupportConstraints('n', 'vertical-roller').map(({ dof }) => dof)).toEqual(['v'])
    expect(fixedRollerBeamConstraints('left', 'right')).toHaveLength(4)
    expect(fixedFixedBeamConstraints('left', 'right')).toHaveLength(6)
    expect(() => beamSupportConstraints('n', 'spring' as never)).toThrow('不支持的梁支承类型：spring')
  })

  it('rejects the frozen release request with exact issue', () => {
    const model = baseModel()
    const result = solveBeamFiniteElement({
      ...model,
      nodes: [
        { id: 'left', x: 0, y: 0 },
        { id: 'mid', x: 2, y: 0 },
        { id: 'right', x: 4, y: 0 },
      ],
      elements: [
        { type: 'beam', id: 'e0', nodeI: 'left', nodeJ: 'mid', releaseJMz: true },
        { type: 'beam', id: 'e1', nodeI: 'mid', nodeJ: 'right' },
      ],
      constraints: [
        { nodeId: 'left', dof: 'u', value: 0 },
        { nodeId: 'left', dof: 'v', value: 0 },
        { nodeId: 'right', dof: 'v', value: 0 },
      ],
      loads: [{ type: 'nodal', id: 'p', nodeId: 'mid', fy: -10_000 }],
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected release rejection')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED',
      field: 'elements[0].releaseJMz',
      message: 'P2 未纳入梁端弯矩释放/内部铰',
    }))
    expect('value' in result).toBe(false)
  })

  it('rejects per-element properties and isolated nodes', () => {
    const model = baseModel()
    const variable = {
      ...model,
      elements: [{ ...model.elements[0]!, properties: { source: 'inline', E: 1, A: 1, I: 1 } }],
    } as unknown as BeamModel2D
    expect(validateBeamScope(variable)).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'elements[0]',
    }))

    const isolated: BeamModel2D = {
      ...model,
      nodes: [...model.nodes, { id: 'unused', x: 5, y: 0 }],
    }
    expect(validateBeamScope(isolated)).toContainEqual(expect.objectContaining({
      code: 'P2_ISOLATED_NODE', field: 'nodes[2]', nodeId: 'unused',
    }))
  })

  it('rejects runtime variable-property and multispan policy values', () => {
    const model = baseModel()
    const issues = validateBeamScope({
      ...model,
      topology: 'continuous' as BeamModel2D['topology'],
      propertyPolicy: 'piecewise' as BeamModel2D['propertyPolicy'],
    })
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'topology', message: 'P2 未纳入连续多跨梁',
    }))
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'propertyPolicy', message: 'P2 未纳入分段变 E/A/I 梁',
    }))
  })

  it('rejects an internal support as continuous multispan scope', () => {
    const model = baseModel()
    const result = solveBeamFiniteElement({
      ...model,
      nodes: [
        { id: 'left', x: 0, y: 0 },
        { id: 'mid', x: 2, y: 0 },
        { id: 'right', x: 4, y: 0 },
      ],
      elements: [
        { type: 'beam', id: 'e0', nodeI: 'left', nodeJ: 'mid' },
        { type: 'beam', id: 'e1', nodeI: 'mid', nodeJ: 'right' },
      ],
      constraints: [
        { nodeId: 'left', dof: 'u', value: 0 },
        { nodeId: 'left', dof: 'v', value: 0 },
        { nodeId: 'mid', dof: 'v', value: 0 },
        { nodeId: 'right', dof: 'v', value: 0 },
      ],
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected multispan rejection')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'P2_FEATURE_NOT_INCLUDED', field: 'constraints',
    }))
  })
})
