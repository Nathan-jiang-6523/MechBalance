import type { MaterialPresetId } from '../materials'

export type PlateShellCalculatorId =
  | 'thin-cylinder'
  | 'lame-cylinder'
  | 'circular-plate'
  | 'rectangular-plate'
  | 'plate-buckling'
  | 'shell-buckling'

export type RectangularPlateBoundary = 'ssss' | 'cccc'
export type CircularPlateBoundary = 'clamped' | 'simply-supported'
export type ThinCylinderEndCondition = 'open' | 'closed'
export type LameCylinderAxialCondition = 'open' | 'closed' | 'plane-strain'
export type PlateBucklingBoundary = 'ssss-uniaxial'
export type ShellBucklingBoundary = 'simply-supported-axial'

export type PlateShellBoundaryCondition =
  | RectangularPlateBoundary
  | CircularPlateBoundary
  | ThinCylinderEndCondition
  | LameCylinderAxialCondition
  | PlateBucklingBoundary
  | ShellBucklingBoundary

export type FormulaSourceKind = 'xu-textbook' | 'official-publication' | 'product-guardrail'

export type SolutionNature =
  | 'exact-closed-form'
  | 'series'
  | 'ritz-approximation'
  | 'ideal-elastic-estimate'

export interface FormulaBinding {
  readonly id: string
  readonly version: string
  readonly sourceKind: FormulaSourceKind
  readonly solutionNature: SolutionNature
}

export interface IsotropicElasticMaterial {
  /** SI internal unit: Pa. */
  readonly elasticModulusPa: number
  readonly poissonRatio: number
  readonly presetId?: MaterialPresetId
}

export interface PressurePair {
  /** Non-negative pressure magnitude in Pa. */
  readonly internalPressurePa: number
  /** Non-negative pressure magnitude in Pa. */
  readonly externalPressurePa: number
}

export interface UniformTransversePressure {
  readonly kind: 'uniform-pressure'
  /** Signed SI pressure; positive follows the diagrammed +z direction. */
  readonly pressurePa: number
}

export interface AxialCompressionLoad {
  readonly kind: 'uniform-axial-compression'
  /** Non-negative compression line-load magnitude in N/m. */
  readonly lineLoadNPerM: number
}

export interface RectangularPlateGeometry {
  readonly kind: 'rectangular-plate'
  readonly lengthXM: number
  readonly lengthYM: number
  readonly thicknessM: number
}

export interface CircularPlateGeometry {
  readonly kind: 'solid-circular-plate'
  readonly radiusM: number
  readonly thicknessM: number
}

export interface ThinCylinderGeometry {
  readonly kind: 'thin-cylinder'
  readonly meanRadiusM: number
  readonly thicknessM: number
}

export interface LameCylinderGeometry {
  readonly kind: 'lame-cylinder'
  readonly innerRadiusM: number
  readonly outerRadiusM: number
}

export interface CircularShellGeometry {
  readonly kind: 'circular-shell'
  readonly meanRadiusM: number
  readonly thicknessM: number
  readonly lengthM: number
}

export type PlateShellGeometry =
  | RectangularPlateGeometry
  | CircularPlateGeometry
  | ThinCylinderGeometry
  | LameCylinderGeometry
  | CircularShellGeometry

/** Solver input boundary is required. UI draft state must use a separate nullable type. */
export interface PlateShellInput<
  TCalculator extends PlateShellCalculatorId,
  TBoundary extends PlateShellBoundaryCondition,
  TGeometry extends PlateShellGeometry,
  TLoad,
> {
  readonly calculatorId: TCalculator
  readonly boundary: TBoundary
  readonly geometry: TGeometry
  readonly material: IsotropicElasticMaterial
  readonly load: TLoad
  readonly formula: FormulaBinding
}

