import type {
  ResultGroup,
  ResultValue,
  ScreenResult,
} from '../contracts'
import type { FormulaBinding, SolutionNature } from './types'

export type PlateShellSurface = 'positive' | 'mid-surface' | 'negative' | 'not-applicable'

export type PlateShellDirection =
  | 'x'
  | 'y'
  | 'xy'
  | 'radial'
  | 'hoop'
  | 'axial'
  | 'z-theta'
  | 'transverse'
  | 'resultant'
  | 'not-applicable'

export interface PlateShellCoordinates {
  readonly xM?: number
  readonly yM?: number
  readonly radiusM?: number
  readonly thicknessCoordinateM?: number
}

export interface PlateShellControlLocation {
  readonly label: string
  readonly coordinates: PlateShellCoordinates
  readonly surface: PlateShellSurface
  readonly direction: PlateShellDirection
}

export type ApplicabilityLevel = 'within' | 'at-limit' | 'warning' | 'blocked'

export interface ApplicabilityCheck {
  readonly code: string
  readonly label: string
  readonly level: ApplicabilityLevel
  readonly actual: number
  readonly limit: number
  readonly comparator: '<=' | '>='
  readonly message: string
}

export interface ApplicabilitySummary {
  readonly canCalculate: boolean
  readonly level: ApplicabilityLevel
  readonly checks: readonly ApplicabilityCheck[]
}

export interface PlateShellResultValue extends ResultValue {
  readonly control: PlateShellControlLocation
  readonly formulaId: string
  readonly solutionNature: SolutionNature
}

export interface PlateShellResultGroup extends Omit<ResultGroup, 'values'> {
  readonly values: readonly PlateShellResultValue[]
}

export interface PlateShellScreenResult extends Omit<ScreenResult, 'groups'> {
  readonly groups: readonly PlateShellResultGroup[]
  readonly formula: FormulaBinding
  readonly applicability: ApplicabilitySummary
}

