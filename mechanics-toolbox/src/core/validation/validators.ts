import type {
  NumberFieldRules,
  ValidationIssue,
  ValidationResult,
} from './types'

function result(issues: readonly ValidationIssue[]): ValidationResult {
  return { valid: issues.length === 0, issues }
}

function issue(field: string, code: ValidationIssue['code'], message: string): ValidationIssue {
  return { field, code, message }
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

export function validateNumberField(
  field: string,
  value: unknown,
  rules: NumberFieldRules = {},
): ValidationResult {
  if (isEmpty(value)) {
    return rules.required === false
      ? result([])
      : result([issue(field, 'REQUIRED', '此字段为必填项')])
  }

  if (typeof value !== 'number') {
    return result([issue(field, 'NOT_A_NUMBER', '请输入数值')])
  }
  if (!Number.isFinite(value)) {
    return result([issue(field, 'NOT_FINITE', '请输入有限数值')])
  }

  const issues: ValidationIssue[] = []
  if (rules.positive && value <= 0) {
    issues.push(issue(field, 'MUST_BE_POSITIVE', '数值必须大于 0'))
  }

  if (rules.min !== undefined) {
    const allowed = rules.minInclusive === false ? value > rules.min : value >= rules.min
    if (!allowed) {
      const comparator = rules.minInclusive === false ? '大于' : '大于或等于'
      issues.push(issue(field, 'OUT_OF_RANGE', `数值必须${comparator} ${rules.min}`))
    }
  }

  if (rules.max !== undefined) {
    const allowed = rules.maxInclusive === false ? value < rules.max : value <= rules.max
    if (!allowed) {
      const comparator = rules.maxInclusive === false ? '小于' : '小于或等于'
      issues.push(issue(field, 'OUT_OF_RANGE', `数值必须${comparator} ${rules.max}`))
    }
  }
  return result(issues)
}

export function validateLessThan(
  lesserField: string,
  lesserValue: number,
  greaterField: string,
  greaterValue: number,
): ValidationResult {
  if (!Number.isFinite(lesserValue) || !Number.isFinite(greaterValue)) {
    return result([
      issue(lesserField, 'NOT_FINITE', `${lesserField} 与 ${greaterField} 必须是有限数值`),
    ])
  }
  return lesserValue < greaterValue
    ? result([])
    : result([
        issue(
          lesserField,
          'INVALID_RELATION',
          `${lesserField} 必须小于 ${greaterField}`,
        ),
      ])
}

export function validateBeamInteriorPosition(
  field: string,
  position: number,
  length: number,
): ValidationResult {
  if (!Number.isFinite(position) || !Number.isFinite(length)) {
    return result([issue(field, 'NOT_FINITE', '位置与梁长必须是有限数值')])
  }
  return position > 0 && position < length
    ? result([])
    : result([issue(field, 'OUTSIDE_BEAM', `位置必须满足 0 < ${field} < 梁长` )])
}

export function combineValidationResults(
  ...validationResults: readonly ValidationResult[]
): ValidationResult {
  return result(validationResults.flatMap((item) => item.issues))
}

export function issuesByField(
  validationResult: ValidationResult,
): Readonly<Record<string, readonly ValidationIssue[]>> {
  const grouped: Record<string, ValidationIssue[]> = {}
  for (const validationIssue of validationResult.issues) {
    ;(grouped[validationIssue.field] ??= []).push(validationIssue)
  }
  return grouped
}
