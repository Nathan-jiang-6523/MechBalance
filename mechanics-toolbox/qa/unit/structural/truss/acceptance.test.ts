import { describe, expect, it } from 'vitest'

import fixture from '../../../fixtures/p2-truss.json'
import type { TrussModel2D } from '../../../../src/core/structural/contracts'
import { solveTrussFiniteElement } from '../../../../src/core/structural/truss'

const inline = { source: 'inline', E: 200e9, A: 0.001 } as const

function base(
  nodes: TrussModel2D['nodes'],
  elements: TrussModel2D['elements'],
  constraints: TrussModel2D['constraints'],
  loads: TrussModel2D['loads'],
): TrussModel2D {
  return { analysis: 'truss', units: 'SI', materials: [], sections: [], nodes, elements, constraints, loads }
}

function value(model: TrussModel2D) {
  const result = solveTrussFiniteElement(model)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('; '))
  expect(result.value.checks.every(({ passed }) => passed)).toBe(true)
  return result.value
}

function node(result: ReturnType<typeof value>, id: string) {
  return result.nodes.find(({ nodeId }) => nodeId === id)!
}

function element(result: ReturnType<typeof value>, id: string) {
  return result.elements.find(({ elementId }) => elementId === id)!
}

describe('P2 frozen truss acceptance', () => {
  it('is tied to the confirmed fixture set', () => {
    expect(fixture.fixtureVersion).toBe('P2-TRUSS-FIXTURES-v1')
    expect(fixture.cases.map(({ id }) => id)).toEqual([
      'P2-TRUSS-E01', 'P2-TRUSS-A01', 'P2-TRUSS-A02', 'P2-TRUSS-T01',
      'P2-TRUSS-IS01', 'P2-TRUSS-SW01', 'P2-TRUSS-N01', 'P2-TRUSS-X01',
    ])
    expect(fixture.cases.every(({ status }) => status === 'confirmed-three-independent-reviews')).toBe(true)
  })

  it('matches TRUSS-A01 triangle displacements, reactions, forces, and stresses', () => {
    const result = value(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }, { id: '3', x: 2, y: 3 }],
      [
        { type: 'truss', id: '13', nodeI: '1', nodeJ: '3', properties: inline },
        { type: 'truss', id: '23', nodeI: '2', nodeJ: '3', properties: inline },
        { type: 'truss', id: '12', nodeI: '1', nodeJ: '2', properties: inline },
      ],
      [
        { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
        { nodeId: '2', dof: 'v', value: 0 },
      ],
      [{ type: 'nodal', id: 'P', nodeId: '3', fy: -100_000 }],
    ))
    expect(node(result, '1').reactionFx).toBeCloseTo(0, 6)
    expect(node(result, '1').reactionFy).toBeCloseTo(50_000, 6)
    expect(node(result, '2').reactionFy).toBeCloseTo(50_000, 6)
    expect(node(result, '2').u).toBeCloseTo(0.000666666666667, 12)
    expect(node(result, '3').u).toBeCloseTo(0.000333333333333, 12)
    expect(node(result, '3').v).toBeCloseTo(-0.00152422684947, 12)
    expect(element(result, '13').axialForce.value).toBeCloseTo(-60092.5212577, 6)
    expect(element(result, '23').axialForce.value).toBeCloseTo(-60092.5212577, 6)
    expect(element(result, '12').axialForce.value).toBeCloseTo(33333.3333333, 6)
    expect(element(result, '13').stress.value / 1e6).toBeCloseTo(-60.0925212577, 7)
  })

  it('matches TRUSS-A02 symmetric truss including its zero-force member', () => {
    const result = value(base(
      [
        { id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 },
        { id: '3', x: 8, y: 0 }, { id: '4', x: 4, y: 3 },
      ],
      [['12', '1', '2'], ['23', '2', '3'], ['14', '1', '4'], ['34', '3', '4'], ['24', '2', '4']]
        .map(([id, nodeI, nodeJ]) => ({ type: 'truss' as const, id: id!, nodeI: nodeI!, nodeJ: nodeJ!, properties: inline })),
      [
        { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
        { nodeId: '3', dof: 'v', value: 0 },
      ],
      [{ type: 'nodal', id: 'P', nodeId: '4', fy: -120_000 }],
    ))
    expect(node(result, '1').reactionFy).toBeCloseTo(60_000, 6)
    expect(node(result, '3').reactionFy).toBeCloseTo(60_000, 6)
    expect(node(result, '2').u).toBeCloseTo(0.0016, 12)
    expect(node(result, '2').v).toBeCloseTo(-0.0063, 12)
    expect(node(result, '3').u).toBeCloseTo(0.0032, 12)
    expect(node(result, '4').u).toBeCloseTo(0.0016, 12)
    expect(node(result, '4').v).toBeCloseTo(-0.0063, 12)
    expect(element(result, '14').axialForce.value).toBeCloseTo(-100_000, 6)
    expect(element(result, '34').axialForce.value).toBeCloseTo(-100_000, 6)
    expect(element(result, '12').axialForce.value).toBeCloseTo(80_000, 6)
    expect(element(result, '23').axialForce.value).toBeCloseTo(80_000, 6)
    expect(element(result, '24')).toMatchObject({ state: 'zero' })
    expect(Math.abs(element(result, '24').axialForce.value)).toBeLessThanOrEqual(1e-6)
  })

  it('matches TRUSS-T01 free thermal expansion with zero force and reaction', () => {
    const result = value(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
      [{ type: 'truss', id: 'e', nodeI: '1', nodeJ: '2', properties: { ...inline, alpha: 12e-6 } }],
      [
        { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
        { nodeId: '2', dof: 'v', value: 0 },
      ],
      [{ type: 'uniform-temperature', id: 'T', elementId: 'e', deltaT: 50 }],
    ))
    expect(node(result, '2').u).toBeCloseTo(0.0012, 12)
    expect(element(result, 'e').freeStrain).toBeCloseTo(0.0006, 15)
    element(result, 'e').equivalentInitialStrainLoad.forEach((actual, index) => {
      expect(actual).toBeCloseTo([-120_000, 0, 120_000, 0][index]!, 10)
    })
    expect(Math.abs(element(result, 'e').axialForce.value)).toBeLessThanOrEqual(1e-6)
    result.nodes.forEach(({ reactionFx, reactionFy }) => {
      expect(Math.abs(reactionFx)).toBeLessThanOrEqual(1e-6)
      expect(Math.abs(reactionFy)).toBeLessThanOrEqual(1e-6)
    })
  })

  it('matches TRUSS-IS01 fully restrained initial elongation', () => {
    const result = value(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
      [{ type: 'truss', id: 'e', nodeI: '1', nodeJ: '2', properties: inline }],
      [
        { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
        { nodeId: '2', dof: 'u', value: 0 }, { nodeId: '2', dof: 'v', value: 0 },
      ],
      [{ type: 'initial-strain', id: 'e0', elementId: 'e', strain: 500e-6 }],
    ))
    expect(result.displacements).toEqual([0, 0, 0, 0])
    expect(element(result, 'e').axialForce.value).toBeCloseTo(-100_000, 8)
    expect(element(result, 'e').stress.value).toBeCloseTo(-100e6, 5)
    expect(node(result, '1').reactionFx).toBeCloseTo(100_000, 8)
    expect(node(result, '2').reactionFx).toBeCloseTo(-100_000, 8)
  })

  it('matches TRUSS-SW01 global-y self weight without transverse member output', () => {
    const result = value(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
      [{ type: 'truss', id: 'e', nodeI: '1', nodeJ: '2', properties: { ...inline, density: 7850 } }],
      [
        { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
        { nodeId: '2', dof: 'v', value: 0 },
      ],
      [{ type: 'truss-self-weight', id: 'W', elementId: 'e', gravity: 9.80665 }],
    ))
    expect(element(result, 'e').mass).toBeCloseTo(15.7, 12)
    expect(element(result, 'e').weight).toBeCloseTo(153.964405, 12)
    expect(element(result, 'e').equivalentSelfWeightLoad).toEqual([0, -76.9822025, 0, -76.9822025])
    expect(node(result, '1').reactionFy).toBeCloseTo(76.9822025, 9)
    expect(node(result, '2').reactionFy).toBeCloseTo(76.9822025, 9)
    expect(element(result, 'e').axialForce.value).toBe(0)
    expect(Object.hasOwn(element(result, 'e'), 'shearForce')).toBe(false)
    expect(Object.hasOwn(element(result, 'e'), 'bendingMoment')).toBe(false)
  })

  it('matches exact TRUSS-N01 mechanism issue and returns no success value', () => {
    const result = solveTrussFiniteElement(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }],
      [{ type: 'truss', id: 'e', nodeI: '1', nodeJ: '2', properties: inline }],
      [{ nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 }],
      [{ type: 'nodal', id: 'P', nodeId: '2', fy: -1 }],
    ))
    expect(result).toEqual({
      ok: false,
      issues: [{
        code: 'P2_SINGULAR_STIFFNESS', severity: 'error', field: 'constraints',
        message: '桁架存在机构：节点 2 的 y 向自由度无刚度',
      }],
    })
    expect('value' in result).toBe(false)
  })

  it('is invariant under node/element/load order and superposes imposed strains', () => {
    const original = base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
      [{ type: 'truss', id: 'e', nodeI: '1', nodeJ: '2', properties: { ...inline, alpha: 10e-6 } }],
      [
        { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
        { nodeId: '2', dof: 'v', value: 0 },
      ],
      [
        { type: 'uniform-temperature', id: 'T', elementId: 'e', deltaT: 20 },
        { type: 'initial-strain', id: 'e0', elementId: 'e', strain: 300e-6 },
      ],
    )
    const reordered: TrussModel2D = {
      ...original,
      nodes: [original.nodes[1]!, original.nodes[0]!],
      loads: [original.loads[1]!, original.loads[0]!],
    }
    const first = value(original)
    const second = value(reordered)
    expect(node(first, '2').u).toBeCloseTo(0.001, 12)
    expect(node(second, '2').u).toBeCloseTo(node(first, '2').u, 12)
    expect(element(second, 'e').axialForce.value).toBeCloseTo(element(first, 'e').axialForce.value, 6)
  })
})
