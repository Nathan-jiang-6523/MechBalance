import {
  calculateCircularShaftTorsion,
  solvePowerTransmission,
  type CircularShaftInput,
  type CircularShaftKind,
  type CircularShaftTorsionResult,
  type PowerSolveMode,
  type PowerTransmissionInput,
  type PowerTransmissionResult,
} from '../../core/torsion'
import { normalizeToSI, type QuantityId, type UnitId } from '../../core/units'

export interface NumericFieldDraft {
  value: string
  unit: UnitId
}

export type ElasticConstantInputMode = 'youngPoisson' | 'shearModulus'

export interface CircularShaftDraft {
  kind: CircularShaftKind
  diameter: NumericFieldDraft
  outerDiameter: NumericFieldDraft
  innerDiameter: NumericFieldDraft
  length: NumericFieldDraft
  elasticConstantInputMode: ElasticConstantInputMode
  youngModulus: NumericFieldDraft
  poissonRatio: string
  shearModulus: NumericFieldDraft
  torque: NumericFieldDraft
}

export interface PowerTransmissionDraft {
  solveFor: PowerSolveMode
  power: NumericFieldDraft
  torque: NumericFieldDraft
  speed: NumericFieldDraft
}

export class TorsionDraftError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'TorsionDraftError'
  }
}

export function createDefaultCircularShaftDraft(): CircularShaftDraft {
  return {
    kind: 'solid',
    diameter: { value: '50', unit: 'mm' },
    outerDiameter: { value: '60', unit: 'mm' },
    innerDiameter: { value: '40', unit: 'mm' },
    length: { value: '1000', unit: 'mm' },
    elasticConstantInputMode: 'youngPoisson',
    youngModulus: { value: '200000', unit: 'MPa' },
    poissonRatio: '0.3',
    shearModulus: { value: '', unit: 'MPa' },
    torque: { value: '1000000', unit: 'N_mm' },
  }
}

export function createDefaultPowerTransmissionDraft(): PowerTransmissionDraft {
  return {
    solveFor: 'torque',
    power: { value: '10', unit: 'kW' },
    torque: { value: '', unit: 'N_mm' },
    speed: { value: '1500', unit: 'r_per_min' },
  }
}

function numberToSI(
  field: NumericFieldDraft,
  quantity: QuantityId,
  fieldName: string,
): number {
  if (field.value.trim() === '') throw new TorsionDraftError(fieldName, '请输入有限数值')
  const value = Number(field.value)
  if (!Number.isFinite(value)) throw new TorsionDraftError(fieldName, '请输入有限数值')
  try {
    return normalizeToSI(value, quantity, field.unit)
  } catch (error) {
    throw new TorsionDraftError(
      fieldName,
      error instanceof Error ? error.message : '单位与物理量不兼容',
    )
  }
}

function positiveModulusToSI(
  field: NumericFieldDraft,
  fieldName: string,
  fieldLabel: string,
): number {
  const valuePa = numberToSI(field, 'elasticModulus', fieldName)
  if (valuePa <= 0) throw new TorsionDraftError(fieldName, `${fieldLabel}必须大于 0`)
  return valuePa
}

export function resolveCircularShaftShearModulusPa(draft: CircularShaftDraft): number {
  if (draft.elasticConstantInputMode === 'shearModulus') {
    return positiveModulusToSI(draft.shearModulus, 'shearModulus', '剪切模量 G')
  }

  const youngModulusPa = positiveModulusToSI(
    draft.youngModulus,
    'youngModulus',
    '杨氏模量 E',
  )
  const poissonRatio = Number(draft.poissonRatio)
  if (draft.poissonRatio.trim() === '' || !Number.isFinite(poissonRatio)) {
    throw new TorsionDraftError('poissonRatio', '请输入有限的泊松比 ν')
  }
  if (poissonRatio <= -1 || poissonRatio >= 0.5) {
    throw new TorsionDraftError('poissonRatio', '泊松比 ν 必须满足 -1 < ν < 0.5')
  }
  return youngModulusPa / (2 * (1 + poissonRatio))
}

export function buildCircularShaftInput(draft: CircularShaftDraft): CircularShaftInput {
  const common = {
    lengthM: numberToSI(draft.length, 'length', 'length'),
    shearModulusPa: resolveCircularShaftShearModulusPa(draft),
    torqueNm: numberToSI(draft.torque, 'torque', 'torque'),
  }
  return draft.kind === 'solid'
    ? {
        kind: 'solid',
        diameterM: numberToSI(draft.diameter, 'length', 'diameter'),
        ...common,
      }
    : {
        kind: 'tube',
        outerDiameterM: numberToSI(draft.outerDiameter, 'length', 'outerDiameter'),
        innerDiameterM: numberToSI(draft.innerDiameter, 'length', 'innerDiameter'),
        ...common,
      }
}

export function calculateCircularShaftDraft(
  draft: CircularShaftDraft,
): CircularShaftTorsionResult {
  return calculateCircularShaftTorsion(buildCircularShaftInput(draft))
}

export function buildPowerTransmissionInput(
  draft: PowerTransmissionDraft,
): PowerTransmissionInput {
  switch (draft.solveFor) {
    case 'power':
      return {
        solveFor: 'power',
        torqueNm: numberToSI(draft.torque, 'torque', 'torque'),
        rotationalSpeedRps: numberToSI(draft.speed, 'rotationalSpeed', 'speed'),
      }
    case 'torque':
      return {
        solveFor: 'torque',
        powerW: numberToSI(draft.power, 'power', 'power'),
        rotationalSpeedRps: numberToSI(draft.speed, 'rotationalSpeed', 'speed'),
      }
    case 'speed':
      return {
        solveFor: 'speed',
        powerW: numberToSI(draft.power, 'power', 'power'),
        torqueNm: numberToSI(draft.torque, 'torque', 'torque'),
      }
  }
}

export function calculatePowerTransmissionDraft(
  draft: PowerTransmissionDraft,
): PowerTransmissionResult {
  return solvePowerTransmission(buildPowerTransmissionInput(draft))
}
