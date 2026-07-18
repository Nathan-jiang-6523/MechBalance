import { describe, expect, it } from 'vitest'
import { calculateRoundSectionProperties, solveBendingTorsion } from '../../../src/core/stress'

const MPa = 1e6
const solid40 = { kind: 'solid-circle' as const, diameterM: 0.04 }

describe('round shaft bending and torsion', () => {
  it('recovers pure bending at selected outer fibre', () => {
    const result = solveBendingTorsion({ bendingMomentNm: 1_000, torqueNm: 0, section: solid40 })
    const expectedMpa = 32 * 1_000_000 / (Math.PI * 40 ** 3)
    expect(result.outerBendingStressPa / MPa).toBeCloseTo(expectedMpa, 12)
    expect(result.outerTorsionalShearPa).toBe(0)
    expect(result.stress.vonMisesPa / MPa).toBeCloseTo(expectedMpa, 12)
  })

  it('recovers pure torsion and criteria', () => {
    const result = solveBendingTorsion({ bendingMomentNm: 0, torqueNm: 500, section: solid40 })
    const expectedTauMpa = 16 * 500_000 / (Math.PI * 40 ** 3)
    expect(result.outerTorsionalShearPa / MPa).toBeCloseTo(expectedTauMpa, 12)
    expect(result.stress.vonMisesPa / MPa).toBeCloseTo(Math.sqrt(3) * expectedTauMpa, 12)
    expect(result.stress.trescaPa / MPa).toBeCloseTo(2 * expectedTauMpa, 12)
  })

  it('solves combined bending and torsion through plane-stress core', () => {
    const result = solveBendingTorsion({ bendingMomentNm: 1_000, torqueNm: 500, section: solid40 })
    const sigma = result.outerBendingStressPa
    const tau = result.outerTorsionalShearPa
    expect(result.stress.vonMisesPa).toBeCloseTo(Math.sqrt(sigma ** 2 + 3 * tau ** 2), 6)
    expect(result.stress.sigmaXPa).toBe(sigma)
    expect(result.stress.tauXyPa).toBe(tau)
  })

  it('preserves signs while equivalent criteria remain invariant under full reversal', () => {
    const positive = solveBendingTorsion({ bendingMomentNm: 1_000, torqueNm: 500, section: solid40 })
    const reversed = solveBendingTorsion({ bendingMomentNm: -1_000, torqueNm: -500, section: solid40 })
    expect(reversed.outerBendingStressPa).toBeCloseTo(-positive.outerBendingStressPa, 6)
    expect(reversed.outerTorsionalShearPa).toBeCloseTo(-positive.outerTorsionalShearPa, 6)
    expect(reversed.stress.vonMisesPa).toBeCloseTo(positive.stress.vonMisesPa, 6)
    expect(reversed.stress.trescaPa).toBeCloseTo(positive.stress.trescaPa, 6)
  })

  it('uses exact circular tube I and J=2I', () => {
    const result = calculateRoundSectionProperties({
      kind: 'circular-tube',
      outerDiameterM: 0.06,
      innerDiameterM: 0.04,
    })
    expect(result.secondMomentM4).toBeCloseTo(Math.PI * (0.06 ** 4 - 0.04 ** 4) / 64, 18)
    expect(result.polarMomentM4).toBeCloseTo(2 * result.secondMomentM4, 18)
  })

  it.each([
    { kind: 'solid-circle' as const, diameterM: 0 },
    { kind: 'solid-circle' as const, diameterM: Number.NaN },
    { kind: 'circular-tube' as const, outerDiameterM: 0.04, innerDiameterM: 0.04 },
    { kind: 'circular-tube' as const, outerDiameterM: 0.04, innerDiameterM: -0.01 },
  ])('rejects illegal geometry %#', (section) => {
    expect(() => solveBendingTorsion({ bendingMomentNm: 1, torqueNm: 1, section })).toThrow(RangeError)
  })
})
