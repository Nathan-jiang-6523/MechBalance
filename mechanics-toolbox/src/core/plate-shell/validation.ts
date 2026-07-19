import {
  combineValidationResults,
  validateLessThan,
  validateNumberField,
  type ValidationIssue,
  type ValidationResult,
} from '../validation'
import type { IsotropicElasticMaterial, LameCylinderGeometry } from './types'

function validationResult(issues: readonly ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues }
}

export function validateExplicitBoundary<T extends string>(
  field: string,
  value: unknown,
  allowed: readonly T[],
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return validationResult([{ field, code: 'REQUIRED', message: '必须显式选择边界条件' }])
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return validationResult([{ field, code: 'OUT_OF_RANGE', message: '边界条件与当前公式不匹配' }])
  }
  return validationResult([])
}

export function validatePositiveGeometry(
  geometry: Readonly<Record<string, unknown>>,
): ValidationResult {
  return combineValidationResults(
    ...Object.entries(geometry).map(([field, value]) =>
      validateNumberField(field, value, { required: true, positive: true }),
    ),
  )
}

export function validateIsotropicMaterial(
  material: IsotropicElasticMaterial,
): ValidationResult {
  return combineValidationResults(
    validateNumberField('elasticModulusPa', material.elasticModulusPa, {
      required: true,
      positive: true,
    }),
    validateNumberField('poissonRatio', material.poissonRatio, {
      required: true,
      min: -1,
      minInclusive: false,
      max: 0.5,
      maxInclusive: false,
    }),
  )
}

export function validateLameCylinderGeometry(
  geometry: LameCylinderGeometry,
): ValidationResult {
  return combineValidationResults(
    validateNumberField('innerRadiusM', geometry.innerRadiusM, { required: true, positive: true }),
    validateNumberField('outerRadiusM', geometry.outerRadiusM, { required: true, positive: true }),
    validateLessThan('innerRadiusM', geometry.innerRadiusM, 'outerRadiusM', geometry.outerRadiusM),
  )
}

export function validateEvaluationRadius(
  radiusM: number,
  innerRadiusM: number,
  outerRadiusM: number,
): ValidationResult {
  return combineValidationResults(
    validateNumberField('radiusM', radiusM, {
      required: true,
      min: innerRadiusM,
      max: outerRadiusM,
    }),
  )
}

