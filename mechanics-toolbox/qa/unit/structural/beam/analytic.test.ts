import { describe, expect, it } from 'vitest'

import {
  solveBeamFiniteElement,
  type BeamFiniteElementSolution,
} from '../../../../src/core/structural/beam'
import type {
  BeamLoad,
  BeamModel2D,
  ZeroConstraint,
} from '../../../../src/core/structural/contracts'

const E = 200e9
const A = 0.01
const I = 8e-6

function beamModel(
  xs: readonly number[],
  loads: readonly BeamLoad[],
  constraints: readonly ZeroConstraint[],
  properties = { E, A, I },
): BeamModel2D {
  return {
    analysis: 'beam',
    units: 'SI',
    topology: 'single-span',
    propertyPolicy: 'uniform',
    uniformProperties: { source: 'inline', ...properties },
    nodes: xs.map((x, index) => ({ id: `n${index}`, x, y: 0 })),
    materials: [],
    sections: [],
    elements: xs.slice(1).map((_, index) => ({
      type: 'beam', id: `e${index}`, nodeI: `n${index}`, nodeJ: `n${index + 1}`,
    })),
    constraints,
    loads,
  }
}

function solved(model: BeamModel2D): BeamFiniteElementSolution {
  const result = solveBeamFiniteElement(model)
  expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  expect(result.value.checks.every(({ passed }) => passed)).toBe(true)
  return result.value
}

function internalAtI(forces: readonly number[]) {
  return { N: forces[0]!, V: -forces[1]!, M: forces[2]! }
}

function internalAtJ(forces: readonly number[]) {
  return { N: -forces[3]!, V: forces[4]!, M: -forces[5]! }
}

const simpleSupports = (last: number): readonly ZeroConstraint[] => [
  { nodeId: 'n0', dof: 'u', value: 0 },
  { nodeId: 'n0', dof: 'v', value: 0 },
  { nodeId: `n${last}`, dof: 'v', value: 0 },
]

