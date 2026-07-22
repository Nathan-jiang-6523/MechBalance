import type { TrussElementGeometry, TrussVector4 } from './element'

/** Equivalent nodal load of a positive free elongation in global coordinates. */
export function trussInitialStrainLoadVector(
  E: number,
  A: number,
  freeStrain: number,
  geometry: Pick<TrussElementGeometry, 'cosine' | 'sine'>,
): TrussVector4 {
  if (![E, A, freeStrain, geometry.cosine, geometry.sine].every(Number.isFinite)) {
    throw new RangeError('桁架初应变等效荷载参数必须为有限数')
  }
  if (E <= 0 || A <= 0) throw new RangeError('桁架单元 E、A 必须大于零')
  const force = E * A * freeStrain
  return [
    -force * geometry.cosine,
    -force * geometry.sine,
    force * geometry.cosine,
    force * geometry.sine,
  ]
}
