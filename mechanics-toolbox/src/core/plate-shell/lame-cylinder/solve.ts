import { summarizeApplicability } from '../applicability'
import type { ApplicabilityCheck } from '../results'
import { solveLameAxialStress } from './axial'
import { lameRadialDisplacement } from './displacement'
import { calculateLameConstants, finiteLame, lameStressAtRadius } from './stress'
import { compareLameWithThinWall } from './thin-limit'
import {
  LAME_AXIAL_FORMULA_IDS,
  LAME_DISPLACEMENT_FORMULA_ID,
  LAME_STRESS_FORMULA,
  LameCylinderInputError,
  type LameCylinderInput,
  type LameCylinderResult,
  type LamePointResult,
} from './types'
import { validateLameCylinderInput } from './validate'

function pointResult(
  label: LamePointResult['label'], radiusM: number, constants: LameCylinderResult['constants'],
  axialStressPa: number, input: LameCylinderInput,
): LamePointResult {
  const stress = lameStressAtRadius(constants, radiusM)
  const principals = [stress.radialStressPa, stress.hoopStressPa, axialStressPa]
    .sort((a, b) => b - a) as [number, number, number]
  const d12 = principals[0] - principals[1]
  const d23 = principals[1] - principals[2]
  const d31 = principals[2] - principals[0]
  return {
    label, radiusM, ...stress, axialStressPa,
    radialDisplacementM: lameRadialDisplacement(constants, radiusM, axialStressPa, input.material),
    principalStressesPa: principals,
    vonMisesPa: finiteLame(Math.hypot(d12, d23, d31) / Math.sqrt(2), 'von Mises 应力超出有限数范围'),
    trescaPa: finiteLame(principals[0] - principals[2], 'Tresca 应力超出有限数范围'),
  }
}

export function solveLameCylinder(input: LameCylinderInput): LameCylinderResult {
  const validation = validateLameCylinderInput(input)
  if (!validation.valid) {
    throw new LameCylinderInputError(
      validation.issues.map(({ message }) => message).join('；'),
      validation.issues.map(({ field }) => field),
    )
  }
  const { innerRadiusM: ri, outerRadiusM: ro } = input.geometry
  const constants = calculateLameConstants(ri, ro, input.load.internalPressurePa, input.load.externalPressurePa)
  const axial = solveLameAxialStress(input.boundary, constants, input.geometry, input.material, input.load.axialForceN)
  const points = [
    pointResult('内表面', ri, constants, axial.axialStressPa, input),
    pointResult('求值位置', input.evaluationRadiusM, constants, axial.axialStressPa, input),
    pointResult('外表面', ro, constants, axial.axialStressPa, input),
  ] as const
  const curve = Array.from({ length: 41 }, (_, index) => {
    const radiusM = ri + (ro - ri) * index / 40
    return { radiusM, ...lameStressAtRadius(constants, radiusM), axialStressPa: axial.axialStressPa }
  })
  const ratio = (ro - ri) / ((ri + ro) / 2)
  const check: ApplicabilityCheck = {
    code: 'P3-LAME-THIN-COMPARISON', label: '厚度/中面半径', actual: ratio, limit: 0.05,
    comparator: '<=', level: ratio <= 0.05 ? 'warning' : 'within',
    message: ratio <= 0.05 ? '当前几何满足薄壁判据，可与薄壁膜解对照；薄壁仍为近似' : 'Lamé 解适用于当前合法厚壁几何',
  }
  const thinWallComparison = compareLameWithThinWall(
    constants, input.boundary, ri, ro, input.load.internalPressurePa,
    input.load.externalPressurePa, input.load.axialForceN,
  )
  return {
    formula: LAME_STRESS_FORMULA,
    axialFormulaId: LAME_AXIAL_FORMULA_IDS[input.boundary],
    displacementFormulaId: LAME_DISPLACEMENT_FORMULA_ID,
    boundary: input.boundary, constants,
    axialStressPa: axial.axialStressPa,
    axialStrain: axial.axialStrain,
    points,
    curve,
    innerPressureResidualPa: finiteLame(points[0].radialStressPa + input.load.internalPressurePa, '内表面压力边界残差超出有限数范围'),
    outerPressureResidualPa: finiteLame(points[2].radialStressPa + input.load.externalPressurePa, '外表面压力边界残差超出有限数范围'),
    applicability: summarizeApplicability([check]),
    thinWallComparison,
    warnings: ratio <= 0.05 ? ['当前几何满足薄壁判据；薄壁膜解仅作近似对照，Lamé 解仍为本模块结果。'] : [],
    controlLocation: '远离有限长度端部效应区域',
  }
}
