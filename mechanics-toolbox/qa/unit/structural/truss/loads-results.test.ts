import { describe, expect, it } from 'vitest'

import {
  createTrussElementResult,
  trussInitialStrainLoadVector,
  trussSelfWeightLoadVector,
} from '../../../../src/core/structural/truss'

describe('P2 truss imposed strain, weight, and results', () => {
  it('transforms positive free strain to the frozen equivalent nodal load', () => {
    const result = trussInitialStrainLoadVector(200e9, 0.001, 0.0006, { cosine: 1, sine: 0 })
    ;[-120_000, 0, 120_000, 0].forEach((expected, index) => {
      expect(result[index]).toBeCloseTo(expected, 10)
    })
  })

  it('matches TRUSS-SW01 half-at-each-end lumping', () => {
    const result = trussSelfWeightLoadVector(7850, 0.001, 2, 9.80665)
    expect(result.mass).toBeCloseTo(15.7, 12)
    expect(result.weight).toBeCloseTo(153.964405, 12)
    expect(result.equivalentLoad).toEqual([0, -76.9822025, 0, -76.9822025])
  })

  it('reports signed stress and tension/compression/zero state', () => {
    expect(createTrussElementResult('t', 10, 2)).toMatchObject({ state: 'tension', stress: { value: 5, unit: 'Pa' } })
    expect(createTrussElementResult('c', -10, 2)).toMatchObject({ state: 'compression', stress: { value: -5, unit: 'Pa' } })
    expect(createTrussElementResult('z', 1e-7, 2)).toMatchObject({ state: 'zero' })
  })
})
