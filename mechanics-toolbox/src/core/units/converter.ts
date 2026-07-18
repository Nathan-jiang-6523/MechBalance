import { QUANTITY_CATALOG } from './catalog'
import type { ConversionResult, QuantityDefinition, QuantityId, UnitDefinition, UnitId } from './types'

export type UnitConversionErrorCode =
  | 'NON_FINITE_VALUE'
  | 'UNKNOWN_QUANTITY'
  | 'INCOMPATIBLE_UNIT'
  | 'NON_FINITE_RESULT'

export class UnitConversionError extends Error {
  constructor(
    readonly code: UnitConversionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'UnitConversionError'
  }
}

export function getQuantityDefinition(quantity: QuantityId): QuantityDefinition {
  const definition = QUANTITY_CATALOG[quantity]
  if (!definition) {
    throw new UnitConversionError('UNKNOWN_QUANTITY', `未知物理量：${String(quantity)}`)
  }
  return definition
}

export function getUnitDefinition(quantity: QuantityId, unit: UnitId): UnitDefinition {
  const definition = getQuantityDefinition(quantity)
  const unitDefinition = definition.units.find((candidate) => candidate.id === unit)
  if (!unitDefinition) {
    throw new UnitConversionError(
      'INCOMPATIBLE_UNIT',
      `单位 ${unit} 不属于物理量 ${definition.label}`,
    )
  }
  return unitDefinition
}

function assertFinite(value: number, stage: 'input' | 'result'): void {
  if (!Number.isFinite(value)) {
    throw new UnitConversionError(
      stage === 'input' ? 'NON_FINITE_VALUE' : 'NON_FINITE_RESULT',
      stage === 'input' ? '换算输入必须是有限数值' : '换算结果不是有限数值',
    )
  }
}

export function normalizeToSI(value: number, quantity: QuantityId, fromUnit: UnitId): number {
  assertFinite(value, 'input')
  const siValue = getUnitDefinition(quantity, fromUnit).toSI(value)
  assertFinite(siValue, 'result')
  return Object.is(siValue, -0) ? 0 : siValue
}

export function convertFromSI(value: number, quantity: QuantityId, toUnit: UnitId): number {
  assertFinite(value, 'input')
  const outputValue = getUnitDefinition(quantity, toUnit).fromSI(value)
  assertFinite(outputValue, 'result')
  return Object.is(outputValue, -0) ? 0 : outputValue
}

export function convertUnit(
  value: number,
  quantity: QuantityId,
  fromUnit: UnitId,
  toUnit: UnitId,
): number {
  const siValue = normalizeToSI(value, quantity, fromUnit)
  return convertFromSI(siValue, quantity, toUnit)
}

export function convertUnitDetailed(
  value: number,
  quantity: QuantityId,
  fromUnit: UnitId,
  toUnit: UnitId,
): ConversionResult {
  const siValue = normalizeToSI(value, quantity, fromUnit)
  const outputValue = convertFromSI(siValue, quantity, toUnit)
  return { quantity, inputValue: value, fromUnit, siValue, outputValue, toUnit }
}

export function isUnitCompatible(quantity: QuantityId, unit: UnitId): boolean {
  return QUANTITY_CATALOG[quantity]?.units.some((candidate) => candidate.id === unit) ?? false
}
