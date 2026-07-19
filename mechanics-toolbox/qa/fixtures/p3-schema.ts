import type {
  FormulaSourceKind,
  PlateShellCalculatorId,
  SolutionNature,
} from '../../src/core/plate-shell'

export interface P3Tolerance {
  readonly relative: number
  readonly absolute: number
}

export interface P3ExpectedValue {
  readonly id: string
  readonly value: number
  readonly unit: string
  readonly position: string
  readonly surface: string
  readonly direction: string
  readonly tolerance: P3Tolerance
}

export interface P3Evidence {
  readonly kind: 'user-calculation' | 'closed-form' | 'mature-tool' | 'official-publication'
  readonly title: string
  readonly reference: string
  readonly accessedOn?: string
  readonly symbolConversion?: string
}

export interface P3AcceptanceFixture<TInput = unknown> {
  readonly id: `P3-${string}`
  readonly calculatorId: PlateShellCalculatorId
  readonly activeInFirstRelease: boolean
  readonly input: TInput
  readonly expectedStatus: 'success' | 'warning' | 'error'
  readonly expectedValues: readonly P3ExpectedValue[]
  readonly expectedMessageCodes: readonly string[]
  readonly formula: {
    readonly id: string
    readonly version: string
    readonly sourceKind: FormulaSourceKind
    readonly solutionNature: SolutionNature
  }
  readonly evidence: readonly P3Evidence[]
  readonly signedOffBy: string
  readonly signedOffOn: string
}

