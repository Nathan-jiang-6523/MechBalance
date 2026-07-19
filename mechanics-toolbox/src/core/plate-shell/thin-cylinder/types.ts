import type { PlaneStressResult } from '../../stress'
import type { ApplicabilitySummary } from '../results'
import type {
  FormulaBinding,
  IsotropicElasticMaterial,
  PressurePair,
  ThinCylinderEndCondition,
  ThinCylinderGeometry,
} from '../types'

export const THIN_CYLINDER_OPEN_FORMULA: FormulaBinding = {
  id: 'P3-TW-PRESSURE-OPEN-1',
  version: '1.0.0',
  sourceKind: 'xu-textbook',
  solutionNature: 'ideal-elastic-estimate',
}

export const THIN_CYLINDER_CLOSED_FORMULA: FormulaBinding = {
  id: 'P3-TW-PRESSURE-CLOSED-1',
  version: '1.0.0',
  sourceKind: 'xu-textbook',
  solutionNature: 'ideal-elastic-estimate',
}

export const THIN_CYLINDER_AXIAL_FORMULA_ID = 'P3-TW-AXIAL-FORCE-1'
export const THIN_CYLINDER_TORSION_FORMULA_ID = 'P3-TW-TORSION-1'

export interface ThinCylinderLoad extends PressurePair {
  /** Signed centered axial force. Tension along +z is positive. */
  readonly axialForceN: number
  /** Signed torque. Positive creates +theta shear on the +z face. */
  readonly torqueNm: number
}

export interface ThinCylinderInput {
  readonly calculatorId: 'thin-cylinder'
  readonly boundary: ThinCylinderEndCondition
  readonly geometry: ThinCylinderGeometry
  readonly material: IsotropicElasticMaterial
  readonly load: ThinCylinderLoad
}

export interface ThinCylinderDraftInput extends Omit<ThinCylinderInput, 'boundary'> {
  readonly boundary: ThinCylinderEndCondition | null
}

export interface ThinCylinderMembraneForces {
  readonly hoopNPerM: number
  readonly axialPressureNPerM: number
  readonly axialForceNPerM: number
  readonly axialTotalNPerM: number
  readonly shearNPerM: number
}

export interface ThinCylinderStresses {
  readonly hoopPa: number
  readonly axialPressurePa: number
  readonly axialForcePa: number
  readonly axialTotalPa: number
  readonly shearPa: number
}

export type ThinCylinderWarningCode =
  | 'P3-TW-AT-LIMIT'
  | 'P3-TW-EXTERNAL-PRESSURE'

export interface ThinCylinderWarning {
  readonly code: ThinCylinderWarningCode
  readonly severity: 'warning' | 'strong-warning'
  readonly message: string
}

export interface ThinCylinderResult {
  readonly formula: FormulaBinding
  readonly supplementalFormulaIds: readonly string[]
  readonly boundary: ThinCylinderEndCondition
  readonly geometry: ThinCylinderGeometry
  readonly load: ThinCylinderLoad
  readonly netPressurePa: number
  readonly membraneForces: ThinCylinderMembraneForces
  readonly stresses: ThinCylinderStresses
  readonly planeStress: PlaneStressResult
  readonly applicability: ApplicabilitySummary
  readonly warnings: readonly ThinCylinderWarning[]
  readonly modelStatement: '薄壁膜应力近似'
  readonly controlLocation: '远离端部与载荷引入区的中面'
}

export class ThinCylinderInputError extends RangeError {
  constructor(
    message: string,
    readonly fields: readonly string[],
  ) {
    super(message)
    this.name = 'ThinCylinderInputError'
  }
}

export function thinCylinderFormulaFor(
  boundary: ThinCylinderEndCondition,
): FormulaBinding {
  return boundary === 'closed'
    ? THIN_CYLINDER_CLOSED_FORMULA
    : THIN_CYLINDER_OPEN_FORMULA
}
