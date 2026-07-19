import { describe, expect, it } from 'vitest'

import {
  trussAxialExtension,
  trussElementGeometry,
  trussGlobalStiffness,
} from '../../../../src/core/structural/truss'

describe('P2 truss element', () => {
  it('matches TRUSS-E01 for a 3-4-5 inclined bar', () => {
    const geometry = trussElementGeometry({ x: 0, y: 0 }, { x: 4, y: 3 })
    expect(geometry).toEqual({ length: 5, cosine: 0.8, sine: 0.6 })
    const stiffness = trussGlobalStiffness(200e9, 0.001, geometry)
    const expected = [
      [25.6, 19.2, -25.6, -19.2],
      [19.2, 14.4, -19.2, -14.4],
      [-25.6, -19.2, 25.6, 19.2],
      [-19.2, -14.4, 19.2, 14.4],
    ]
    stiffness.forEach((row, i) => row.forEach((value, j) => {
      expect(value / 1e6).toBeCloseTo(expected[i]![j]!, 12)
      expect(value).toBeCloseTo(stiffness[j]![i]!, 12)
    }))
    const rigid = [2, -3, 2, -3] as const
    stiffness.forEach((row) => expect(row.reduce((sum, value, index) => sum + value * rigid[index]!, 0)).toBeCloseTo(0, 8))
    expect(trussAxialExtension([1, 2, 4, 6], geometry)).toBeCloseTo(4.8, 12)
  })

  it.each([
    [{ x: 0, y: 0 }, { x: 2, y: 0 }, [1, 0]],
    [{ x: 0, y: 0 }, { x: 0, y: 2 }, [0, 1]],
  ] as const)('handles horizontal and vertical orientation', (nodeI, nodeJ, expected) => {
    const geometry = trussElementGeometry(nodeI, nodeJ)
    expect(geometry.cosine).toBe(expected[0])
    expect(geometry.sine).toBe(expected[1])
    const stiffness = trussGlobalStiffness(10, 2, geometry)
    stiffness.forEach((row, i) => row.forEach((value, j) => expect(value).toBe(stiffness[j]![i])))
  })
})
