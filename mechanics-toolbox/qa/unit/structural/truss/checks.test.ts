import { describe, expect, it } from 'vitest'

import {
  trussElementAxialEquilibriumCheck,
  trussGlobalBalanceChecks,
  trussNodeEquilibriumCheck,
} from '../../../../src/core/structural/truss'

describe('P2 truss equilibrium checks', () => {
  it('reports units, tolerances, and passed state for a balanced model', () => {
    const node = trussNodeEquilibriumCheck([[1]], [2], [1], [1], 1e-9)
    expect(node).toEqual({ id: 'node-equilibrium', value: 0, unit: 'N', tolerance: 1e-9, passed: true })
    expect(trussElementAxialEquilibriumCheck([
      { nodeI: [-3, -4], nodeJ: [3, 4] },
    ], 1e-9)).toMatchObject({ id: 'element-axial-equilibrium', value: 0, unit: 'N', passed: true })
    expect(trussGlobalBalanceChecks(
      [0, -10, 0, -10], [0, 10, 0, 10], [{ x: 0, y: 0 }, { x: 2, y: 0 }], 1e-9, 1e-9,
    ).every(({ passed }) => passed)).toBe(true)
  })

  it('fails instead of hiding node or element imbalance', () => {
    expect(trussNodeEquilibriumCheck([[1]], [2], [1], [0], 0.5)).toMatchObject({ value: 1, passed: false })
    expect(trussElementAxialEquilibriumCheck([
      { nodeI: [-3, -4], nodeJ: [3.1, 4] },
    ], 0.05)).toMatchObject({ passed: false })
  })
})
