import type { LameCylinderAxialCondition } from '../types'
import { lameStressAtRadius } from './stress'
import type { LameConstants, LameThinWallComparison } from './types'

function relativeDifference(value: number, reference: number): number | null {
  return reference === 0 ? null : Math.abs(value - reference) / Math.abs(reference)
}

export function compareLameWithThinWall(
  constants: LameConstants,
  boundary: LameCylinderAxialCondition,
  innerRadiusM: number,
  outerRadiusM: number,
  internalPressurePa: number,
  externalPressurePa: number,
  axialForceN: number,
): LameThinWallComparison | null {
  if (boundary === 'plane-strain') return null
  const meanRadiusM = (innerRadiusM + outerRadiusM) / 2
  const thicknessM = outerRadiusM - innerRadiusM
  const ratio = thicknessM / meanRadiusM
  if (ratio > 0.05) return null
  const netPressure = internalPressurePa - externalPressurePa
  const areaM2 = Math.PI * (outerRadiusM ** 2 - innerRadiusM ** 2)
  const thinHoopPa = netPressure * meanRadiusM / thicknessM
  const thinAxialPa = (boundary === 'closed' ? netPressure * meanRadiusM / (2 * thicknessM) : 0)
    + axialForceN / areaM2
  const lame = lameStressAtRadius(constants, meanRadiusM)
  const lameAxialPa = (boundary === 'closed' ? constants.aPa : 0) + axialForceN / areaM2
  return {
    meanRadiusM, thicknessM, ratio,
    lameHoopPa: lame.hoopStressPa,
    thinHoopPa,
    hoopRelativeDifference: relativeDifference(lame.hoopStressPa, thinHoopPa),
    lameAxialPa,
    thinAxialPa,
    axialRelativeDifference: relativeDifference(lameAxialPa, thinAxialPa),
  }
}
