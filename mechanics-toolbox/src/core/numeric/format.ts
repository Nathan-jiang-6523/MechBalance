import { isFiniteNumber, normalizeNegativeZero } from './finite'

export const INVALID_NUMBER_DISPLAY = '—'

function cleanExponent(value: string): string {
  return value.replace(/e\+?(-?)0*(\d+)/, 'e$1$2')
}

export function formatSignificant(value: unknown, significantDigits = 6): string {
  if (!isFiniteNumber(value) || significantDigits < 1) return INVALID_NUMBER_DISPLAY
  const normalized = normalizeNegativeZero(value)
  if (normalized === 0) return '0'
  return cleanExponent(normalized.toPrecision(significantDigits))
}

export function formatScientific(value: unknown, significantDigits = 6): string {
  if (!isFiniteNumber(value) || significantDigits < 1) return INVALID_NUMBER_DISPLAY
  const normalized = normalizeNegativeZero(value)
  if (normalized === 0) return '0'
  return cleanExponent(normalized.toExponential(significantDigits - 1))
}

export function formatEngineeringValue(value: unknown): string {
  if (!isFiniteNumber(value)) return INVALID_NUMBER_DISPLAY
  const normalized = normalizeNegativeZero(value)
  if (normalized === 0) return '0.000'

  const fixed = normalized.toFixed(3)
  if (Number(fixed) === 0 || Math.abs(normalized) >= 1e6) {
    return formatScientific(normalized, 6)
  }
  return fixed
}

export function formatExtremaPosition(value: unknown): string {
  if (!isFiniteNumber(value)) return INVALID_NUMBER_DISPLAY
  return normalizeNegativeZero(value).toFixed(2)
}

export function formatChartValue(value: unknown): string {
  return formatSignificant(value, 6)
}
