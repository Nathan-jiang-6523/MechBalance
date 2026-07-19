import { evaluateThinPlateRatio, summarizeApplicability } from '../applicability'
import type { ApplicabilityCheck } from '../results'
import { minimumPlateMode } from './plate-modes'
import { BucklingInputError, type PlateBucklingDraftInput, type PlateBucklingInput, type PlateBucklingResult } from './types'
import { IDEAL_BUCKLING_WARNING } from './warnings'

function positive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new BucklingInputError(`${label}必须为正有限数`)
}

export function validatePlateBucklingInput(input: PlateBucklingDraftInput): void {
  if (input.boundary !== 'ssss-uniaxial') throw new BucklingInputError('必须显式选择四边简支单向压缩边界')
  positive('长度 a', input.lengthXM)
  positive('宽度 b', input.widthYM)
  positive('厚度 t', input.thicknessM)
  positive('弹性模量 E', input.material.elasticModulusPa)
  positive('施加压缩膜力 Nx', input.appliedCompressionNPerM)
  if (!Number.isFinite(input.material.poissonRatio) || input.material.poissonRatio <= -1 || input.material.poissonRatio >= .5) throw new BucklingInputError('泊松比必须满足 -1<ν<0.5')
  if (!Number.isInteger(input.maximumLongitudinalHalfWaves) || input.maximumLongitudinalHalfWaves < 1 || input.maximumLongitudinalHalfWaves > 200) throw new BucklingInputError('轴向半波数上限必须是 1～200 的整数')
}

export function solvePlateBuckling(input: PlateBucklingInput): PlateBucklingResult {
  validatePlateBucklingInput(input)
  const rigidityNm = input.material.elasticModulusPa * input.thicknessM ** 3 / (12 * (1 - input.material.poissonRatio ** 2))
  const mode = minimumPlateMode(input.lengthXM, input.widthYM, rigidityNm, input.maximumLongitudinalHalfWaves)
  const aspect = input.lengthXM / input.widthYM
  const aspectCheck: ApplicabilityCheck = {
    code: 'P3-BK-PLATE-ASPECT', label: '板 a/b', actual: aspect, limit: 100, comparator: '<=',
    level: aspect > 100 ? 'warning' : 'within',
    message: aspect > 100 ? 'a/b 超过 100；应复核整体柱屈曲与板屈曲的控制关系' : '板长宽比在数值搜索护栏内',
  }
  const applicability = summarizeApplicability([evaluateThinPlateRatio(input.thicknessM, Math.min(input.lengthXM, input.widthYM)), aspectCheck])
  const criticalStressPa = mode.criticalLineLoadNPerM / input.thicknessM
  return {
    formulaId: 'P3-BK-PLATE-SSSS-UNIAXIAL-1', solutionNature: 'ideal-elastic-estimate', rigidityNm,
    longitudinalHalfWaves: mode.m, transverseHalfWaves: 1, bucklingCoefficient: mode.coefficient,
    criticalLineLoadNPerM: mode.criticalLineLoadNPerM, criticalStressPa,
    criticalTotalForceN: mode.criticalLineLoadNPerM * input.widthYM,
    appliedCompressionNPerM: input.appliedCompressionNPerM,
    utilization: input.appliedCompressionNPerM / mode.criticalLineLoadNPerM,
    applicability, warnings: [IDEAL_BUCKLING_WARNING, ...applicability.checks.filter((check) => check.level !== 'within').map((check) => check.message)],
  }
}
