import { describe, expect, it } from 'vitest'

import {
  beamInternalForcePolynomials,
  findBeamElementExtrema,
  fixedFixedBeamConstraints,
  fixedRollerBeamConstraints,
  realPolynomialRootsInInterval,
  recoverBeamDisplacementAt,
  recoverBeamInternalForcesAt,
  solveBeamFiniteElement,
  type BeamFiniteElementSolution,
} from '../../../../src/core/structural/beam'
import type { BeamModel2D } from '../../../../src/core/structural/contracts'

function model(I: number, constraints: BeamModel2D['constraints']): BeamModel2D {
  return {
    analysis: 'beam', units: 'SI', topology: 'single-span', propertyPolicy: 'uniform',
    uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I },
    nodes: [{ id: 'left', x: 0, y: 0 }, { id: 'right', x: 4, y: 0 }],
    materials: [], sections: [],
    elements: [{ type: 'beam', id: 'e0', nodeI: 'left', nodeJ: 'right' }],
    constraints,
    loads: [{ type: 'beam-uniform', id: 'q0', elementId: 'e0', qY: -10_000 }],
  }
}

function solved(input: BeamModel2D): BeamFiniteElementSolution {
  const result = solveBeamFiniteElement(input)
  expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  expect(result.value.checks.every(({ passed }) => passed)).toBe(true)
  return result.value
}

describe('Gate P2-2 indeterminate beam acceptance', () => {
  it('P2-CBEAM-A03: fixed-roller beam matches reactions, rotation and field', () => {
    const solution = solved(model(8e-6, fixedRollerBeamConstraints('left', 'right')))
    const left = solution.nodes.find(({ nodeId }) => nodeId === 'left')!
    const right = solution.nodes.find(({ nodeId }) => nodeId === 'right')!
    expect(left.reactionFy).toBeCloseTo(25_000, 7)
    expect(right.reactionFy).toBeCloseTo(15_000, 7)
    expect(left.reactionMz).toBeCloseTo(20_000, 7)
    expect(right.theta).toBeCloseTo(0.00833333333333, 11)
    expect(right.u).toBe(0)
    expect(right.v).toBe(0)

    const element = solution.elements[0]!
    const fieldInput = {
      L: element.length,
      qY: element.uniformLoadQY,
      elementOnNodeEndForces: element.elementOnNodeEndForces,
    }
    for (const x of [0, 1, 2, 3, 4]) {
      const field = recoverBeamInternalForcesAt(fieldInput, x)
      expect(field.V).toBeCloseTo(25_000 - 10_000 * x, 7)
      expect(field.M).toBeCloseTo(-20_000 + 25_000 * x - 5_000 * x ** 2, 7)
    }
    expect(recoverBeamInternalForcesAt(fieldInput, 0).M).toBeCloseTo(-20_000, 7)
    expect(recoverBeamInternalForcesAt(fieldInput, 4).M).toBeCloseTo(0, 7)
  })

  it('P2-CBEAM-A05: fully constrained system solves and recovers exact fields', () => {
    const solution = solved(model(8e-5, fixedFixedBeamConstraints('left', 'right')))
    const left = solution.nodes.find(({ nodeId }) => nodeId === 'left')!
    const right = solution.nodes.find(({ nodeId }) => nodeId === 'right')!
    expect(solution.freeDofs).toEqual([])
    expect(solution.displacements.every((value) => value === 0)).toBe(true)
    expect(left.reactionFy).toBeCloseTo(20_000, 8)
    expect(right.reactionFy).toBeCloseTo(20_000, 8)
    expect(left.reactionMz).toBeCloseTo(40_000 / 3, 8)
    expect(right.reactionMz).toBeCloseTo(-40_000 / 3, 8)

    const element = solution.elements[0]!
    const internalInput = {
      L: element.length, qY: element.uniformLoadQY,
      elementOnNodeEndForces: element.elementOnNodeEndForces,
    }
    expect(recoverBeamInternalForcesAt(internalInput, 0).M).toBeCloseTo(-40_000 / 3, 8)
    expect(recoverBeamInternalForcesAt(internalInput, 2).M).toBeCloseTo(20_000 / 3, 8)
    expect(recoverBeamInternalForcesAt(internalInput, 4).M).toBeCloseTo(-40_000 / 3, 8)

    const displacementInput = {
      E: solution.properties.E,
      I: solution.properties.I,
      L: element.length,
      qY: element.uniformLoadQY,
      localDisplacements: element.localDisplacements,
    }
    expect(recoverBeamDisplacementAt(displacementInput, 2).v).toBeCloseTo(-1 / 2400, 12)
    const roots = realPolynomialRootsInInterval(beamInternalForcePolynomials(internalInput).M, 0, 4)
    expect(roots[0]).toBeCloseTo(0.845299461620748, 9)
    expect(roots[1]).toBeCloseTo(3.15470053837925, 9)

    const extrema = findBeamElementExtrema({
      elementId: element.elementId,
      xI: element.xI,
      ...displacementInput,
      elementOnNodeEndForces: element.elementOnNodeEndForces,
    })
    expect(extrema.find(({ field, kind }) => field === 'M' && kind === 'max')).toMatchObject({
      localX: 2,
      globalX: 2,
    })
  })
})
