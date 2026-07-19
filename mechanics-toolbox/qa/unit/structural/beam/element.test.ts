import { describe, expect, it } from 'vitest'

import { beamLocalStiffness, type BeamMatrix6, type BeamVector6 } from '../../../../src/core/structural/beam'

function multiply(matrix: BeamMatrix6, vector: BeamVector6): number[] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index]!, 0))
}

function matrixRank(matrix: BeamMatrix6): number {
  const reduced = matrix.map((row) => [...row])
  const tolerance = Math.max(...reduced.flat().map(Math.abs)) * 1e-12
  let rank = 0
  for (let column = 0; column < 6 && rank < 6; column += 1) {
    let pivot = rank
    for (let row = rank + 1; row < 6; row += 1) {
      if (Math.abs(reduced[row]![column]!) > Math.abs(reduced[pivot]![column]!)) pivot = row
    }
    if (Math.abs(reduced[pivot]![column]!) <= tolerance) continue
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

describe('P2 beam local stiffness', () => {
  it('matches BEAM-E01/E03 full 6x6 truth and is symmetric', () => {
    const stiffness = beamLocalStiffness({ E: 200e9, A: 0.01, I: 8e-6, L: 4 })

    expect(stiffness).toEqual([
      [500_000_000, 0, 0, -500_000_000, 0, 0],
      [0, 300_000, 600_000, 0, -300_000, 600_000],
      [0, 600_000, 1_600_000, 0, -600_000, 800_000],
      [-500_000_000, 0, 0, 500_000_000, 0, 0],
      [0, -300_000, -600_000, 0, 300_000, -600_000],
      [0, 600_000, 800_000, 0, -600_000, 1_600_000],
    ])
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        expect(stiffness[row]![column]).toBe(stiffness[column]![row])
      }
    }
    expect([1, 2, 4, 5].map((row) => [1, 2, 4, 5].map((column) => stiffness[row]![column]))).toEqual([
      [300_000, 600_000, -300_000, 600_000],
      [600_000, 1_600_000, -600_000, 800_000],
      [-300_000, -600_000, 300_000, -600_000],
      [600_000, 800_000, -600_000, 1_600_000],
    ])
    expect(matrixRank(stiffness)).toBe(3)
  })

  it('annihilates three rigid-body modes', () => {
    const stiffness = beamLocalStiffness({ E: 200e9, A: 0.01, I: 8e-6, L: 4 })
    const modes: BeamVector6[] = [
      [1, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0],
      [0, 0, 1, 0, 4, 1],
    ]
    for (const mode of modes) expect(multiply(stiffness, mode)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it.each(['E', 'A', 'I', 'L'] as const)('rejects invalid %s', (field) => {
    expect(() => beamLocalStiffness({ E: 1, A: 1, I: 1, L: 1, [field]: 0 })).toThrow(RangeError)
    expect(() => beamLocalStiffness({ E: 1, A: 1, I: 1, L: 1, [field]: Number.NaN })).toThrow(RangeError)
  })
})
