import { describe, expect, it } from 'vitest'

import {
  beamLocalStiffness,
  beamUniformLoadVector,
  recoverBeamElementOnNodeEndForces,
  recoverBeamResistingVector,
} from '../../../../src/core/structural/beam'

describe('P2 beam end-force recovery', () => {
  it('recovers BEAM-A06 axial resisting actions from displacement', () => {
    const stiffness = beamLocalStiffness({ E: 200e9, A: 0.001, I: 8e-6, L: 2 })
    const endForces = recoverBeamElementOnNodeEndForces(stiffness, [0, 0, 0, 0.001, 0, 0])

    expect(endForces).toEqual([100_000, 0, 0, -100_000, 0, 0])
    expect(endForces[0]).toBe(100_000)
  })

  it('distinguishes resisting k*d-f from element-on-node f-k*d', () => {
    const stiffness = beamLocalStiffness({ E: 200e9, A: 0.01, I: 8e-6, L: 4 })
    const load = beamUniformLoadVector(-10_000, 4)
    const resisting = recoverBeamResistingVector(stiffness, [0, 0, 0, 0, 0, 0], load)
    const elementOnNode = recoverBeamElementOnNodeEndForces(stiffness, [0, 0, 0, 0, 0, 0], load)
    expect(resisting).toEqual([
      0,
      20_000,
      40_000 / 3,
      0,
      20_000,
      -40_000 / 3,
    ])
    for (let index = 0; index < 6; index += 1) {
      expect(elementOnNode[index]! + resisting[index]!).toBe(0)
    }
  })

  it('balances equal/opposite axial actions across adjacent elements', () => {
    const stiffness = beamLocalStiffness({ E: 200e9, A: 0.001, I: 8e-6, L: 1 })
    const left = recoverBeamElementOnNodeEndForces(stiffness, [0, 0, 0, 0.001, 0, 0])
    const right = recoverBeamElementOnNodeEndForces(stiffness, [0.001, 0, 0, 0.002, 0, 0])
    expect(left[3] + right[0]).toBe(0)
  })

  it('rejects nonfinite vectors', () => {
    const stiffness = beamLocalStiffness({ E: 1, A: 1, I: 1, L: 1 })
    expect(() => recoverBeamResistingVector(stiffness, [0, 0, 0, Number.NaN, 0, 0])).toThrow('localDisplacements')
  })
})