describe('Gate P2-1 analytic beam acceptance', () => {
  it('P2-BEAM-A01: simply-supported central point load', () => {
    const solution = solved(beamModel(
      [0, 2, 4],
      [{ type: 'nodal', id: 'p', nodeId: 'n1', fy: -40_000 }],
      simpleSupports(2),
    ))

    expect(solution.nodes[1]!.v).toBeCloseTo(-0.0333333333333, 10)
    expect(solution.nodes[0]!.reactionFy).toBeCloseTo(20_000, 7)
    expect(solution.nodes[2]!.reactionFy).toBeCloseTo(20_000, 7)
    const leftEnd = internalAtI(solution.elements[0]!.elementOnNodeEndForces)
    expect(leftEnd.N).toBe(0)
    expect(leftEnd.V).toBeCloseTo(20_000, 7)
    expect(leftEnd.M).toBeCloseTo(0, 7)
    expect(internalAtJ(solution.elements[0]!.elementOnNodeEndForces).M).toBeCloseTo(40_000, 7)
    expect(internalAtI(solution.elements[1]!.elementOnNodeEndForces).V).toBeCloseTo(-20_000, 7)
    const rightEnd = internalAtJ(solution.elements[1]!.elementOnNodeEndForces)
    expect(rightEnd.N).toBeCloseTo(0, 12)
    expect(rightEnd.V).toBeCloseTo(-20_000, 7)
    expect(rightEnd.M).toBeCloseTo(0, 7)
    const leftAtMid = solution.elements[0]!.elementOnNodeEndForces.slice(3)
    const rightAtMid = solution.elements[1]!.elementOnNodeEndForces.slice(0, 3)
    expect(leftAtMid[1]! + rightAtMid[1]! - 40_000).toBeCloseTo(0, 7)
    expect(leftAtMid[2]! + rightAtMid[2]!).toBeCloseTo(0, 7)
  })

  it('P2-BEAM-A02/C01: UDL mesh sequence keeps the frozen interpolation error', () => {
    const midpointValues: number[] = []
    for (const n of [1, 2, 4]) {
      const xs = Array.from({ length: n + 1 }, (_, index) => (4 * index) / n)
      const loads = Array.from({ length: n }, (_, index) => ({
        type: 'beam-uniform' as const,
        id: `q${index}`,
        elementId: `e${index}`,
        qY: -10_000,
      }))
      const solution = solved(beamModel(xs, loads, simpleSupports(n)))
      expect(solution.nodes[0]!.reactionFy).toBeCloseTo(20_000, 7)
      expect(solution.nodes[n]!.reactionFy).toBeCloseTo(20_000, 7)
      for (const [index, element] of solution.elements.entries()) {
        const xI = xs[index]!
        const xJ = xs[index + 1]!
        const atI = internalAtI(element.elementOnNodeEndForces)
        const atJ = internalAtJ(element.elementOnNodeEndForces)
        expect(atI.V).toBeCloseTo(20_000 - 10_000 * xI, 6)
        expect(atJ.V).toBeCloseTo(20_000 - 10_000 * xJ, 6)
        expect(atI.M).toBeCloseTo(20_000 * xI - 5_000 * xI ** 2, 6)
        expect(atJ.M).toBeCloseTo(20_000 * xJ - 5_000 * xJ ** 2, 6)
      }
      if (n === 1) {
        const thetaI = solution.nodes[0]!.theta
        const thetaJ = solution.nodes[1]!.theta
        const hermiteOnly = 4 * 0.125 * thetaI - 4 * 0.125 * thetaJ
        const loadParticular = (-10_000 / (24 * E * I)) * 2 ** 2 * (4 - 2) ** 2
        midpointValues.push(hermiteOnly)
        expect(hermiteOnly + loadParticular).toBeCloseTo(-0.0208333333333, 10)
      } else {
        midpointValues.push(solution.nodes[n / 2]!.v)
        expect(-solution.elements[n / 2 - 1]!.elementOnNodeEndForces[5]).toBeCloseTo(20_000, 6)
      }
    }

    expect(midpointValues[0]).toBeCloseTo(-0.0166666666667, 10)
    expect(midpointValues[1]).toBeCloseTo(-0.0208333333333, 10)
    expect(midpointValues[2]).toBeCloseTo(-0.0208333333333, 10)
    const stationaryX = 20_000 / 10_000
    expect(stationaryX).toBe(2)
    expect(20_000 * stationaryX - 5_000 * stationaryX ** 2).toBe(20_000)
  })

  it('P2-BEAM-A03: cantilever free-end point load', () => {
    const solution = solved(beamModel(
      [0, 3],
      [{ type: 'nodal', id: 'p', nodeId: 'n1', fy: -10_000 }],
      [
        { nodeId: 'n0', dof: 'u', value: 0 },
        { nodeId: 'n0', dof: 'v', value: 0 },
        { nodeId: 'n0', dof: 'theta', value: 0 },
      ],
    ))

    expect(solution.nodes[1]!.theta).toBeCloseTo(-0.028125, 10)
    expect(solution.nodes[1]!.v).toBeCloseTo(-0.05625, 10)
    expect(solution.nodes[0]!.reactionFy).toBeCloseTo(10_000, 7)
    expect(solution.nodes[0]!.reactionMz).toBeCloseTo(30_000, 7)
    const endForces = solution.elements[0]!.elementOnNodeEndForces
    ;[0, -10_000, -30_000, 0, 10_000, 0].forEach((expected, index) => {
      expect(endForces[index]).toBeCloseTo(expected, 7)
    })
    expect(internalAtI(endForces).N).toBe(0)
    expect(internalAtI(endForces).V).toBeCloseTo(10_000, 7)
    expect(internalAtI(endForces).M).toBeCloseTo(-30_000, 7)
    expect(internalAtJ(endForces).N).toBeCloseTo(0, 12)
    expect(internalAtJ(endForces).V).toBeCloseTo(10_000, 7)
    expect(internalAtJ(endForces).M).toBeCloseTo(0, 7)
  })

  it('P2-BEAM-A04: cantilever full-span UDL', () => {
    const solution = solved(beamModel(
      [0, 1, 2, 3],
      [0, 1, 2].map((index) => ({
        type: 'beam-uniform' as const, id: `q${index}`, elementId: `e${index}`, qY: -4_000,
      })),
      [
        { nodeId: 'n0', dof: 'u', value: 0 },
        { nodeId: 'n0', dof: 'v', value: 0 },
        { nodeId: 'n0', dof: 'theta', value: 0 },
      ],
    ))

    expect(solution.nodes[3]!.theta).toBeCloseTo(-0.01125, 10)
    expect(solution.nodes[3]!.v).toBeCloseTo(-0.0253125, 10)
    expect(solution.nodes[0]!.reactionFy).toBeCloseTo(12_000, 7)
    expect(solution.nodes[0]!.reactionMz).toBeCloseTo(18_000, 7)
    for (const [index, element] of solution.elements.entries()) {
      const xI = index
      const xJ = index + 1
      const atI = internalAtI(element.elementOnNodeEndForces)
      const atJ = internalAtJ(element.elementOnNodeEndForces)
      expect(atI.V).toBeCloseTo(4_000 * (3 - xI), 6)
      expect(atJ.V).toBeCloseTo(4_000 * (3 - xJ), 6)
      expect(atI.M).toBeCloseTo(-2_000 * (3 - xI) ** 2, 6)
      expect(atJ.M).toBeCloseTo(-2_000 * (3 - xJ) ** 2, 6)
    }
  })

  it('P2-BEAM-A05: point force and moment superpose', () => {
    const constraints: readonly ZeroConstraint[] = [
      { nodeId: 'n0', dof: 'u', value: 0 },
      { nodeId: 'n0', dof: 'v', value: 0 },
      { nodeId: 'n0', dof: 'theta', value: 0 },
    ]
    const solution = solved(beamModel(
      [0, 2],
      [{ type: 'nodal', id: 'combined', nodeId: 'n1', fy: -6_000, mz: 4_000 }],
      constraints,
    ))
    const forceOnly = solved(beamModel(
      [0, 2], [{ type: 'nodal', id: 'p', nodeId: 'n1', fy: -6_000 }], constraints,
    ))
    const momentOnly = solved(beamModel(
      [0, 2], [{ type: 'nodal', id: 'm', nodeId: 'n1', mz: 4_000 }], constraints,
    ))

    expect(solution.nodes[1]!.theta).toBeCloseTo(-0.0025, 10)
    expect(solution.nodes[1]!.v).toBeCloseTo(-0.005, 10)
    expect(solution.nodes[0]!.reactionFy).toBeCloseTo(6_000, 7)
    expect(solution.nodes[0]!.reactionMz).toBeCloseTo(8_000, 7)
    expect(forceOnly.nodes[1]!.theta).toBeCloseTo(-0.0075, 12)
    expect(forceOnly.nodes[1]!.v).toBeCloseTo(-0.01, 12)
    expect(momentOnly.nodes[1]!.theta).toBeCloseTo(0.005, 12)
    expect(momentOnly.nodes[1]!.v).toBeCloseTo(0.005, 12)
    expect(solution.nodes[1]!.v).toBeCloseTo(forceOnly.nodes[1]!.v + momentOnly.nodes[1]!.v, 12)
    expect(solution.nodes[1]!.theta).toBeCloseTo(forceOnly.nodes[1]!.theta + momentOnly.nodes[1]!.theta, 12)
    expect(internalAtI(solution.elements[0]!.elementOnNodeEndForces)).toMatchObject({ N: 0, V: 6_000 })
    expect(internalAtI(solution.elements[0]!.elementOnNodeEndForces).M).toBeCloseTo(-8_000, 7)
    expect(internalAtJ(solution.elements[0]!.elementOnNodeEndForces).M).toBeCloseTo(4_000, 7)
  })

  it('P2-BEAM-A06: axial u DOF, axial force and element-on-node signs', () => {
    const solution = solved(beamModel(
      [0, 2],
      [{ type: 'nodal', id: 'p', nodeId: 'n1', fx: 100_000 }],
      [
        { nodeId: 'n0', dof: 'u', value: 0 },
        { nodeId: 'n0', dof: 'v', value: 0 },
        { nodeId: 'n0', dof: 'theta', value: 0 },
        { nodeId: 'n1', dof: 'v', value: 0 },
        { nodeId: 'n1', dof: 'theta', value: 0 },
      ],
      { E, A: 0.001, I },
    ))

    expect(solution.nodes[1]!.u).toBeCloseTo(0.001, 12)
    expect(solution.nodes[0]!.reactionFx).toBeCloseTo(-100_000, 7)
    expect(solution.nodes[1]!.v).toBe(0)
    expect(solution.nodes[1]!.theta).toBe(0)
    expect(solution.nodes[0]!.reactionFy).toBe(0)
    expect(solution.nodes[0]!.reactionMz).toBe(0)
    expect(solution.elements[0]!.elementOnNodeEndForces).toEqual([
      100_000, 0, 0, -100_000, 0, 0,
    ])
    const axialForce = solution.elements[0]!.elementOnNodeEndForces[0]
    expect(axialForce).toBe(100_000)
    expect(axialForce / 0.001).toBe(100e6)
    expect(internalAtI(solution.elements[0]!.elementOnNodeEndForces).N).toBe(100_000)
    expect(internalAtJ(solution.elements[0]!.elementOnNodeEndForces).N).toBe(100_000)
  })
})
