import type { LameConstants } from './types'

export function finiteLame(value: number, message: string): number {
  if (!Number.isFinite(value)) throw new RangeError(message)
  return Object.is(value, -0) ? 0 : value
}

export function calculateLameConstants(
  innerRadiusM: number,
  outerRadiusM: number,
  internalPressurePa: number,
  externalPressurePa: number,
): LameConstants {
  const ri2 = finiteLame(innerRadiusM ** 2, '内半径平方超出有限数范围')
  const ro2 = finiteLame(outerRadiusM ** 2, '外半径平方超出有限数范围')
  const denominator = finiteLame(ro2 - ri2, 'Lamé 几何分母超出有限数范围')
  const aPa = finiteLame(
    (internalPressurePa * ri2 - externalPressurePa * ro2) / denominator,
    'Lamé 常数 A 超出有限数范围',
  )
  const bPaM2 = finiteLame(
    ((internalPressurePa - externalPressurePa) * ri2 * ro2) / denominator,
    'Lamé 常数 B 超出有限数范围',
  )
  return { aPa, bPaM2 }
}

export function lameStressAtRadius(constants: LameConstants, radiusM: number): {
  readonly radialStressPa: number
  readonly hoopStressPa: number
} {
  const r2 = finiteLame(radiusM ** 2, '求值半径平方超出有限数范围')
  const gradient = finiteLame(constants.bPaM2 / r2, 'Lamé 应力梯度超出有限数范围')
  const radial = finiteLame(constants.aPa - gradient, '径向应力超出有限数范围')
  const hoop = finiteLame(constants.aPa + gradient, '环向应力超出有限数范围')
  const scale = Math.max(Math.abs(constants.aPa), Math.abs(gradient), 1)
  const clean = (value: number) => Math.abs(value) <= scale * 1e-14 ? 0 : value
  return {
    radialStressPa: clean(radial),
    hoopStressPa: clean(hoop),
  }
}
