import { describe, expect, it } from 'vitest'

import fixture from '../../../fixtures/p2-frame.json'
import type { FrameModel2D } from '../../../../src/core/structural/contracts'
import {
  frameFreeStrain,
  frameGlobalStiffness,
  frameInitialStrainLoadVector,
  frameLocalStiffness,
  frameTransformationMatrix,
  frameUniformLoadVector,
  type FrameMatrix6,
} from '../../../../src/core/structural/frame'
import {
  recoverFrameFiberStressAt,
  recoverFrameInternalForcesAt,
} from '../../../../src/core/structural/frame/field'
import { solveFrameFiniteElement } from '../../../../src/core/structural/frame/solve'

const standardInline = { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 } as const

function base(
  nodes: FrameModel2D['nodes'],
  elements: FrameModel2D['elements'],
  constraints: FrameModel2D['constraints'],
  loads: FrameModel2D['loads'],
): FrameModel2D {
  return { analysis: 'frame', units: 'SI', materials: [], sections: [], nodes, elements, constraints, loads }
}

function fixed(nodeId: string): FrameModel2D['constraints'] {
  return (['u', 'v', 'theta'] as const).map((dof) => ({ nodeId, dof, value: 0 }))
}

function value(model: FrameModel2D) {
  const result = solveFrameFiniteElement(model)
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

function multiply(matrix: FrameMatrix6, vector: readonly number[]): number[] {
  return matrix.map((row) => row.reduce(
    (sum, coefficient, column) => sum + coefficient * vector[column]!,
    0,
  ))
}

function matrixRank(matrix: FrameMatrix6): number {
  const reduced = matrix.map((row) => [...row])
  const scale = Math.max(...reduced.flat().map(Math.abs))
  let rank = 0
  for (let column = 0; column < 6; column += 1) {
    const pivot = Array.from({ length: 6 - rank }, (_, offset) => rank + offset)
      .reduce((best, row) => Math.abs(reduced[row]![column]!) > Math.abs(reduced[best]![column]!) ? row : best, rank)
    if (Math.abs(reduced[pivot]![column]!) <= scale * 1e-10) continue
    ;[reduced[rank], reduced[pivot]] = [reduced[pivot]!, reduced[rank]!]
    for (let row = rank + 1; row < 6; row += 1) {
      const factor = reduced[row]![column]! / reduced[rank]![column]!
      for (let inner = column; inner < 6; inner += 1) {
        reduced[row]![inner] -= factor * reduced[rank]![inner]!
      }
    }
    rank += 1
  }
  return rank
}

describe('P2 frozen frame acceptance', () => {
  it('is tied to the confirmed fixture set', () => {
    expect(fixture.fixtureVersion).toBe('P2-FRAME-FIXTURES-v1')
    expect(fixture.common.endForces)
      .toBe('localEndForces=f_eq-k_l*d_l; element-on-node; local axes i->j; use for node equilibrium')
    expect(fixture.common.memberResistingActions)
      .toBe('localResistingForces=k_l*d_l-f_eq=-localEndForces')
    expect(fixture.cases.map(({ id }) => id)).toEqual([
      'P2-FRAME-E01', 'P2-FRAME-A01', 'P2-FRAME-A02', 'P2-FRAME-A03',
      'P2-FRAME-T01', 'P2-FRAME-IS01', 'P2-FRAME-N01', 'P2-FRAME-X01',
    ])
    expect(fixture.cases.every(({ status }) => status === 'confirmed-three-independent-reviews')).toBe(true)
  })

  it('matches FRAME-E01 local stiffness, transform, and rigid modes', () => {
    const local = frameLocalStiffness({ E: 200e9, A: 0.01, I: 8e-5, L: 5 })
    const expected = [
      [400e6, 0, 0, -400e6, 0, 0],
      [0, 1_536_000, 3_840_000, 0, -1_536_000, 3_840_000],
      [0, 3_840_000, 12_800_000, 0, -3_840_000, 6_400_000],
      [-400e6, 0, 0, 400e6, 0, 0],
      [0, -1_536_000, -3_840_000, 0, 1_536_000, -3_840_000],
      [0, 3_840_000, 6_400_000, 0, -3_840_000, 12_800_000],
    ]
    local.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
      expect(value).toBeCloseTo(expected[rowIndex]![columnIndex]!, 6)
      expect(value).toBeCloseTo(local[columnIndex]![rowIndex]!, 10)
    }))

    const transformation = frameTransformationMatrix(0.8, 0.6)
    expect(transformation).toEqual([
      [0.8, 0.6, 0, 0, 0, 0], [-0.6, 0.8, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0.8, 0.6, 0], [0, 0, 0, -0.6, 0.8, 0], [0, 0, 0, 0, 0, 1],
    ])
    const global = frameGlobalStiffness(local, transformation)
    global.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
      expect(value).toBeCloseTo(global[columnIndex]![rowIndex]!, 6)
    }))
    expect(matrixRank(global)).toBe(3)
    for (const rigidMode of [
      [1, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0],
      [0, 0, 1, -3, 4, 1],
    ]) {
      expect(Math.max(...multiply(global, rigidMode).map(Math.abs))).toBeLessThanOrEqual(1e-6)
    }
  })

  it('matches FRAME-A01 portal displacements, reactions, and explicitly named end actions', () => {
    const result = value(base(
      [
        { id: '1', x: 0, y: 0 }, { id: '2', x: 0, y: 3 },
        { id: '3', x: 4, y: 3 }, { id: '4', x: 4, y: 0 },
      ],
      [
        { type: 'frame', id: '12', nodeI: '1', nodeJ: '2', properties: standardInline },
        { type: 'frame', id: '23', nodeI: '2', nodeJ: '3', properties: standardInline },
        { type: 'frame', id: '43', nodeI: '4', nodeJ: '3', properties: standardInline },
      ],
      [...fixed('1'), ...fixed('4')],
      [
        { type: 'nodal', id: 'H2', nodeId: '2', fx: 6_000 },
        { type: 'nodal', id: 'H3', nodeId: '3', fx: 6_000 },
      ],
    ))
    expect(node(result, '2').u).toBeCloseTo(0.00130736068252, 10)
    expect(node(result, '3').u).toBeCloseTo(0.00130736068252, 10)
    expect(node(result, '2').v).toBeCloseTo(0.00000551370484661, 12)
    expect(node(result, '3').v).toBeCloseTo(-0.00000551370484661, 12)
    expect(node(result, '2').theta).toBeCloseTo(-0.000309073788346, 11)
    expect(node(result, '3').theta).toBeCloseTo(-0.000309073788346, 11)
    expect(node(result, '1').reactionFx).toBeCloseTo(-6_000, 7)
    expect(node(result, '1').reactionFy).toBeCloseTo(-3_675.80323108, 5)
    expect(node(result, '1').reactionMz).toBeCloseTo(10_648.3935378, 4)
    expect(node(result, '4').reactionFx).toBeCloseTo(-6_000, 7)
    expect(node(result, '4').reactionFy).toBeCloseTo(3_675.80323108, 5)
    expect(node(result, '4').reactionMz).toBeCloseTo(10_648.3935378, 4)

    // Frozen A01 end-action numbers are member resisting actions k_l*d_l-f_eq.
    expect(element(result, '12').localResistingForces[5]).toBeCloseTo(7_351.60646215, 5)
    expect(element(result, '43').localResistingForces[5]).toBeCloseTo(7_351.60646215, 5)
    expect(element(result, '23').localResistingForces[1]).toBeCloseTo(-3_675.80323108, 5)
    expect(element(result, '23').localResistingForces[2]).toBeCloseTo(-7_351.60646215, 5)
    expect(element(result, '23').localResistingForces[4]).toBeCloseTo(3_675.80323108, 5)
    expect(element(result, '23').localResistingForces[5]).toBeCloseTo(-7_351.60646215, 5)
    result.elements.forEach(({ localEndForces, localResistingForces }) => {
      localEndForces.forEach((force, index) => {
        expect(force).toBeCloseTo(-localResistingForces[index]!, 7)
      })
    })
    // Public element-on-node localEndForces=f_eq-k_l*d_l are opposite and close node equilibrium.
    const columnTop = element(result, '12').localEndForces
    const beamLeft = element(result, '23').localEndForces
    expect(-columnTop[4] + beamLeft[0] + 6_000).toBeCloseTo(0, 6)
    expect(columnTop[3] + beamLeft[1]).toBeCloseTo(0, 6)
    expect(columnTop[5] + beamLeft[2]).toBeCloseTo(0, 6)
  })

  it('matches FRAME-A02 full-span consistent distributed load', () => {
    const load = frameUniformLoadVector(-10_000, 4)
    const expected = [0, -20_000, -13_333.3333333333, 0, -20_000, 13_333.3333333333]
    load.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 8))

    const field = {
      elementId: 'e', L: 4, elementOnNodeEndForces: load,
      distributedLoads: [{ qY: -10_000, a: 0, b: 4 }],
    }
    expect(recoverFrameInternalForcesAt(field, 0)).toMatchObject({ N: 0, V: 20_000 })
    expect(recoverFrameInternalForcesAt(field, 0).M).toBeCloseTo(-13_333.3333333333, 8)
    expect(recoverFrameInternalForcesAt(field, 2).M).toBeCloseTo(6_666.66666666667, 8)
    expect(recoverFrameInternalForcesAt(field, 4)).toMatchObject({ N: 0, V: -20_000 })
    expect(recoverFrameInternalForcesAt(field, 4).M).toBeCloseTo(-13_333.3333333333, 8)
    expect(recoverFrameFiberStressAt(field, 0, 0.12, 0.01, 8e-5).stress / 1e6).toBeCloseTo(20, 8)
    expect(recoverFrameFiberStressAt(field, 0, -0.12, 0.01, 8e-5).stress / 1e6).toBeCloseTo(-20, 8)
    expect(recoverFrameFiberStressAt(field, 2, 0.12, 0.01, 8e-5).stress / 1e6).toBeCloseTo(-10, 8)
    expect(recoverFrameFiberStressAt(field, 2, -0.12, 0.01, 8e-5).stress / 1e6).toBeCloseTo(10, 8)

    const result = value(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }],
      [{ type: 'frame', id: 'e', nodeI: '1', nodeJ: '2', properties: standardInline }],
      [...fixed('1'), ...fixed('2')],
      [{ type: 'frame-uniform', id: 'q', elementId: 'e', qY: -10_000 }],
    ))
    expect(result.displacements).toEqual([0, 0, 0, 0, 0, 0])
    expect(node(result, '1').reactionFy).toBeCloseTo(20_000, 8)
    expect(node(result, '1').reactionMz).toBeCloseTo(13_333.3333333333, 8)
    expect(node(result, '2').reactionFy).toBeCloseTo(20_000, 8)
    expect(node(result, '2').reactionMz).toBeCloseTo(-13_333.3333333333, 8)
    element(result, 'e').localEndForces.forEach((value, index) => {
      expect(value).toBeCloseTo(expected[index]!, 8)
    })
  })

  it('matches FRAME-A03 half-span consistent distributed load', () => {
    const load = frameUniformLoadVector(-10_000, 4, { a: 0, b: 2 })
    const expected = [0, -16_250, -9_166.66666666667, 0, -3_750, 4_166.66666666667]
    load.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 8))
    expect(load[1] + load[4]).toBeCloseTo(-20_000, 8)
    expect(load[2] + load[4] * 4 + load[5]).toBeCloseTo(-20_000, 8)

    const field = {
      elementId: 'e', L: 4,
      elementOnNodeEndForces: [0, -15_000, 0, 0, -5_000, 0] as const,
      distributedLoads: [{ qY: -10_000, a: 0, b: 2 }],
    }
    expect(recoverFrameInternalForcesAt(field, 0)).toMatchObject({ N: 0, V: 15_000, M: 0 })
    expect(recoverFrameInternalForcesAt(field, 1.5).M).toBeCloseTo(11_250, 8)
    expect(recoverFrameInternalForcesAt(field, 2)).toMatchObject({ N: 0, V: -5_000, M: 10_000 })
    expect(recoverFrameInternalForcesAt(field, 4)).toMatchObject({ N: 0, V: -5_000, M: 0 })

    const result = value(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }],
      [{ type: 'frame', id: 'e', nodeI: '1', nodeJ: '2', properties: standardInline }],
      [
        { nodeId: '1', dof: 'u', value: 0 }, { nodeId: '1', dof: 'v', value: 0 },
        { nodeId: '2', dof: 'v', value: 0 },
      ],
      [{ type: 'frame-uniform', id: 'q', elementId: 'e', qY: -10_000, interval: { a: 0, b: 2 } }],
    ))
    expect(node(result, '1').reactionFy).toBeCloseTo(15_000, 7)
    expect(node(result, '2').reactionFy).toBeCloseTo(5_000, 7)
    expect(node(result, '1').reactionMz).toBeCloseTo(0, 7)
    expect(node(result, '2').reactionMz).toBeCloseTo(0, 7)
    expect(node(result, '1').theta).toBeCloseTo(-0.0009375, 11)
    expect(node(result, '2').theta).toBeCloseTo(0.000729166666666667, 11)
    expect(element(result, 'e').localEndForces[1]).toBeCloseTo(-15_000, 7)
    expect(element(result, 'e').localEndForces[4]).toBeCloseTo(-5_000, 7)
  })

  it('matches FRAME-T01 and IS01 equivalent free-strain loads', () => {
    expect(frameFreeStrain(12e-6, 50)).toBeCloseTo(0.0006, 15)
    frameInitialStrainLoadVector(200e9, 0.001, 0.0006).forEach((value, index) => {
      expect(value).toBeCloseTo([-120_000, 0, 0, 120_000, 0, 0][index]!, 8)
    })
    frameInitialStrainLoadVector(200e9, 0.001, 500e-6).forEach((value, index) => {
      expect(value).toBeCloseTo([-100_000, 0, 0, 100_000, 0, 0][index]!, 8)
    })

    const imposed = (properties: typeof thermalInline, loads: FrameModel2D['loads']) => value(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
      [{ type: 'frame', id: 'e', nodeI: '1', nodeJ: '2', properties }],
      [...fixed('1'), ...fixed('2')],
      loads,
    ))
    const thermalInline = { source: 'inline', E: 200e9, A: 0.001, I: 8e-6, alpha: 12e-6 } as const
    const thermal = imposed(thermalInline, [
      { type: 'uniform-temperature', id: 'T', elementId: 'e', deltaT: 50 },
    ])
    expect(thermal.displacements).toEqual([0, 0, 0, 0, 0, 0])
    expect(element(thermal, 'e').freeStrain).toBeCloseTo(0.0006, 15)
    expect(element(thermal, 'e').localEndForces[0]).toBeCloseTo(-120_000, 8)
    expect(element(thermal, 'e').localEndForces[3]).toBeCloseTo(120_000, 8)
    expect(node(thermal, '1').reactionFx).toBeCloseTo(120_000, 8)
    expect(node(thermal, '2').reactionFx).toBeCloseTo(-120_000, 8)
    ;[1, 2, 4, 5].forEach((index) => expect(element(thermal, 'e').localEndForces[index]).toBe(0))

    const initial = imposed(thermalInline, [
      { type: 'initial-strain', id: 'e0', elementId: 'e', strain: 500e-6 },
    ])
    expect(initial.displacements).toEqual([0, 0, 0, 0, 0, 0])
    expect(element(initial, 'e').localEndForces[0]).toBeCloseTo(-100_000, 8)
    expect(element(initial, 'e').localEndForces[3]).toBeCloseTo(100_000, 8)
    expect(node(initial, '1').reactionFx).toBeCloseTo(100_000, 8)
    expect(node(initial, '2').reactionFx).toBeCloseTo(-100_000, 8)
    ;[1, 2, 4, 5].forEach((index) => expect(element(initial, 'e').localEndForces[index]).toBe(0))
  })

  it('matches FRAME-N01 mechanism and zero-length failures without success values', () => {
    const portalElements: FrameModel2D['elements'] = [
      { type: 'frame', id: '12', nodeI: '1', nodeJ: '2', properties: standardInline },
      { type: 'frame', id: '23', nodeI: '2', nodeJ: '3', properties: standardInline },
      { type: 'frame', id: '43', nodeI: '4', nodeJ: '3', properties: standardInline },
    ]
    const mechanism = solveFrameFiniteElement(base(
      [
        { id: '1', x: 0, y: 0 }, { id: '2', x: 0, y: 3 },
        { id: '3', x: 4, y: 3 }, { id: '4', x: 4, y: 0 },
      ],
      portalElements,
      [],
      [{ type: 'nodal', id: 'H', nodeId: '2', fx: 6_000 }],
    ))
    expect(mechanism.ok).toBe(false)
    if (mechanism.ok) throw new Error('FRAME-N01(a) unexpectedly solved')
    expect(mechanism.issues[0]).toMatchObject({
      code: 'P2_SINGULAR_STIFFNESS', severity: 'error', field: 'constraints',
      message: '框架整体刚度矩阵奇异：约束不足',
    })
    expect('value' in mechanism).toBe(false)

    const zeroLength = solveFrameFiniteElement(base(
      [{ id: '1', x: 0, y: 0 }, { id: '2', x: 0, y: 0 }],
      [{ type: 'frame', id: '1', nodeI: '1', nodeJ: '2', properties: standardInline }],
      [...fixed('1'), ...fixed('2')],
      [],
    ))
    expect(zeroLength.ok).toBe(false)
    if (zeroLength.ok) throw new Error('FRAME-N01(b) unexpectedly solved')
    expect(zeroLength.issues[0]).toMatchObject({
      code: 'P2_ZERO_LENGTH_ELEMENT', severity: 'error', field: 'elements[0].nodeJ',
      message: '框架单元 1 长度为零',
    })
    expect('value' in zeroLength).toBe(false)
  })
})
