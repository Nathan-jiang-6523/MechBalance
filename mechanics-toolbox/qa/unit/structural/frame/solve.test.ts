import { describe, expect, it } from 'vitest'

import type { FrameModel2D } from '../../../../src/core/structural/contracts'
import { solveFrameFiniteElement } from '../../../../src/core/structural/frame/solve'
import { frameTransformationMatrix, localToGlobalVector } from '../../../../src/core/structural/frame/transform'

const properties = { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 } as const

function portal(constraints = [
  { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
  { nodeId: '1', dof: 'theta', value: 0 }, { nodeId: '4', dof: 'u', value: 0 },
  { nodeId: '4', dof: 'v', value: 0 }, { nodeId: '4', dof: 'theta', value: 0 },
] as const): FrameModel2D {
  return {
    analysis: 'frame', units: 'SI', materials: [], sections: [],
    nodes: [
      { id: '1', x: 0, y: 0 }, { id: '2', x: 0, y: 3 },
      { id: '3', x: 4, y: 3 }, { id: '4', x: 4, y: 0 },
    ],
    elements: [
      { type: 'frame', id: '12', nodeI: '1', nodeJ: '2', properties },
      { type: 'frame', id: '23', nodeI: '2', nodeJ: '3', properties },
      { type: 'frame', id: '43', nodeI: '4', nodeJ: '3', properties },
    ],
    constraints,
    loads: [
      { type: 'nodal', id: 'H2', nodeId: '2', fx: 6000 },
      { type: 'nodal', id: 'H3', nodeId: '3', fx: 6000 },
    ],
  }
}

function solve(model: FrameModel2D) {
  const result = solveFrameFiniteElement(model)
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('; '))
  return result.value
}

function expectJsonFiniteData(value: unknown): void {
  expect(typeof value).not.toBe('function')
  expect(typeof value).not.toBe('symbol')
  expect(typeof value).not.toBe('bigint')
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(expectJsonFiniteData)
    return
  }
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(expectJsonFiniteData)
  }
}

