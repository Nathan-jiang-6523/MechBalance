import { describe, expect, it } from 'vitest'

import { recoverBeamShearStressPa, recoverBendingStressPa } from '../../../src/core/beam'

describe('beam stress recovery acceptance fixtures', () => {
  it('BEAM-STRESS-01 restores tension and compression from positive bending', () => {
    const momentNm = 2_400_000 / 1_000
    const ixM4 = 8_000_000 / 1e12
    expect(recoverBendingStressPa(momentNm, 50 / 1_000, ixM4) / 1e6).toBeCloseTo(-15, 12)
    expect(recoverBendingStressPa(momentNm, -50 / 1_000, ixM4) / 1e6).toBeCloseTo(15, 12)
  })

  it.each([
    [0, 0.9375],
    [25, 0.703125],
    [-25, 0.703125],
    [50, 0],
    [-50, 0],
  ])('BEAM-STRESS-02 y=%s mm', (yMm, expectedMpa) => {
    const result = recoverBeamShearStressPa({
      sectionKind: 'rectangle',
      shearForceN: 6_000,
      areaM2: 9_600 / 1e6,
      heightM: 100 / 1_000,
      yFromCentroidM: yMm / 1_000,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.shearStressPa / 1e6).toBeCloseTo(expectedMpa, 12)
  })

  it.each(['hollowRectangle', 'solidCircle', 'circularTube'] as const)(
    'disables unsupported %s shear recovery',
    (sectionKind) => {
      expect(
        recoverBeamShearStressPa({
          sectionKind,
          shearForceN: 6_000,
          areaM2: 1,
          heightM: 1,
          yFromCentroidM: 0,
        }),
      ).toEqual({
        ok: false,
        reason: 'unsupported-section',
        message: '当前截面暂不支持剪应力恢复',
      })
    },
  )
})
