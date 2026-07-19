import { describe, expect, it } from 'vitest'

import {
  frameGeometry,
  frameGlobalStiffness,
  frameLocalStiffness,
  frameTransformationMatrix,
  globalToLocalVector,
  localToGlobalVector,
} from '../../../../src/core/structural/frame'

describe('P2 frame coordinate transform', () => {
  it('matches FRAME-E01 inclined transform and preserves symmetry', () => {
    const geometry = frameGeometry({ x: 0, y: 0 }, { x: 4, y: 3 })
    expect(geometry).toEqual({ length: 5, cosine: 0.8, sine: 0.6 })
    const transform = frameTransformationMatrix(geometry.cosine, geometry.sine)
    expect(transform).toEqual([
      [0.8, 0.6, 0, 0, 0, 0],
      [-0.6, 0.8, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0.8, 0.6, 0],
      [0, 0, 0, -0.6, 0.8, 0],
      [0, 0, 0, 0, 0, 1],
    ])
    const global = frameGlobalStiffness(
      frameLocalStiffness({ E: 200e9, A: 0.01, I: 8e-5, L: geometry.length }),
      transform,
    )
    global.forEach((row, i) => row.forEach((value, j) => {
      expect(value).toBeCloseTo(global[j]![i]!, 7)
    }))
  })

  it.each([
    [{ x: 0, y: 0 }, { x: 2, y: 0 }, 1, 0],
    [{ x: 0, y: 0 }, { x: 0, y: 2 }, 0, 1],
    [{ x: 0, y: 0 }, { x: -4, y: -3 }, -0.8, -0.6],
  ] as const)('handles horizontal, vertical and reversed orientation', (nodeI, nodeJ, c, s) => {
    const geometry = frameGeometry(nodeI, nodeJ)
    expect(geometry.cosine).toBeCloseTo(c, 12)
    expect(geometry.sine).toBeCloseTo(s, 12)
    const transform = frameTransformationMatrix(geometry.cosine, geometry.sine)
    const global = [3, -4, 0.2, 8, 1, -0.3] as const
    const local = globalToLocalVector(global, transform)
    const restored = localToGlobalVector(local, transform)
    restored.forEach((value, index) => expect(value).toBeCloseTo(global[index]!, 12))
  })

  it('rejects zero length and invalid direction cosines', () => {
    expect(() => frameGeometry({ x: 0, y: 0 }, { x: 0, y: 0 })).toThrow('length')
    expect(() => frameTransformationMatrix(1, 1)).toThrow('unit norm')
  })
})
