import type { TrussVector4 } from './element'

export interface TrussSelfWeightResult {
  readonly mass: number
  readonly weight: number
  readonly equivalentLoad: TrussVector4
}

/** Lump rho*A*L*g equally to both end nodes along global -y. */
export function trussSelfWeightLoadVector(
  density: number,
  A: number,
  length: number,
  gravity: number,
): TrussSelfWeightResult {
  if (![density, A, length, gravity].every(Number.isFinite)) {
    throw new RangeError('桁架自重参数必须为有限数')
  }
  if (density <= 0 || A <= 0 || length <= 0 || gravity <= 0) {
    throw new RangeError('桁架自重 rho、A、L、g 必须大于零')
  }
  const mass = density * A * length
  const weight = mass * gravity
  return { mass, weight, equivalentLoad: [0, -weight / 2, 0, -weight / 2] }
}
