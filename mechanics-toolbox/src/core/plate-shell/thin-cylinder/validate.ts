import {
  combineValidationResults,
  validateNumberField,
  type ValidationIssue,
  type ValidationResult,
} from '../../validation'
import { evaluateThinWallRatio, summarizeApplicability } from '../applicability'
import type { ApplicabilitySummary } from '../results'
import { validateExplicitBoundary, validateIsotropicMaterial } from '../validation'
import type { ThinCylinderDraftInput } from './types'

export interface ThinCylinderValidation {
  readonly validation: ValidationResult
  readonly applicability: ApplicabilitySummary
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  meanRadiusM: '中面半径',
  thicknessM: '厚度',
  internalPressurePa: '内压',
  externalPressurePa: '外压',
  axialForceN: '轴力',
  torqueNm: '扭矩',
  elasticModulusPa: '弹性模量',
  poissonRatio: '泊松比',
}

function labelIssues(result: ValidationResult): ValidationResult {
  const issues = result.issues.map<ValidationIssue>((issue) => {
    const label = FIELD_LABELS[issue.field]
    if (!label) return issue
    if (issue.code === 'MUST_BE_POSITIVE') {
      return { ...issue, message: `${label}必须大于 0` }
    }
    if (issue.code === 'NOT_FINITE') {
      return { ...issue, message: `${label}输入必须为有限数` }
    }
    return issue
  })
  return { valid: issues.length === 0, issues }
}

export function validateThinCylinderInput(
  input: ThinCylinderDraftInput,
): ThinCylinderValidation {
  const geometry = combineValidationResults(
    validateNumberField('meanRadiusM', input.geometry.meanRadiusM, {
      required: true,
      positive: true,
    }),
    validateNumberField('thicknessM', input.geometry.thicknessM, {
      required: true,
      positive: true,
    }),
  )
  const loads = combineValidationResults(
    validateNumberField('internalPressurePa', input.load.internalPressurePa, {
      required: true,
      min: 0,
    }),
    validateNumberField('externalPressurePa', input.load.externalPressurePa, {
      required: true,
      min: 0,
    }),
    validateNumberField('axialForceN', input.load.axialForceN),
    validateNumberField('torqueNm', input.load.torqueNm),
  )
  const validation = labelIssues(combineValidationResults(
    validateExplicitBoundary('boundary', input.boundary, ['open', 'closed']),
    geometry,
    validateIsotropicMaterial(input.material),
    loads,
  ))
  const ratioCheck = evaluateThinWallRatio(
    input.geometry.thicknessM,
    input.geometry.meanRadiusM,
  )
  return {
    validation,
    applicability: summarizeApplicability([ratioCheck]),
  }
}
