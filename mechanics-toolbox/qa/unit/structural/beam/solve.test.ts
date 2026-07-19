import { describe, expect, it } from 'vitest'

import { solveBeamFiniteElement } from '../../../../src/core/structural/beam'
import type { BeamModel2D } from '../../../../src/core/structural/contracts'

function baseModel(): BeamModel2D {
  return {
    analysis: 'beam', units: 'SI', topology: 'single-span', propertyPolicy: 'uniform',
    uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-6 },
    nodes: [{ id: 'left', x: 0, y: 0 }, { id: 'right', x: 4, y: 0 }],
    materials: [], sections: [],
    elements: [{ type: 'beam', id: 'e', nodeI: 'left', nodeJ: 'right' }],
    constraints: [],
    loads: [{ type: 'nodal', id: 'p', nodeId: 'right', fy: -1 }],
  }
}

describe('P2 beam solve failures', () => {
  it('keeps physics invariant under node-array and element-array order', () => {
    const model: BeamModel2D = {
      ...baseModel(),
      nodes: [
        { id: 'left', x: 0, y: 0 },
        { id: 'mid', x: 2, y: 0 },
        { id: 'right', x: 4, y: 0 },
      ],
      elements: [
        { type: 'beam', id: 'left-half', nodeI: 'left', nodeJ: 'mid' },
        { type: 'beam', id: 'right-half', nodeI: 'mid', nodeJ: 'right' },
      ],
      constraints: [
        { nodeId: 'left', dof: 'u', value: 0 },
        { nodeId: 'left', dof: 'v', value: 0 },
        { nodeId: 'right', dof: 'v', value: 0 },
      ],
      loads: [{ type: 'nodal', id: 'p', nodeId: 'mid', fy: -40_000 }],
    }
    const reordered: BeamModel2D = {
      ...model,
      nodes: [model.nodes[2]!, model.nodes[0]!, model.nodes[1]!],
      elements: [model.elements[1]!, model.elements[0]!],
    }
    const first = solveBeamFiniteElement(model)
    const second = solveBeamFiniteElement(reordered)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('expected success')

    for (const node of first.value.nodes) {
      const other = second.value.nodes.find(({ nodeId }) => nodeId === node.nodeId)!
      expect(other.u).toBeCloseTo(node.u, 12)
      expect(other.v).toBeCloseTo(node.v, 12)
      expect(other.theta).toBeCloseTo(node.theta, 12)
    }
  })

  it('rejects mechanism without returning fake displacement', () => {
    const result = solveBeamFiniteElement(baseModel())
    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('expected failure')
    expect(result.issues.map(({ code }) => code)).toContain('P2_SINGULAR_STIFFNESS')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'P2_SINGULAR_STIFFNESS',
      field: 'constraints',
      message: '整体刚度矩阵奇异：存在刚体位移或约束不足',
    }))
    expect('value' in result).toBe(false)
  })

  it.each([
    ['E', Number.NaN, 'P2_NONFINITE_INPUT'],
    ['A', 0, 'P2_NONPOSITIVE_PROPERTY'],
    ['I', Number.POSITIVE_INFINITY, 'P2_NONFINITE_INPUT'],
  ] as const)('rejects invalid %s', (field, value, code) => {
    const model = baseModel()
    const source = model.uniformProperties
    if (source.source !== 'inline') throw new Error('inline expected')
    const result = solveBeamFiniteElement({
      ...model,
      uniformProperties: { ...source, [field]: value },
      constraints: [
        { nodeId: 'left', dof: 'u', value: 0 },
        { nodeId: 'left', dof: 'v', value: 0 },
        { nodeId: 'right', dof: 'v', value: 0 },
      ],
    })
    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('expected failure')
    expect(result.issues).toContainEqual(expect.objectContaining({ code, field: `elements[0].${field}` }))
    expect(result.issues.find((issue) => issue.code === code)?.message).toContain(String(value))
  })

  it('rejects non-horizontal Gate P2-1 geometry as excluded scope', () => {
    const model = baseModel()
    const result = solveBeamFiniteElement({
      ...model,
      nodes: [{ id: 'left', x: 0, y: 0 }, { id: 'right', x: 4, y: 1 }],
      constraints: [
        { nodeId: 'left', dof: 'u', value: 0 },
        { nodeId: 'left', dof: 'v', value: 0 },
        { nodeId: 'right', dof: 'v', value: 0 },
      ],
    })
    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('expected failure')
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'P2_FEATURE_NOT_INCLUDED' }))
  })

  it('rejects zero-length geometry before assembly', () => {
    const model = baseModel()
    const result = solveBeamFiniteElement({
      ...model,
      nodes: [{ id: 'left', x: 0, y: 0 }, { id: 'right', x: 0, y: 0 }],
      constraints: [
        { nodeId: 'left', dof: 'u', value: 0 },
        { nodeId: 'left', dof: 'v', value: 0 },
        { nodeId: 'right', dof: 'v', value: 0 },
      ],
    })
    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('expected failure')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'P2_ZERO_LENGTH_ELEMENT', field: 'elements[0].nodeJ',
    }))
  })
})
