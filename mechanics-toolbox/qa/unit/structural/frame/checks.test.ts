import { describe, expect, it } from 'vitest'

import { frameRecoveredNodeEquilibriumChecks } from '../../../../src/core/structural/frame/checks'

describe('P2 frame recovered node equilibrium', () => {
  it('balances recovered element-on-node actions with nodal loads and reactions', () => {
    const checks = frameRecoveredNodeEquilibriumChecks(
      ['1', '2'],
      [{ nodeI: '1', nodeJ: '2', globalEndForces: [-10, 2, 3, 10, -2, -3] }],
      [{ nodeId: '2', fx: -10, fy: 2, mz: 3 }],
      [{ nodeId: '1', fx: 10, fy: -2, mz: -3 }],
      1e-9,
      1e-9,
    )
    expect(checks).toEqual([
      { id: 'node-equilibrium', value: 0, unit: 'N', tolerance: 1e-9, passed: true },
      { id: 'node-moment-equilibrium', value: 0, unit: 'N*m', tolerance: 1e-9, passed: true },
    ])
  })

  it('detects force and moment errors independent of assembled stiffness', () => {
    const checks = frameRecoveredNodeEquilibriumChecks(
      ['1', '2'],
      [{ nodeI: '1', nodeJ: '2', globalEndForces: [-10, 0, 1, 10, 0, -1] }],
      [{ nodeId: '2', fx: -9, fy: 0, mz: 3 }],
      [{ nodeId: '1', fx: 10, fy: 0, mz: -1 }],
      0.5,
      0.5,
    )
    expect(checks[0]).toMatchObject({ value: 1, passed: false })
    expect(checks[1]).toMatchObject({ value: 2, passed: false })
  })

  it('rejects unknown nodes and nonfinite actions', () => {
    expect(() => frameRecoveredNodeEquilibriumChecks(
      ['1'],
      [{ nodeI: '1', nodeJ: 'missing', globalEndForces: [0, 0, 0, 0, 0, 0] }],
      [], [], 1, 1,
    )).toThrow('unknown node')
    expect(() => frameRecoveredNodeEquilibriumChecks(
      ['1'], [], [{ nodeId: '1', fx: Number.NaN, fy: 0, mz: 0 }], [], 1, 1,
    )).toThrow('finite actions')
  })
})
