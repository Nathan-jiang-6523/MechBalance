import { beamDisplacementPolynomials, type BeamDisplacementFieldInput } from './displacement-field'
import { beamInternalForcePolynomials, type BeamInternalForceFieldInput } from './field'

export type BeamFieldName = 'u' | 'v' | 'theta' | 'N' | 'V' | 'M'

export interface PolynomialExtremum {
  readonly localX: number
  readonly value: number
}

export interface PolynomialExtrema {
  readonly min: PolynomialExtremum
  readonly max: PolynomialExtremum
}

export interface BeamFieldExtremum extends PolynomialExtremum {
  readonly elementId: string
  readonly globalX: number
  readonly field: BeamFieldName
  readonly kind: 'min' | 'max'
}

export interface BeamElementExtremaInput
  extends BeamDisplacementFieldInput, BeamInternalForceFieldInput {
  readonly elementId: string
  readonly xI: number
}

export function evaluatePolynomial(coefficients: readonly number[], x: number): number {
  if (!Number.isFinite(x) || coefficients.length === 0 || coefficients.some((value) => !Number.isFinite(value))) {
    throw new RangeError('多项式输入必须为非空有限数')
  }
  let value = 0
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    value = value * x + coefficients[index]!
  }
  return value === 0 ? 0 : value
}

export function polynomialDerivative(coefficients: readonly number[]): readonly number[] {
  if (coefficients.length === 0 || coefficients.some((value) => !Number.isFinite(value))) {
    throw new RangeError('多项式输入必须为非空有限数')
  }
  if (coefficients.length === 1) return [0]
  return coefficients.slice(1).map((value, index) => value * (index + 1))
}

function degreeOf(coefficients: readonly number[]): number {
  let degree = coefficients.length - 1
  while (degree > 0 && coefficients[degree] === 0) degree -= 1
  return degree
}

function uniqueSorted(values: readonly number[], tolerance: number): number[] {
  const result: number[] = []
  for (const value of [...values].sort((left, right) => left - right)) {
    if (result.length === 0 || Math.abs(value - result[result.length - 1]!) > tolerance) result.push(value)
  }
  return result
}

/** Roots in a closed interval using derivative-partitioned monotonic brackets, not sampling. */
export function realPolynomialRootsInInterval(
  coefficients: readonly number[],
  start: number,
  end: number,
): readonly number[] {
  if (coefficients.length === 0 || coefficients.some((value) => !Number.isFinite(value))) {
    throw new RangeError('多项式输入必须为非空有限数')
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new RangeError('根搜索区间无效')
  }
  const degree = degreeOf(coefficients)
  if (degree === 0) return []
  const xTolerance = Math.max(1e-12, Math.abs(end - start) * 1e-12)
  if (degree === 1) {
    const root = -coefficients[0]! / coefficients[1]!
    return root >= start - xTolerance && root <= end + xTolerance
      ? [Math.min(end, Math.max(start, root))]
      : []
  }

  const derivativeRoots = realPolynomialRootsInInterval(
    polynomialDerivative(coefficients.slice(0, degree + 1)),
    start,
    end,
  )
  const boundaries = uniqueSorted([start, ...derivativeRoots, end], xTolerance)
  const magnitude = coefficients.slice(0, degree + 1).reduce(
    (sum, coefficient, power) => sum + Math.abs(coefficient) * Math.max(1, Math.abs(start) ** power, Math.abs(end) ** power),
    0,
  )
  const valueTolerance = Math.max(1e-12, magnitude * 1e-12)
  const roots: number[] = []

  for (const x of boundaries) {
    if (Math.abs(evaluatePolynomial(coefficients, x)) <= valueTolerance) roots.push(x)
  }
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    let left = boundaries[index]!
    let right = boundaries[index + 1]!
    let leftValue = evaluatePolynomial(coefficients, left)
    const rightValue = evaluatePolynomial(coefficients, right)
    if (leftValue === 0 || rightValue === 0 || Math.sign(leftValue) === Math.sign(rightValue)) continue
    for (let iteration = 0; iteration < 100 && right - left > xTolerance; iteration += 1) {
      const middle = (left + right) / 2
      const middleValue = evaluatePolynomial(coefficients, middle)
      if (middleValue === 0) {
        left = middle
        right = middle
        break
      }
      if (Math.sign(leftValue) === Math.sign(middleValue)) {
        left = middle
        leftValue = middleValue
      } else {
        right = middle
      }
    }
    roots.push((left + right) / 2)
  }
  return uniqueSorted(roots, xTolerance)
}

export function findPolynomialExtrema(
  coefficients: readonly number[],
  start: number,
  end: number,
): PolynomialExtrema {
  if (coefficients.length === 0 || coefficients.some((value) => !Number.isFinite(value))) {
    throw new RangeError('多项式输入必须为非空有限数')
  }
  const candidates = uniqueSorted([
    start,
    ...realPolynomialRootsInInterval(polynomialDerivative(coefficients), start, end),
    end,
  ], Math.max(1e-12, Math.abs(end - start) * 1e-12))
  const values = candidates.map((localX) => ({ localX, value: evaluatePolynomial(coefficients, localX) }))
  return {
    min: values.reduce((best, candidate) => candidate.value < best.value ? candidate : best),
    max: values.reduce((best, candidate) => candidate.value > best.value ? candidate : best),
  }
}

/** Return min/max of u/v/theta/N/V/M with element and global positions. */
export function findBeamElementExtrema(input: BeamElementExtremaInput): readonly BeamFieldExtremum[] {
  if (!Number.isFinite(input.xI)) throw new RangeError('xI 必须为有限数')
  const displacement = beamDisplacementPolynomials(input)
  const internalForce = beamInternalForcePolynomials(input)
  const fields: Readonly<Record<BeamFieldName, readonly number[]>> = {
    ...displacement,
    ...internalForce,
  }
  return (Object.entries(fields) as [BeamFieldName, readonly number[]][]).flatMap(([field, coefficients]) => {
    const extrema = findPolynomialExtrema(coefficients, 0, input.L)
    return (['min', 'max'] as const).map((kind) => ({
      elementId: input.elementId,
      field,
      kind,
      ...extrema[kind],
      globalX: input.xI + extrema[kind].localX,
    }))
  })
}
