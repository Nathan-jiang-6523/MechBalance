import {
  combineValidationResults,
  validateNumberField,
  type ValidationIssue,
  type ValidationResult,
} from '../../validation'
import { validateExplicitBoundary, validateIsotropicMaterial, validateLameCylinderGeometry } from '../validation'
import type { LameCylinderDraftInput } from './types'

const LABELS: Readonly<Record<string, string>> = {
  innerRadiusM: '内半径', outerRadiusM: '外半径', evaluationRadiusM: '求值半径',
  internalPressurePa: '内压', externalPressurePa: '外压', axialForceN: '轴力',
  elasticModulusPa: '弹性模量', poissonRatio: '泊松比',
}

function relabel(result: ValidationResult): ValidationResult {
  const issues = result.issues.map<ValidationIssue>((issue) => {
    const label = LABELS[issue.field]
    if (!label) return issue
    if (issue.code === 'MUST_BE_POSITIVE') return { ...issue, message: `${label}必须大于 0` }
    if (issue.code === 'NOT_FINITE') return { ...issue, message: `${label}输入必须为有限数` }
    return issue
  })
  return { valid: issues.length === 0, issues }
}

export function validateLameCylinderInput(input: LameCylinderDraftInput): ValidationResult {
  const issues: ValidationIssue[] = []
  const radius = input.evaluationRadiusM
  const { innerRadiusM, outerRadiusM } = input.geometry
  const evaluation = validateNumberField('evaluationRadiusM', radius, { required: true })
  issues.push(...evaluation.issues)
  if (Number.isFinite(radius) && Number.isFinite(innerRadiusM) && Number.isFinite(outerRadiusM)
    && (radius < innerRadiusM || radius > outerRadiusM)) {
    issues.push({
      field: 'evaluationRadiusM', code: 'OUT_OF_RANGE',
      message: '求值半径必须满足 ri≤r≤ro，不得自动夹取到边界',
    })
  }
  if (input.boundary === 'plane-strain' && input.load.axialForceN !== 0) {
    issues.push({
      field: 'axialForceN', code: 'INVALID_RELATION',
      message: '平面应变状态禁止叠加任意轴力，以免过约束',
    })
  }
  return relabel(combineValidationResults(
    validateExplicitBoundary('boundary', input.boundary, ['open', 'closed', 'plane-strain']),
    validateLameCylinderGeometry(input.geometry),
    validateIsotropicMaterial(input.material),
    validateNumberField('internalPressurePa', input.load.internalPressurePa, { required: true, min: 0 }),
    validateNumberField('externalPressurePa', input.load.externalPressurePa, { required: true, min: 0 }),
    validateNumberField('axialForceN', input.load.axialForceN),
    { valid: issues.length === 0, issues },
  ))
}
