import type {
  ApplicabilityCheck,
  ApplicabilityLevel,
  ApplicabilitySummary,
} from './results'
import { nearlyEqual } from '../numeric'

const LEVEL_ORDER: Readonly<Record<ApplicabilityLevel, number>> = {
  within: 0,
  'at-limit': 1,
  warning: 2,
  blocked: 3,
}

interface MaximumRatioRule {
  readonly code: string
  readonly label: string
  readonly ratio: number
  readonly maximum: number
  readonly blockWhenExceeded: boolean
  readonly atLimitMessage: string
  readonly exceededMessage: string
}

function maximumRatioCheck(rule: MaximumRatioRule): ApplicabilityCheck {
  if (!Number.isFinite(rule.ratio) || rule.ratio < 0) {
    return {
      code: rule.code,
      label: rule.label,
      level: 'blocked',
      actual: rule.ratio,
      limit: rule.maximum,
      comparator: '<=',
      message: `${rule.label}必须是有限非负数`,
    }
  }
  if (nearlyEqual(rule.ratio, rule.maximum, 1e-12, 1e-15)) {
    return {
      code: rule.code,
      label: rule.label,
      level: 'at-limit',
      actual: rule.ratio,
      limit: rule.maximum,
      comparator: '<=',
      message: rule.atLimitMessage,
    }
  }
  if (rule.ratio > rule.maximum) {
    return {
      code: rule.code,
      label: rule.label,
      level: rule.blockWhenExceeded ? 'blocked' : 'warning',
      actual: rule.ratio,
      limit: rule.maximum,
      comparator: '<=',
      message: rule.exceededMessage,
    }
  }
  return {
    code: rule.code,
    label: rule.label,
    level: 'within',
    actual: rule.ratio,
    limit: rule.maximum,
    comparator: '<=',
    message: `${rule.label}在当前模型护栏内`,
  }
}

export function summarizeApplicability(
  checks: readonly ApplicabilityCheck[],
): ApplicabilitySummary {
  const level = checks.reduce<ApplicabilityLevel>(
    (current, check) => LEVEL_ORDER[check.level] > LEVEL_ORDER[current] ? check.level : current,
    'within',
  )
  return { canCalculate: level !== 'blocked', level, checks }
}

export function evaluateThinWallRatio(thicknessM: number, meanRadiusM: number): ApplicabilityCheck {
  return maximumRatioCheck({
    code: 'P3-THIN-WALL-RATIO',
    label: '薄壁圆筒 t/r',
    ratio: thicknessM / meanRadiusM,
    maximum: 0.05,
    blockWhenExceeded: true,
    atLimitMessage: '恰处薄壁适用上限，建议改用厚壁 Lamé 解复核',
    exceededMessage: 't/r 超过 0.05，禁止使用薄壁膜解，请改用厚壁圆筒',
  })
}

export function evaluateThinPlateRatio(thicknessM: number, minimumSpanM: number): ApplicabilityCheck {
  return maximumRatioCheck({
    code: 'P3-THIN-PLATE-RATIO',
    label: '薄板 t/min(span)',
    ratio: thicknessM / minimumSpanM,
    maximum: 0.1,
    blockWhenExceeded: false,
    atLimitMessage: '恰处薄板产品护栏上限',
    exceededMessage: '厚跨比超过 0.1；仅显示教材小挠度理论值，薄板模型适用性不足',
  })
}

export function evaluateCircularShellThinness(
  thicknessM: number,
  meanRadiusM: number,
): ApplicabilityCheck {
  return maximumRatioCheck({
    code: 'P3-SHELL-THINNESS',
    label: '圆柱薄壳 t/r',
    ratio: thicknessM / meanRadiusM,
    maximum: 0.05,
    blockWhenExceeded: true,
    atLimitMessage: '恰处圆柱薄壳适用上限',
    exceededMessage: 't/r 超过 0.05，当前薄壳屈曲模型不适用',
  })
}

export function evaluateCircularShellLength(lengthM: number, meanRadiusM: number): ApplicabilityCheck {
  return maximumRatioCheck({
    code: 'P3-SHELL-LENGTH-RATIO',
    label: '圆柱壳 L/r',
    ratio: lengthM / meanRadiusM,
    maximum: 5,
    blockWhenExceeded: false,
    atLimitMessage: '恰处圆柱壳长径比产品护栏',
    exceededMessage: 'L/r 超过 5；长柱屈曲及壳-柱交互未覆盖',
  })
}
