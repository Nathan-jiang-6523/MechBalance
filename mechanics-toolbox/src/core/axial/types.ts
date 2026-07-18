export type AxialBoundaryCondition = 'free' | 'fullyRestrained'

export interface AxialSegmentInput {
  readonly id: string
  readonly lengthM: number
  readonly areaM2: number
  readonly elasticModulusPa: number
  /** 线膨胀系数，单位 1/K。 */
  readonly thermalExpansionPerK: number
  /** 温差，升温为正，单位 K。 */
  readonly deltaTemperatureK: number
}

interface AxialAnalysisBaseInput {
  readonly segments: readonly AxialSegmentInput[]
}

export interface FreeAxialAnalysisInput extends AxialAnalysisBaseInput {
  readonly boundary: 'free'
  /** 轴向拉力为正、压力为负。 */
  readonly axialForceN: number
}

export interface FullyRestrainedAxialAnalysisInput extends AxialAnalysisBaseInput {
  readonly boundary: 'fullyRestrained'
}

export type AxialAnalysisInput =
  | FreeAxialAnalysisInput
  | FullyRestrainedAxialAnalysisInput

export interface AxialSegmentResult extends AxialSegmentInput {
  readonly internalForceN: number
  readonly stressPa: number
  readonly mechanicalStrain: number
  readonly thermalStrain: number
  readonly totalStrain: number
  readonly mechanicalDeformationM: number
  readonly thermalDeformationM: number
  readonly totalDeformationM: number
}

export interface AxialAnalysisResult {
  readonly boundary: AxialBoundaryCondition
  readonly totalLengthM: number
  readonly axialComplianceMPerN: number
  readonly appliedForceN: number
  readonly constraintForceN: number
  readonly internalForceN: number
  readonly mechanicalDeformationM: number
  readonly freeThermalDeformationM: number
  readonly totalDeformationM: number
  readonly segments: readonly AxialSegmentResult[]
}

export interface AxialValidationError {
  readonly field: string
  readonly message: string
}

export type AxialCalculationResult =
  | { readonly ok: true; readonly value: AxialAnalysisResult; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly AxialValidationError[] }
