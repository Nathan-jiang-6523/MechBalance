import { describe, expect, it } from 'vitest'

import type { TrussLoad, TrussModel2D } from '../../../../src/core/structural/contracts'
import { solveTrussFiniteElement } from '../../../../src/core/structural/truss'

const nodes = [
  { id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }, { id: '3', x: 0, y: 2 },
] as const
const properties = { source: 'inline', E: 200e9, A: 0.001, alpha: 10e-6, density: 7850 } as const
const elements = [
  { type: 'truss', id: '12', nodeI: '1', nodeJ: '2', properties },
  { type: 'truss', id: '13', nodeI: '1', nodeJ: '3', properties },
  { type: 'truss', id: '23', nodeI: '2', nodeJ: '3', properties },
] as const
const constraints = [
  { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
  { nodeId: '2', dof: 'v', value: 0 },
] as const

function model(loads: readonly TrussLoad[]): TrussModel2D {
  return { analysis: 'truss', units: 'SI', materials: [], sections: [], nodes, elements, constraints, loads }
}

function solve(candidate: TrussModel2D) {
  const result = solveTrussFiniteElement(candidate)
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('; '))
  return result.value
}

describe('P2 truss assembly invariants', () => {
  it('resolves material and section library properties', () => {
    const candidate: TrussModel2D = {
      ...model([]),
      materials: [{ id: 'steel', E: 200e9, alpha: 10e-6, density: 7850 }],
      sections: [{ id: 'bar', A: 0.001 }],
      elements: elements.map((element) => ({
        ...element, properties: { source: 'library', materialId: 'steel', sectionId: 'bar' },
      })),
      loads: [{ type: 'nodal', id: 'P', nodeId: '3', fx: 1000 }],
    }
    expect(solve(candidate).elements).toHaveLength(3)
  })

  it('is linear across all four action types and invariant under model order', () => {
    const actions: readonly TrussLoad[] = [
      { type: 'nodal', id: 'P', nodeId: '3', fx: 1000, fy: -2000 },
      { type: 'uniform-temperature', id: 'T', elementId: '12', deltaT: 25 },
      { type: 'initial-strain', id: 'e0', elementId: '23', strain: 100e-6 },
      { type: 'truss-self-weight', id: 'W', elementId: '13', gravity: 9.80665 },
    ]
    const individual = actions.map((load) => solve(model([load])))
    const combined = solve(model(actions))
    for (const combinedNode of combined.nodes) {
      const parts = individual.map((result) => result.nodes.find(({ nodeId }) => nodeId === combinedNode.nodeId)!)
      for (const key of ['u', 'v', 'reactionFx', 'reactionFy'] as const) {
        expect(combinedNode[key]).toBeCloseTo(parts.reduce((sum, part) => sum + part[key], 0), 10)
      }
    }
    for (const combinedElement of combined.elements) {
      const total = individual.reduce((sum, result) => sum + result.elements.find(
        ({ elementId }) => elementId === combinedElement.elementId,
      )!.axialForce.value, 0)
      expect(combinedElement.axialForce.value).toBeCloseTo(total, 6)
    }

    const reordered = solve({
      ...model([...actions].reverse()),
      nodes: [...nodes].reverse(),
      elements: [...elements].reverse(),
    })
    combined.nodes.forEach((original) => {
      const other = reordered.nodes.find(({ nodeId }) => nodeId === original.nodeId)!
      expect(other.u).toBeCloseTo(original.u, 12)
      expect(other.v).toBeCloseTo(original.v, 12)
      expect(other.reactionFx).toBeCloseTo(original.reactionFx, 6)
      expect(other.reactionFy).toBeCloseTo(original.reactionFy, 6)
    })
    combined.elements.forEach((original) => {
      const other = reordered.elements.find(({ elementId }) => elementId === original.elementId)!
      expect(other.axialForce.value).toBeCloseTo(original.axialForce.value, 6)
    })
  })
})
