import type { CalculatorStatus } from '../../core/contracts'

export type StructuralModuleId =
  | 'beam'
  | 'influence-line'
  | 'moving-load'
  | 'truss'
  | 'frame'
  | 'advanced-beam'
  | 'spatial-structure'

export interface StructuralModuleDescriptor {
  readonly id: StructuralModuleId
  readonly index: string
  readonly title: string
  readonly summary: string
  readonly status: CalculatorStatus
}

export interface StructuralFormulaDescriptor {
  readonly id: string
  readonly label: string
  readonly version: string
  readonly latex: string
}

export interface StructuralTheoryContent {
  readonly title: string
  readonly formulas: readonly StructuralFormulaDescriptor[]
  readonly assumptions: readonly string[]
  readonly boundaries: readonly string[]
  readonly mixedUnitNotes: readonly string[]
}

export interface StructuralMatrixView {
  readonly id: string
  readonly title: string
  readonly values: readonly (readonly number[])[]
  readonly rowLabels: readonly string[]
  readonly columnLabels: readonly string[]
}