describe('P2 frame solve orchestration', () => {
  it('solves FRAME-A01 portal displacements, reactions, and member end moments', () => {
    const result = solve(portal())
    const node = (id: string) => result.nodes.find(({ nodeId }) => nodeId === id)!
    expect(node('2').u).toBeCloseTo(0.00130736068252, 12)
    expect(node('3').u).toBeCloseTo(0.00130736068252, 12)
    expect(node('2').theta).toBeCloseTo(-0.000309073788346, 12)
    expect(node('2').v).toBeCloseTo(0.00000551370484661, 12)
    expect(node('3').v).toBeCloseTo(-0.00000551370484661, 12)
    expect(node('1').reactionFx).toBeCloseTo(-6000, 6)
    expect(node('1').reactionFy).toBeCloseTo(-3675.80323108, 6)
    expect(node('1').reactionMz).toBeCloseTo(10648.3935378, 6)
    expect(node('4').reactionFy).toBeCloseTo(3675.80323108, 6)
    expect(result.checks.every(({ passed }) => passed)).toBe(true)

    const leftColumn = result.elements.find(({ elementId }) => elementId === '12')!
    const beam = result.elements.find(({ elementId }) => elementId === '23')!
    // Element-on-node convention is opposite to conventional member resisting actions.
    expect(leftColumn.localEndForces[5]).toBeCloseTo(-7351.60646215, 6)
    expect(beam.localEndForces[2]).toBeCloseTo(7351.60646215, 6)
    expect(leftColumn.localResistingForces[5]).toBeCloseTo(7351.60646215, 6)
    expect(beam.localResistingForces[2]).toBeCloseTo(-7351.60646215, 6)
    leftColumn.localEndForces.forEach((value, index) => {
      expect(value).toBe(-leftColumn.localResistingForces[index]!)
    })
    expect(leftColumn.globalEndForces).toEqual(localToGlobalVector(
      leftColumn.localEndForces,
      frameTransformationMatrix(leftColumn.cosine, leftColumn.sine),
    ))
    expect(leftColumn.localEndForceResult.coordinateSystem).toBe('local')
    expect(leftColumn.globalEndForceResult.coordinateSystem).toBe('global')
    expect(leftColumn.endForces).toBe(leftColumn.localEndForceResult)

    const elementActions = new Map(result.nodes.map(({ nodeId }) => [nodeId, [0, 0, 0]] as const))
    result.elements.forEach((element) => {
      const global = localToGlobalVector(
        element.localEndForces,
        frameTransformationMatrix(element.cosine, element.sine),
      )
      const atI = elementActions.get(element.nodeI)!
      const atJ = elementActions.get(element.nodeJ)!
      for (let dof = 0; dof < 3; dof += 1) {
        atI[dof] = atI[dof]! + global[dof]!
        atJ[dof] = atJ[dof]! + global[dof + 3]!
      }
    })
    result.nodes.forEach((current) => {
      const action = elementActions.get(current.nodeId)!
      const external = current.nodeId === '2' || current.nodeId === '3' ? [6000, 0, 0] : [0, 0, 0]
      const reaction = [current.reactionFx, current.reactionFy, current.reactionMz]
      action.forEach((value, dof) => {
        expect(Math.abs(value + external[dof]! + reaction[dof]!)).toBeLessThanOrEqual(1e-6)
      })
    })
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'node-equilibrium', passed: true }),
      expect.objectContaining({ id: 'node-moment-equilibrium', passed: true }),
    ]))
    expectJsonFiniteData(result)
    const restored = JSON.parse(JSON.stringify(result)) as typeof result
    expect(restored).toEqual(result)
    expectJsonFiniteData(restored)
  })

  it('superposes fixed uniform temperature and initial strain', () => {
    const model: FrameModel2D = {
      analysis: 'frame', units: 'SI', materials: [], sections: [],
      nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
      elements: [{ type: 'frame', id: 'e', nodeI: '1', nodeJ: '2', properties: {
        source: 'inline', E: 200e9, A: 0.001, I: 8e-6, alpha: 12e-6,
      } }],
      constraints: ['u', 'v', 'theta'].flatMap((dof) => [
        { nodeId: '1', dof, value: 0 }, { nodeId: '2', dof, value: 0 },
      ]) as FrameModel2D['constraints'],
      loads: [
        { type: 'uniform-temperature', id: 'T', elementId: 'e', deltaT: 50 },
        { type: 'initial-strain', id: 'e0', elementId: 'e', strain: 500e-6 },
      ],
    }
    const result = solve(model)
    expect(result.elements[0]!.freeStrain).toBeCloseTo(0.0011, 15)
    expect(result.elements[0]!.localEndForces).toEqual([-220_000, 0, 0, 220_000, 0, 0])
    expect(result.nodes[0]!.reactionFx).toBe(220_000)
    expect(result.nodes[1]!.reactionFx).toBe(-220_000)
  })

  it('transforms combined local distributed load on an inclined fixed member', () => {
    const allFixed = ['u', 'v', 'theta'].flatMap((dof) => [
      { nodeId: '1', dof, value: 0 }, { nodeId: '2', dof, value: 0 },
    ]) as FrameModel2D['constraints']
    const model: FrameModel2D = {
      analysis: 'frame', units: 'SI', materials: [], sections: [],
      nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 3 }],
      elements: [{ type: 'frame', id: 'e', nodeI: '1', nodeJ: '2', properties }],
      constraints: allFixed,
      loads: [{ type: 'frame-uniform', id: 'q', elementId: 'e', qX: 1_000, qY: -2_000 }],
    }
    const result = solve(model)
    const local = [2_500, -5_000, -12_500 / 3, 2_500, -5_000, 12_500 / 3] as const
    const expectedGlobal = localToGlobalVector(local, frameTransformationMatrix(0.8, 0.6))
    result.elements[0]!.equivalentDistributedLoad.forEach((value, index) => {
      expect(value).toBeCloseTo(local[index]!, 9)
    })
    result.appliedLoads.forEach((value, index) => {
      expect(value).toBeCloseTo(expectedGlobal[index]!, 9)
      expect(result.nodes[Math.floor(index / 3)]![
        (['reactionFx', 'reactionFy', 'reactionMz'] as const)[index % 3]!
      ]).toBeCloseTo(-expectedGlobal[index]!, 9)
    })
    expect(result.elements[0]!.distributedLoads).toEqual([
      { qX: 1_000, qY: -2_000, a: 0, b: 5 },
    ])
  })

  it('rejects unconstrained portal with FRAME-N01 exact mechanism issue', () => {
    const result = solveFrameFiniteElement(portal([]))
    expect(result).toEqual({
      ok: false,
      issues: [{
        code: 'P2_SINGULAR_STIFFNESS', severity: 'error', field: 'constraints',
        message: '框架整体刚度矩阵奇异：约束不足',
      }],
    })
  })
})
