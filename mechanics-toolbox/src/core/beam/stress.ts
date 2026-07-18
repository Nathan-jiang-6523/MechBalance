import type { SectionKind } from '../sections'

export function recoverBendingStressPa(
  bendingMomentNm: number,
  yFromCentroidM: number,
  ixM4: number,
): number {
  if (![bendingMomentNm, yFromCentroidM, ixM4].every(Number.isFinite) || ixM4 <= 0) {
    throw new RangeError('弯矩、位置必须为有限数，截面二次矩 Ix 必须大于 0')
  }
  return (-bendingMomentNm * yFromCentroidM) / ixM4
}

export type ShearStressResult =
  | { ok: true; shearStressPa: number }
  | { ok: false; reason: 'unsupported-section'; message: string }

export function recoverBeamShearStressPa(input: {
  sectionKind: SectionKind
  shearForceN: number
  areaM2: number
  heightM: number
  yFromCentroidM: number
}): ShearStressResult {
  if (input.sectionKind !== 'rectangle') {
    return {
      ok: false,
      reason: 'unsupported-section',
      message: '当前截面暂不支持剪应力恢复',
    }
  }

  const { shearForceN, areaM2, heightM, yFromCentroidM } = input
  if (
    ![shearForceN, areaM2, heightM, yFromCentroidM].every(Number.isFinite) ||
    areaM2 <= 0 ||
    heightM <= 0
  ) {
    throw new RangeError('剪力、位置必须为有限数，面积和截面高度必须大于 0')
  }
  if (Math.abs(yFromCentroidM) > heightM / 2) {
    throw new RangeError('剪应力恢复位置必须位于截面高度范围内')
  }

  return {
    ok: true,
    shearStressPa:
      ((3 * shearForceN) / (2 * areaM2)) *
      (1 - (2 * yFromCentroidM) ** 2 / heightM ** 2),
  }
}
