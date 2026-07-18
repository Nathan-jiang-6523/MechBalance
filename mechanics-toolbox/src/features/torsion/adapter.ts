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

export interface CircularShaftDraft {
  kind: CircularShaftKind
  diameter: NumericFieldDraft
  outerDiameter: NumericFieldDraft
  innerDiameter: NumericFieldDraft
  length: NumericFieldDraft
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
    shearModulus: { value: '80000', unit: 'MPa' },
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

export function buildCircularShaftInput(draft: CircularShaftDraft): CircularShaftInput {
  const common = {
    lengthM: numberToSI(draft.length, 'length', 'length'),
    shearModulusPa: numberToSI(draft.shearModulus, 'stress', 'shearModulus'),
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
