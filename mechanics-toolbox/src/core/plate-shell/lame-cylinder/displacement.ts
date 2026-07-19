import type { IsotropicElasticMaterial } from '../types'
import { finiteLame } from './stress'
import type { LameConstants } from './types'

export function lameRadialDisplacement(
  constants: LameConstants,
  radiusM: number,
  axialStressPa: number,
  material: IsotropicElasticMaterial,
): number {
  const { elasticModulusPa: e, poissonRatio: nu } = material
  const uniform = finiteLame(((1 - nu) * constants.aPa - nu * axialStressPa) * radiusM, '位移均匀项超出有限数范围')
  const gradient = finiteLame((1 + nu) * constants.bPaM2 / radiusM, '位移梯度项超出有限数范围')
  return finiteLame((uniform + gradient) / e, '径向位移超出有限数范围')
}
