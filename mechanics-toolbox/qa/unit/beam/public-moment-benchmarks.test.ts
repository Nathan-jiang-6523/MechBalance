import { describe, expect, it } from 'vitest'

import { findBeamExtrema, solveBeam, type BeamLoad, type BeamModel, type BeamSupport } from '../../../src/core/beam'
import benchmarks from '../../fixtures/beam-public-moment-benchmarks.json'

const base = {
  elasticModulusPa: 200e9,
  secondMomentM4: 8e-6,
} as const

const decimals = benchmarks.comparison.publishedDisplayDecimals
const toleranceNm = benchmarks.comparison.kernelToleranceNm
const published = (value: number): string => {
  const zeroThreshold = 0.5 * 10 ** -decimals
  return (Math.abs(value) < zeroThreshold ? 0 : value).toFixed(decimals)
}

describe('公开梁弯矩公式 10 项门禁', () => {
  for (const benchmark of benchmarks.cases) {
    it(`${benchmark.id} ${benchmark.title}`, () => {
      const model: BeamModel = {
        ...base,
        lengthM: benchmark.lengthM,
        support: benchmark.support as BeamSupport,
        loads: benchmark.loads as BeamLoad[],
      }
      const result = solveBeam(model)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(result.errors.map(({ message }) => message).join('; '))

      for (const probe of benchmark.probes) {
        const actual = result.value.evaluate(probe.xM, probe.side as 'left' | 'right').momentNm
        expect(Math.abs(actual - probe.expectedMomentNm)).toBeLessThanOrEqual(toleranceNm)
        expect(published(actual)).toBe(published(probe.expectedMomentNm))
      }

      const extrema = findBeamExtrema(result.value).momentNm
      expect(Math.abs(extrema.maximum.value - benchmark.expectedExtrema.maximumNm)).toBeLessThanOrEqual(toleranceNm)
      expect(Math.abs(extrema.minimum.value - benchmark.expectedExtrema.minimumNm)).toBeLessThanOrEqual(toleranceNm)
      expect(published(extrema.maximum.value)).toBe(published(benchmark.expectedExtrema.maximumNm))
      expect(published(extrema.minimum.value)).toBe(published(benchmark.expectedExtrema.minimumNm))
    })
  }
})
