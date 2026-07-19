import {
  recoverFrameFiberStressAt,
  recoverFrameInternalForcesAt,
  type FrameInternalForceAtPoint,
  type FrameInternalForceFieldInput,
} from './field'

export type FrameInternalForceName = 'N' | 'V' | 'M'
export type FrameInternalForceUnit = 'N' | 'N*m'

export interface FrameInternalForceExtremum {
  readonly elementId: string
  readonly field: FrameInternalForceName
  readonly kind: 'min' | 'max'
  readonly localX: number
  readonly value: number
  readonly unit: FrameInternalForceUnit
}

export interface FrameFiberStressExtremum {
  readonly elementId: string
  readonly field: 'stress'
  readonly kind: 'min' | 'max'
  readonly localX: number
  readonly fiberY: number
  readonly value: number
  readonly unit: 'Pa'
}

function uniqueSorted(values: readonly number[]): number[] {
  const result: number[] = []
  for (const value of [...values].sort((left, right) => left - right)) {
    if (result.length === 0 || value !== result[result.length - 1]) {
      result.push(value)
    }
  }
  return result
}

function splitPositions(input: FrameInternalForceFieldInput): readonly number[] {
  return uniqueSorted([0, input.L, ...(input.distributedLoads ?? []).flatMap(({ a, b }) => [a, b])])
}

/**
 * Exact field-control positions: element ends, every load-segment boundary,
 * and every piecewise-linear V=0 root (therefore every interior M extremum).
 */
export function frameInternalForceControlPositions(
  input: FrameInternalForceFieldInput,
): readonly number[] {
  // Reuse field validation and end-equilibrium guard before deriving candidates.
  recoverFrameInternalForcesAt(input, 0)
  const boundaries = splitPositions(input)
  const candidates = [...boundaries]
  const xTolerance = Math.max(1e-12, input.L * 1e-12)

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const left = boundaries[index]!
    const right = boundaries[index + 1]!
    const leftV = recoverFrameInternalForcesAt(input, left).V
    const rightV = recoverFrameInternalForcesAt(input, right).V
    const valueTolerance = Math.max(1, Math.abs(leftV), Math.abs(rightV)) * 1e-12

    if (Math.abs(leftV) <= valueTolerance) candidates.push(left)
    if (Math.abs(rightV) <= valueTolerance) candidates.push(right)

    const deltaV = rightV - leftV
    if (Math.abs(deltaV) <= valueTolerance) continue
    const root = left - leftV * (right - left) / deltaV
    if (root > left + xTolerance && root < right - xTolerance) candidates.push(root)
  }

  return uniqueSorted(candidates)
}

function selectExtremum(
  samples: readonly FrameInternalForceAtPoint[],
  field: FrameInternalForceName,
  kind: 'min' | 'max',
): FrameInternalForceAtPoint {
  return samples.reduce((best, candidate) => {
    const better = kind === 'min' ? candidate[field] < best[field] : candidate[field] > best[field]
    return better ? candidate : best
  })
}

/** Returns min/max N, V and M from analytic control positions, not chart pixels. */
export function findFrameInternalForceExtrema(
  input: FrameInternalForceFieldInput,
): readonly FrameInternalForceExtremum[] {
  const samples = frameInternalForceControlPositions(input)
    .map((localX) => recoverFrameInternalForcesAt(input, localX))
  const units: Readonly<Record<FrameInternalForceName, FrameInternalForceUnit>> = {
    N: 'N',
    V: 'N',
    M: 'N*m',
  }

  return (['N', 'V', 'M'] as const).flatMap((field) =>
    (['min', 'max'] as const).map((kind) => {
      const result = selectExtremum(samples, field, kind)
      return {
        elementId: input.elementId,
        field,
        kind,
        localX: result.localX,
        value: result[field],
        unit: units[field],
      }
    }),
  )
}

/**
 * Fiber-stress candidates add roots of sigma'= -qX/A - V*y/I on every
 * constant-load segment. This also reduces to V=0 when qX=0 and y!=0.
 */
export function frameFiberStressControlPositions(
  input: FrameInternalForceFieldInput,
  fiberY: number,
  A: number,
  I: number,
): readonly number[] {
  recoverFrameFiberStressAt(input, 0, fiberY, A, I)
  const boundaries = splitPositions(input)
  const candidates = [...frameInternalForceControlPositions(input)]
  const xTolerance = Math.max(1e-12, input.L * 1e-12)

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const left = boundaries[index]!
    const right = boundaries[index + 1]!
    const middle = (left + right) / 2
    const qX = (input.distributedLoads ?? []).reduce((sum, load) => {
      return middle > load.a && middle < load.b ? sum + (load.qX ?? 0) : sum
    }, 0)
    const derivativeAt = (localX: number): number =>
      -qX / A - recoverFrameInternalForcesAt(input, localX).V * fiberY / I
    const leftDerivative = derivativeAt(left)
    const rightDerivative = derivativeAt(right)
    const valueTolerance = Math.max(1, Math.abs(leftDerivative), Math.abs(rightDerivative)) * 1e-12
    const deltaDerivative = rightDerivative - leftDerivative
    if (Math.abs(deltaDerivative) <= valueTolerance) continue
    const root = left - leftDerivative * (right - left) / deltaDerivative
    if (root > left + xTolerance && root < right - xTolerance) candidates.push(root)
  }

  return uniqueSorted(candidates)
}

export function findFrameFiberStressExtrema(
  input: FrameInternalForceFieldInput,
  fiberY: number,
  A: number,
  I: number,
): readonly FrameFiberStressExtremum[] {
  const samples = frameFiberStressControlPositions(input, fiberY, A, I).map((localX) =>
    recoverFrameFiberStressAt(input, localX, fiberY, A, I),
  )
  return (['min', 'max'] as const).map((kind) => {
    const result = samples.reduce((best, candidate) => {
      const better = kind === 'min' ? candidate.stress < best.stress : candidate.stress > best.stress
      return better ? candidate : best
    })
    return {
      elementId: input.elementId,
      field: 'stress',
      kind,
      localX: result.localX,
      fiberY,
      value: result.stress,
      unit: 'Pa',
    }
  })
}

/** Uniform plotting samples enriched with all analytic field-control positions. */
export function sampleFrameInternalForceField(
  input: FrameInternalForceFieldInput,
  intervalCount = 40,
): readonly FrameInternalForceAtPoint[] {
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw new RangeError('intervalCount must be a positive integer')
  }
  const positions = uniqueSorted([
    ...Array.from({ length: intervalCount + 1 }, (_, index) => input.L * index / intervalCount),
    ...frameInternalForceControlPositions(input),
  ])
  return positions.map((localX) => recoverFrameInternalForcesAt(input, localX))
}
