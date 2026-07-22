import { QUANTITY_CATALOG, UNIT_PRESETS } from '../units'
import type { QuantityId, UnitId, UnitPresetId } from '../units'

/**
 * P2 structural values that can be represented by the P1 quantity catalog.
 *
 * The aliases are intentional: coordinates, displacements and result positions
 * all share the P1 length converter, while rotational and coupling stiffness
 * reuse their physical dimensions (moment and force respectively).
 */
export type MappedStructuralQuantityKey =
  | 'length'
  | 'coordinate'
  | 'displacement'
  | 'extremumPosition'
  | 'area'
  | 'secondMomentOfArea'
  | 'elasticModulus'
  | 'stress'
  | 'force'
  | 'mass'
  | 'moment'
  | 'lineLoad'
  | 'density'
  | 'rotation'
  | 'temperatureDifference'
  | 'translationalStiffness'
  | 'translationRotationStiffness'
  | 'rotationalStiffness'
  | 'acceleration'
  | 'dimensionless'
  | 'strain'
  | 'thermalExpansionCoefficient'
  | 'flexibility'

export type StructuralQuantityKey = MappedStructuralQuantityKey

export const STRUCTURAL_QUANTITY_MAP = {
  length: 'length',
  coordinate: 'length',
  displacement: 'length',
  extremumPosition: 'length',
  area: 'area',
  secondMomentOfArea: 'secondMomentOfArea',
  elasticModulus: 'elasticModulus',
  stress: 'stress',
  force: 'force',
  mass: 'mass',
  moment: 'moment',
  lineLoad: 'lineLoad',
  density: 'density',
  rotation: 'angle',
  temperatureDifference: 'temperatureDifference',
  translationRotationStiffness: 'force',
  rotationalStiffness: 'moment',
  translationalStiffness: 'lineLoad',
  acceleration: 'acceleration',
  dimensionless: 'dimensionless',
  strain: 'strain',
  thermalExpansionCoefficient: 'thermalExpansionCoefficient',
  flexibility: 'flexibility',
} as const satisfies Readonly<Record<StructuralQuantityKey, QuantityId>>

/** All P2 quantities now map to the shared catalog. */
export const STRUCTURAL_UNIT_GAPS = {} as const

export const DEFAULT_STRUCTURAL_UNIT_PRESET_ID: UnitPresetId = 'engineering'
export const SI_STRUCTURAL_UNIT_PRESET_ID: UnitPresetId = 'si'

/** Reuses P1 preset objects; no structural conversion table is duplicated. */
export const STRUCTURAL_UNIT_SYSTEMS = UNIT_PRESETS

export function getStructuralQuantityId(quantity: StructuralQuantityKey): QuantityId {
  return STRUCTURAL_QUANTITY_MAP[quantity]
}

function getPreset(presetId: UnitPresetId) {
  const preset = STRUCTURAL_UNIT_SYSTEMS.find((candidate) => candidate.id === presetId)
  if (!preset) {
    throw new Error(`未知单位制：${String(presetId)}`)
  }
  return preset
}

export function getStructuralUnit(
  quantity: StructuralQuantityKey,
  presetId: UnitPresetId = DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
): UnitId {
  return getPreset(presetId).units[getStructuralQuantityId(quantity)]
}

export interface StructuralUnitSelection {
  readonly quantity: QuantityId
  readonly engineering: UnitId
  readonly si: UnitId
}

export function getStructuralUnitSelection(
  quantity: StructuralQuantityKey,
): StructuralUnitSelection {
  const quantityId = getStructuralQuantityId(quantity)
  return {
    quantity: quantityId,
    engineering: getPreset(DEFAULT_STRUCTURAL_UNIT_PRESET_ID).units[quantityId],
    si: QUANTITY_CATALOG[quantityId].siUnit,
  }
}
