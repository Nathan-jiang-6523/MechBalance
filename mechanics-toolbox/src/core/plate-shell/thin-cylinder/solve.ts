import { recoverThinCylinderCombination } from './combined'
import {
  ThinCylinderInputError,
  thinCylinderFormulaFor,
  THIN_CYLINDER_AXIAL_FORMULA_ID,
  THIN_CYLINDER_TORSION_FORMULA_ID,
  type ThinCylinderInput,
  type ThinCylinderResult,
  type ThinCylinderWarning,
} from './types'
import { validateThinCylinderInput } from './validate'

function finite(value: number, message: string): number {
  if (!Number.isFinite(value)) throw new RangeError(message)
  return Object.is(value, -0) ? 0 : value
}

export function solveThinCylinder(input: ThinCylinderInput): ThinCylinderResult {
  const checked = validateThinCylinderInput(input)
  const issues = checked.validation.issues
  if (!checked.validation.valid) {
    throw new ThinCylinderInputError(
      issues.map((issue) => issue.message).join('；'),
      issues.map((issue) => issue.field),
    )
  }
  if (!checked.applicability.canCalculate) {
    const blocked = checked.applicability.checks.find((check) => check.level === 'blocked')
    throw new ThinCylinderInputError(
      blocked?.message ?? '薄壁圆筒适用性校验未通过',
      ['thicknessM', 'meanRadiusM'],
    )
  }

  const { meanRadiusM, thicknessM } = input.geometry
  const netPressurePa = finite(
    input.load.internalPressurePa - input.load.externalPressurePa,
    '净压差超出有限数范围',
  )
  const hoopNPerM = finite(netPressurePa * meanRadiusM, '环向膜内力超出有限数范围')
  const axialPressureNPerM = input.boundary === 'closed'
    ? finite(hoopNPerM / 2, '压力轴向膜内力超出有限数范围')
    : 0
  const combined = recoverThinCylinderCombination(
    meanRadiusM,
    thicknessM,
    input.load,
    hoopNPerM,
    axialPressureNPerM,
  )
  const warnings: ThinCylinderWarning[] = []
  if (checked.applicability.level === 'at-limit') {
    warnings.push({
      code: 'P3-TW-AT-LIMIT',
      severity: 'warning',
      message: checked.applicability.checks[0]?.message ?? '恰处薄壁适用上限',
    })
  }
  if (input.load.externalPressurePa > input.load.internalPressurePa) {
    warnings.push({
      code: 'P3-TW-EXTERNAL-PRESSURE',
      severity: 'strong-warning',
      message: '仅计算膜应力，未校核外压失稳；不得据此判断结构安全。',
    })
  }

  return {
    formula: thinCylinderFormulaFor(input.boundary),
    supplementalFormulaIds: [
      THIN_CYLINDER_AXIAL_FORMULA_ID,
      THIN_CYLINDER_TORSION_FORMULA_ID,
    ],
    boundary: input.boundary,
    geometry: input.geometry,
    load: input.load,
    netPressurePa,
    ...combined,
    applicability: checked.applicability,
    warnings,
    modelStatement: '薄壁膜应力近似',
    controlLocation: '远离端部与载荷引入区的中面',
  }
}
