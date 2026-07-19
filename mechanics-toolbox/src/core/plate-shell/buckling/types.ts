import type { ApplicabilitySummary } from '../results'
import type { IsotropicElasticMaterial, PlateBucklingBoundary, ShellBucklingBoundary } from '../types'

export interface PlateBucklingInput {
  readonly calculatorId: 'plate-buckling'
  readonly boundary: PlateBucklingBoundary
  readonly lengthXM: number
  readonly widthYM: number
  readonly thicknessM: number
  readonly material: IsotropicElasticMaterial
  readonly appliedCompressionNPerM: number
  readonly maximumLongitudinalHalfWaves: number
}

export interface PlateBucklingDraftInput extends Omit<PlateBucklingInput, 'boundary'> {
  readonly boundary: PlateBucklingBoundary | null
}

export interface PlateBucklingResult {
  readonly formulaId: 'P3-BK-PLATE-SSSS-UNIAXIAL-1'
  readonly solutionNature: 'ideal-elastic-estimate'
  readonly rigidityNm: number
  readonly longitudinalHalfWaves: number
  readonly transverseHalfWaves: 1
  readonly bucklingCoefficient: number
  readonly criticalLineLoadNPerM: number
  readonly criticalStressPa: number
  readonly criticalTotalForceN: number
  readonly appliedCompressionNPerM: number
  readonly utilization: number
  readonly applicability: ApplicabilitySummary
  readonly warnings: readonly string[]
}

export interface ShellBucklingInput {
  readonly calculatorId: 'shell-buckling'
  readonly boundary: ShellBucklingBoundary
  readonly lengthM: number
  readonly meanRadiusM: number
  readonly thicknessM: number
  readonly material: IsotropicElasticMaterial
  readonly appliedCompressionNPerM: number
  readonly maximumAxialHalfWaves: number
  readonly maximumCircumferentialWaves: number
}

export interface ShellBucklingDraftInput extends Omit<ShellBucklingInput, 'boundary'> {
  readonly boundary: ShellBucklingBoundary | null
}

export interface ShellBucklingResult {
  readonly formulaId: 'P3-BK-SHELL-NASA-SP8007-AXIAL-1'
  readonly solutionNature: 'ideal-elastic-estimate'
  readonly rigidityNm: number
  readonly curvatureParameterZ: number
  readonly axialHalfWaves: number
  readonly circumferentialWaves: number
  readonly searchLineLoadNPerM: number
  readonly classicalLineLoadNPerM: number
  readonly criticalLineLoadNPerM: number
  readonly criticalStressPa: number
  readonly criticalTotalForceN: number
  readonly appliedCompressionNPerM: number
  readonly utilization: number
  readonly applicability: ApplicabilitySummary
  readonly warnings: readonly string[]
}

export class BucklingInputError extends RangeError {
  constructor(message: string) {
    super(message)
    this.name = 'BucklingInputError'
  }
}
