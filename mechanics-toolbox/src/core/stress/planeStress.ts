import type { PlaneStressInput, PlaneStressResult, StressUtilization } from './types'

function assertFiniteInputs(input: PlaneStressInput): void {
  const values = [input.sigmaXPa, input.sigmaYPa, input.tauXyPa]
  if (!values.every(Number.isFinite)) {
    throw new RangeError('平面应力分量必须是有限数值')
  }
  if (input.strengthPa !== undefined && (!Number.isFinite(input.strengthPa) || input.strengthPa <= 0)) {
    throw new RangeError('许用/屈服强度必须是大于 0 的有限数值')
  }
}

function finite(value: number, message: string): number {
  if (!Number.isFinite(value)) throw new RangeError(message)
  return Object.is(value, -0) ? 0 : value
}

function wrapHalfTurn(angleRad: number): number {
  let angle = angleRad
  while (angle >= Math.PI / 2) angle -= Math.PI
  while (angle < -Math.PI / 2) angle += Math.PI
  return Object.is(angle, -0) ? 0 : angle
}

function utilization(vonMisesPa: number, trescaPa: number, strengthPa: number): StressUtilization {
  const vonMises = finite(vonMisesPa / strengthPa, 'von Mises 利用率超出数值范围')
  const tresca = finite(trescaPa / strengthPa, 'Tresca 利用率超出数值范围')
  const scale = Math.max(vonMises, tresca, 1)
  const equal = Math.abs(vonMises - tresca) <= 1e-12 * scale
  const controllingCriterion = equal ? 'equal' : vonMises > tresca ? 'von-mises' : 'tresca'
  const controllingUtilization = Math.max(vonMises, tresca)
  return {
    vonMises,
    tresca,
    controllingCriterion,
    controllingUtilization,
    exceedsStrength: controllingUtilization > 1,
  }
}

/**
 * Plane-stress recovery. Sign convention:
 * - tension positive;
 * - tau_xy positive on the +x face toward +y;
 * - physical angles positive counter-clockwise.
 */
export function solvePlaneStress(input: PlaneStressInput): PlaneStressResult {
  assertFiniteInputs(input)

  const { sigmaXPa, sigmaYPa, tauXyPa } = input
  const center = finite(sigmaXPa / 2 + sigmaYPa / 2, '莫尔圆圆心超出数值范围')
  const halfDifference = finite(sigmaXPa / 2 - sigmaYPa / 2, '应力差超出数值范围')
  const radius = finite(Math.hypot(halfDifference, tauXyPa), '莫尔圆半径超出数值范围')
  const sigma1 = finite(center + radius, '第一主应力超出数值范围')
  const sigma2 = finite(center - radius, '第二主应力超出数值范围')

  const directionDefined = radius > 0
  const principalAngle = directionDefined
    ? wrapHalfTurn(0.5 * Math.atan2(tauXyPa, halfDifference))
    : null
  const shearAngle = principalAngle === null ? null : wrapHalfTurn(principalAngle + Math.PI / 4)

  const principals = [sigma1, sigma2, 0].sort((a, b) => b - a) as [number, number, number]
  const d12 = finite(principals[0] - principals[1], '主应力差超出数值范围')
  const d23 = finite(principals[1] - principals[2], '主应力差超出数值范围')
  const d31 = finite(principals[2] - principals[0], '主应力差超出数值范围')
  const vonMises = finite(Math.hypot(d12, d23, d31) / Math.sqrt(2), 'von Mises 应力超出数值范围')
  const tresca = finite(principals[0] - principals[2], 'Tresca 等效应力超出数值范围')
  const strength = input.strengthPa ?? null

  return {
    sigmaXPa,
    sigmaYPa,
    tauXyPa,
    mohrCenterPa: center,
    mohrRadiusPa: radius,
    sigma1Pa: sigma1,
    sigma2Pa: sigma2,
    principalStressesPa: principals,
    principalAngleRad: principalAngle,
    maxInPlaneShearAngleRad: shearAngle,
    maxInPlaneShearPa: radius,
    vonMisesPa: vonMises,
    trescaPa: tresca,
    maximum3dShearPa: tresca / 2,
    strengthPa: strength,
    utilization: strength === null ? null : utilization(vonMises, tresca, strength),
  }
}
