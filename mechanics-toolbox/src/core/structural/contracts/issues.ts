import type { ElementId, NodeId } from './model'

export const STRUCTURAL_ISSUE_SEVERITY = {
  P2_NONFINITE_INPUT: 'error',
  P2_NONPOSITIVE_PROPERTY: 'error',
  P2_ZERO_LENGTH_ELEMENT: 'error',
  P2_DUPLICATE_ID: 'error',
  P2_REFERENCE_NOT_FOUND: 'error',
  P2_ISOLATED_NODE: 'error',
  P2_SINGULAR_STIFFNESS: 'error',
  P2_ILL_CONDITIONED_STIFFNESS: 'error',
  P2_MODEL_LIMIT_EXCEEDED: 'error',
  P2_FEATURE_NOT_INCLUDED: 'error',
  P2_MODEL_SIZE_NEAR_LIMIT: 'warning',
} as const

export type StructuralIssueCode = keyof typeof STRUCTURAL_ISSUE_SEVERITY
export type StructuralIssueSeverity = (typeof STRUCTURAL_ISSUE_SEVERITY)[StructuralIssueCode]

export interface StructuralIssueLocation {
  readonly field?: string
  readonly nodeId?: NodeId
  readonly elementId?: ElementId
  readonly objectId?: string
}
export interface StructuralIssue extends StructuralIssueLocation {
  readonly code: StructuralIssueCode
  readonly severity: StructuralIssueSeverity
  readonly message: string
}

export function isStructuralIssueCode(value: unknown): value is StructuralIssueCode {
  return typeof value === 'string' && Object.hasOwn(STRUCTURAL_ISSUE_SEVERITY, value)
}

export function createStructuralIssue(
  code: StructuralIssueCode,
  message: string,
  location: StructuralIssueLocation = {},
): StructuralIssue {
  return { code, severity: STRUCTURAL_ISSUE_SEVERITY[code], message, ...location }
}

export function isStructuralIssue(value: unknown): value is StructuralIssue {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (!isStructuralIssueCode(candidate.code) || typeof candidate.message !== 'string') return false
  if (candidate.severity !== STRUCTURAL_ISSUE_SEVERITY[candidate.code]) return false
  return ['field', 'nodeId', 'elementId', 'objectId'].every(
    (key) => candidate[key] === undefined || typeof candidate[key] === 'string',
  )
}
