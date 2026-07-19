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

/** P2 values for which P1 has no compatible QuantityId/UnitId yet. */
export type StructuralUnitGapKey =
  | 'acceleration'
  | 'dimensionless'
  | 'strain'
  | 'thermalExpansionCoefficient'

export type StructuralQuantityKey = MappedStructuralQuantityKey | StructuralUnitGapKey

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
  acceleration: null,
  dimensionless: null,
  strain: null,
  thermalExpansionCoefficient: null,
} as const satisfies Readonly<Record<StructuralQuantityKey, QuantityId | null>>

export interface StructuralUnitGap {
  readonly quantity: StructuralUnitGapKey
  readonly reason: string
  readonly engineeringUnit: string
  readonly siUnit: string
  readonly p2Scope: string
}

export const STRUCTURAL_UNIT_GAPS = {
  acceleration: {
    quantity: 'acceleration',
    reason: 'P1 未登记加速度量纲或 m/s² 单位。',
    engineeringUnit: 'mm/s²',
    siUnit: 'm/s²',
    p2Scope: '桁架自重的可编辑重力加速度 g；共享单位扩展前不得假装已换算。',
  },
  dimensionless: {
    quantity: 'dimensionless',
    reason: 'P1 未登记通用无量纲 QuantityId/UnitId。',
    engineeringUnit: '1',
    siUnit: '1',
    p2Scope: '影响线无量纲纵坐标与移动荷载动力系数；数值不换算。',
  },
  strain: {
    quantity: 'strain',
    reason: 'P1 未登记无量纲应变或 με 显示单位。',
    engineeringUnit: 'με（或 1）',
    siUnit: '1',
    p2Scope: '桁架/刚架初应变 ε₀；内部 SI 采用无量纲数值。',
  },
  thermalExpansionCoefficient: {
    quantity: 'thermalExpansionCoefficient',
    reason: 'P1 未登记温度倒数量纲或 1/K 单位。',
    engineeringUnit: '1/°C',
    siUnit: '1/K',
    p2Scope: '桁架/刚架线膨胀系数 α；仅与均匀温差 ΔT 相乘。',
  },
} as const satisfies Readonly<Record<StructuralUnitGapKey, StructuralUnitGap>>

export const DEFAULT_STRUCTURAL_UNIT_PRESET_ID: UnitPresetId = 'engineering'
export const SI_STRUCTURAL_UNIT_PRESET_ID: UnitPresetId = 'si'

/** Reuses P1 preset objects; no structural conversion table is duplicated. */
export const STRUCTURAL_UNIT_SYSTEMS = UNIT_PRESETS

export class StructuralUnitMappingError extends Error {
  readonly code = 'STRUCTURAL_UNIT_GAP'

  constructor(
    readonly quantity: StructuralUnitGapKey,
    readonly gap: StructuralUnitGap,
  ) {
    super(`结构量 ${quantity} 尚无共享单位映射：${gap.reason}`)
    this.name = 'StructuralUnitMappingError'
  }
}

export function getStructuralQuantityId(quantity: StructuralQuantityKey): QuantityId | null {
  return STRUCTURAL_QUANTITY_MAP[quantity]
}

function requireStructuralQuantityId(quantity: StructuralQuantityKey): QuantityId {
  const quantityId = getStructuralQuantityId(quantity)
  if (quantityId !== null) return quantityId

  const gapQuantity = quantity as StructuralUnitGapKey
  throw new StructuralUnitMappingError(gapQuantity, STRUCTURAL_UNIT_GAPS[gapQuantity])
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
  return getPreset(presetId).units[requireStructuralQuantityId(quantity)]
}

export interface StructuralUnitSelection {
  readonly quantity: QuantityId
  readonly engineering: UnitId
  readonly si: UnitId
}

export function getStructuralUnitSelection(
  quantity: StructuralQuantityKey,
): StructuralUnitSelection {
  const quantityId = requireStructuralQuantityId(quantity)
  return {
    quantity: quantityId,
    engineering: getPreset(DEFAULT_STRUCTURAL_UNIT_PRESET_ID).units[quantityId],
    si: QUANTITY_CATALOG[quantityId].siUnit,
  }
}
