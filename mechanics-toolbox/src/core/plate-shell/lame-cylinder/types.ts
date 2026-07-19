import type { ApplicabilitySummary } from '../results'
import type {
  FormulaBinding,
  IsotropicElasticMaterial,
  LameCylinderAxialCondition,
  LameCylinderGeometry,
  PressurePair,
} from '../types'

export const LAME_STRESS_FORMULA: FormulaBinding = {
  id: 'P3-LM-STRESS-1', version: '1.0.0', sourceKind: 'xu-textbook',
  solutionNature: 'exact-closed-form',
}
export const LAME_DISPLACEMENT_FORMULA_ID = 'P3-LM-DISPLACEMENT-1'

export const LAME_AXIAL_FORMULA_IDS: Readonly<Record<LameCylinderAxialCondition, string>> = {
  open: 'P3-LM-AXIAL-OPEN-1',
  closed: 'P3-LM-AXIAL-CLOSED-1',
  'plane-strain': 'P3-LM-AXIAL-PLANE-STRAIN-1',
}

export interface LameCylinderLoad extends PressurePair {
  /** Signed centered axial force; tension is positive. Forbidden for plane strain. */
  readonly axialForceN: number
}

export interface LameCylinderInput {
  readonly calculatorId: 'lame-cylinder'
  readonly boundary: LameCylinderAxialCondition
  readonly geometry: LameCylinderGeometry
  readonly material: IsotropicElasticMaterial
  readonly load: LameCylinderLoad
  readonly evaluationRadiusM: number
}

export interface LameCylinderDraftInput extends Omit<LameCylinderInput, 'boundary'> {
  readonly boundary: LameCylinderAxialCondition | null
}

export interface LameConstants {
  readonly aPa: number
  readonly bPaM2: number
}

export interface LamePointResult {
  readonly label: '内表面' | '求值位置' | '外表面'
  readonly radiusM: number
  readonly radialStressPa: number
  readonly hoopStressPa: number
  readonly axialStressPa: number
  readonly radialDisplacementM: number
  readonly principalStressesPa: readonly [number, number, number]
  readonly vonMisesPa: number
  readonly trescaPa: number
}

export interface LameCurvePoint {
  readonly radiusM: number
  readonly radialStressPa: number
  readonly hoopStressPa: number
  readonly axialStressPa: number
}

export interface LameThinWallComparison {
  readonly meanRadiusM: number
  readonly thicknessM: number
  readonly ratio: number
  readonly lameHoopPa: number
  readonly thinHoopPa: number
  readonly hoopRelativeDifference: number | null
  readonly lameAxialPa: number
  readonly thinAxialPa: number
  readonly axialRelativeDifference: number | null
}

export interface LameCylinderResult {
  readonly formula: FormulaBinding
  readonly axialFormulaId: string
  readonly displacementFormulaId: string
  readonly boundary: LameCylinderAxialCondition
  readonly constants: LameConstants
  readonly axialStressPa: number
  readonly axialStrain: number | null
  readonly points: readonly [LamePointResult, LamePointResult, LamePointResult]
  readonly curve: readonly LameCurvePoint[]
  readonly innerPressureResidualPa: number
  readonly outerPressureResidualPa: number
  readonly applicability: ApplicabilitySummary
  readonly thinWallComparison: LameThinWallComparison | null
  readonly warnings: readonly string[]
  readonly controlLocation: '远离有限长度端部效应区域'
}

export class LameCylinderInputError extends RangeError {
  constructor(message: string, readonly fields: readonly string[]) {
    super(message)
    this.name = 'LameCylinderInputError'
  }
}
