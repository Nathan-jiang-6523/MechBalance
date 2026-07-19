import { describe, expect, it } from 'vitest'

import {
  beamFreeDofEquilibriumChecks,
  beamGlobalBalanceChecks,
  freeDofEquilibriumCheck,
  matrixVectorProduct,
  strainEnergyCheck,
} from '../../../../src/core/structural/checks'

describe('P2 linear system checks', () => {
  it('checks free-DOF residual and linear strain energy', () => {
    const stiffness = [[2, -1], [-1, 1]]
    const displacement = [0, 3]
    const load = [-3, 3]

    expect(freeDofEquilibriumCheck(stiffness, displacement, load, [1], 1e-12)).toMatchObject({
      value: 0,
      passed: true,
    })
    expect(strainEnergyCheck(stiffness, displacement, load, 1e-12)).toMatchObject({
      value: 0,
      passed: true,
    })
  })

  it('checks global force and moment using reactions plus equivalent nodal loads', () => {
    const checks = beamGlobalBalanceChecks(
      [0, -5, -1, 0, -5, 1],
      [0, 5, 1, 0, 5, -1],
      [{ x: 0, y: 0 }, { x: 2, y: 0 }],
      1e-9,
      1e-9,
    )
    expect(checks.every(({ passed }) => passed)).toBe(true)
    expect(checks.map(({ unit }) => unit)).toEqual(['N', 'N', 'N*m'])
    const wrong = beamGlobalBalanceChecks(
      [0, -5, -1, 0, -5, 1],
      [0, 5, 1, 0, 4, -1],
      [{ x: 0, y: 0 }, { x: 2, y: 0 }],
      1e-9,
      1e-9,
    )
    expect(wrong[1].passed).toBe(false)
    expect(wrong[2].passed).toBe(false)
  })

  it('separates beam force and moment residual units', () => {
    const checks = beamFreeDofEquilibriumChecks(
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      [2, 3, 4],
      [2, 3, 4],
      [0, 1, 2],
      1e-9,
      1e-9,
    )
    expect(checks.map(({ id, unit, passed }) => ({ id, unit, passed }))).toEqual([
      { id: 'free-force-equilibrium', unit: 'N', passed: true },
      { id: 'free-moment-equilibrium', unit: 'N*m', passed: true },
    ])
  })

  it('rejects dimension mismatch and nonfinite values', () => {
    expect(() => matrixVectorProduct([[1, 2]], [1])).toThrow('维度不一致')
    expect(() => matrixVectorProduct([[1]], [Number.NaN])).toThrow('非有限')
  })
})
