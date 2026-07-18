export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

export function nearlyEqual(
  actual: number,
  expected: number,
  relativeTolerance = 1e-12,
  absoluteTolerance = 0,
): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false
  const difference = Math.abs(actual - expected)
  if (difference <= absoluteTolerance) return true
  return difference <= relativeTolerance * Math.max(Math.abs(actual), Math.abs(expected))
}
