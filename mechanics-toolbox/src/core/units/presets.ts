import { UNIT_PRESETS } from './catalog'
import { convertUnit } from './converter'
import type { QuantityId, UnitId, UnitPreset, UnitPresetId } from './types'

export function getUnitPreset(id: UnitPresetId): UnitPreset {
  const preset = UNIT_PRESETS.find((candidate) => candidate.id === id)
  if (!preset) throw new Error(`未知单位预设：${id}`)
  return preset
}

export function getPresetUnit(quantity: QuantityId, presetId: UnitPresetId): UnitId {
  return getUnitPreset(presetId).units[quantity]
}

/**
 * Converts a finite display value between presets while preserving the SI physical value.
 * Empty fields remain empty. UI draft text must be validated before calling this function.
 */
export function convertPresetValue(
  value: number | null,
  quantity: QuantityId,
  fromPresetId: UnitPresetId,
  toPresetId: UnitPresetId,
): number | null {
  if (value === null) return null
  const fromUnit = getPresetUnit(quantity, fromPresetId)
  const toUnit = getPresetUnit(quantity, toPresetId)
  return convertUnit(value, quantity, fromUnit, toUnit)
}
