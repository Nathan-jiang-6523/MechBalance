import { solvePlaneStress, type PlaneStressResult } from '../../stress'
import type {
  ThinCylinderLoad,
  ThinCylinderMembraneForces,
  ThinCylinderStresses,
} from './types'

function finite(value: number, message: string): number {
  if (!Number.isFinite(value)) throw new RangeError(message)
  return Object.is(value, -0) ? 0 : value
}

export function recoverThinCylinderCombination(
  meanRadiusM: number,
  thicknessM: number,
  load: ThinCylinderLoad,
  hoopNPerM: number,
  axialPressureNPerM: number,
): {
  readonly membraneForces: ThinCylinderMembraneForces
  readonly stresses: ThinCylinderStresses
  readonly planeStress: PlaneStressResult
} {
  const axialForceNPerM = finite(
    load.axialForceN / (2 * Math.PI * meanRadiusM),
    '轴力膜内力超出有限数范围',
  )
  const shearNPerM = finite(
    load.torqueNm / (2 * Math.PI * meanRadiusM ** 2),
    '扭矩膜内力超出有限数范围',
  )
  const axialTotalNPerM = finite(
    axialPressureNPerM + axialForceNPerM,
    '轴向总膜内力超出有限数范围',
  )
  const stresses: ThinCylinderStresses = {
    hoopPa: finite(hoopNPerM / thicknessM, '环向膜应力超出有限数范围'),
    axialPressurePa: finite(
      axialPressureNPerM / thicknessM,
      '压力轴向膜应力超出有限数范围',
    ),
    axialForcePa: finite(
      axialForceNPerM / thicknessM,
      '轴力轴向膜应力超出有限数范围',
    ),
    axialTotalPa: finite(
      axialTotalNPerM / thicknessM,
      '轴向总膜应力超出有限数范围',
    ),
    shearPa: finite(shearNPerM / thicknessM, '扭转剪应力超出有限数范围'),
  }
  return {
    membraneForces: {
      hoopNPerM,
      axialPressureNPerM,
      axialForceNPerM,
      axialTotalNPerM,
      shearNPerM,
    },
    stresses,
    planeStress: solvePlaneStress({
      sigmaXPa: stresses.axialTotalPa,
      sigmaYPa: stresses.hoopPa,
      tauXyPa: stresses.shearPa,
    }),
  }
}
