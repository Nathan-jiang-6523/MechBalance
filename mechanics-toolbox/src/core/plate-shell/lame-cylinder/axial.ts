import type { IsotropicElasticMaterial, LameCylinderAxialCondition, LameCylinderGeometry } from '../types'
import { finiteLame } from './stress'
import type { LameConstants } from './types'

export function solveLameAxialStress(
  boundary: LameCylinderAxialCondition,
  constants: LameConstants,
  geometry: LameCylinderGeometry,
  material: IsotropicElasticMaterial,
  axialForceN: number,
): { readonly axialStressPa: number; readonly axialStrain: number | null } {
  if (boundary === 'plane-strain') {
    return {
      axialStressPa: finiteLame(2 * material.poissonRatio * constants.aPa, '平面应变轴向应力超出有限数范围'),
      axialStrain: 0,
    }
  }
  const areaM2 = finiteLame(
    Math.PI * (geometry.outerRadiusM ** 2 - geometry.innerRadiusM ** 2),
    '圆筒截面积超出有限数范围',
  )
  const forceStressPa = finiteLame(axialForceN / areaM2, '外加轴力应力超出有限数范围')
  return {
    axialStressPa: finiteLame(
      (boundary === 'closed' ? constants.aPa : 0) + forceStressPa,
      '轴向总应力超出有限数范围',
    ),
    axialStrain: null,
  }
}
