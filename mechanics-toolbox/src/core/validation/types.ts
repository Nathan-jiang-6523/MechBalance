export type ValidationIssueCode =
  | 'REQUIRED'
  | 'NOT_A_NUMBER'
  | 'NOT_FINITE'
  | 'MUST_BE_POSITIVE'
  | 'OUT_OF_RANGE'
  | 'INVALID_RELATION'
  | 'OUTSIDE_BEAM'

export interface ValidationIssue {
  readonly field: string
  readonly code: ValidationIssueCode
  readonly message: string
}

export interface ValidationResult {
  readonly valid: boolean
  readonly issues: readonly ValidationIssue[]
}

export interface NumberFieldRules {
  readonly required?: boolean
  readonly positive?: boolean
  readonly min?: number
  readonly max?: number
  readonly minInclusive?: boolean
  readonly maxInclusive?: boolean
}
