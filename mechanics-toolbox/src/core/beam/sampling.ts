import { findBeamExtrema } from './extrema'
import type {
  BeamExtrema,
  BeamFieldValue,
  BeamSamplePoint,
  BeamSampleReason,
  BeamSamplingOptions,
  BeamSolution,
  DiscontinuitySide,
} from './types'

export const DEFAULT_BEAM_BASE_SAMPLE_COUNT = 401

const CURVED_FIELDS = ['momentNm', 'rotationRad', 'deflectionM'] as const

function sampleKey(xM: number, side: DiscontinuitySide): string {
  return `${xM.toPrecision(16)}:${side}`
}

function insideSide(xM: number, lengthM: number): DiscontinuitySide {
  return xM === lengthM ? 'left' : 'right'
}

function shouldRefine(
  left: BeamFieldValue,
  middle: BeamFieldValue,
  right: BeamFieldValue,
  relativeTolerance: number,
): boolean {
  return CURVED_FIELDS.some((field) => {
    const linearMiddle = (left[field] + right[field]) / 2
    const scale = Math.max(Math.abs(left[field]), Math.abs(middle[field]), Math.abs(right[field]), 1e-30)
    return Math.abs(middle[field] - linearMiddle) > relativeTolerance * scale
  })
}

function adaptivePositions(
  solution: BeamSolution,
  leftM: number,
  rightM: number,
  relativeTolerance: number,
  maxDepth: number,
  depth = 0,
): number[] {
  if (depth >= maxDepth || rightM <= leftM) return []
  const middleM = (leftM + rightM) / 2
  const left = solution.evaluate(leftM, 'right')
  const middle = solution.evaluate(middleM, 'right')
  const right = solution.evaluate(rightM, 'left')
  if (!shouldRefine(left, middle, right, relativeTolerance)) return []
  return [
    ...adaptivePositions(solution, leftM, middleM, relativeTolerance, maxDepth, depth + 1),
    middleM,
    ...adaptivePositions(solution, middleM, rightM, relativeTolerance, maxDepth, depth + 1),
  ]
}

export function sampleBeamSolution(
  solution: BeamSolution,
  extrema: BeamExtrema = findBeamExtrema(solution),
  options: BeamSamplingOptions = {},
): BeamSamplePoint[] {
  const basePointCount = options.basePointCount ?? DEFAULT_BEAM_BASE_SAMPLE_COUNT
  const relativeTolerance = options.relativeTolerance ?? 1e-5
  const maxRefinementDepth = options.maxRefinementDepth ?? 3
  if (!Number.isInteger(basePointCount) || basePointCount < 2) {
    throw new RangeError('基础采样点数必须是大于或等于 2 的整数')
  }
  if (!Number.isFinite(relativeTolerance) || relativeTolerance <= 0) {
    throw new RangeError('自适应采样相对容差必须大于 0')
  }
  if (!Number.isInteger(maxRefinementDepth) || maxRefinementDepth < 0) {
    throw new RangeError('自适应采样最大深度必须是非负整数')
  }

  const samples = new Map<string, BeamSamplePoint>()
  const add = (xM: number, side: DiscontinuitySide, reason: BeamSampleReason): void => {
    const key = sampleKey(xM, side)
    const current = samples.get(key)
    if (current) {
      if (!current.reasons.includes(reason)) current.reasons.push(reason)
      return
    }
    samples.set(key, { ...solution.evaluate(xM, side), reasons: [reason] })
  }

  const lengthM = solution.model.lengthM
  for (let index = 0; index < basePointCount; index += 1) {
    const xM = index === basePointCount - 1 ? lengthM : (lengthM * index) / (basePointCount - 1)
    add(xM, insideSide(xM, lengthM), 'base')
  }

  for (const xM of solution.discontinuitiesM) {
    if (xM <= 0) {
      add(0, 'right', 'discontinuity')
    } else if (xM >= lengthM) {
      add(lengthM, 'left', 'discontinuity')
    } else {
      add(xM, 'left', 'discontinuity')
      add(xM, 'right', 'discontinuity')
    }
  }

  for (const fieldExtrema of Object.values(extrema)) {
    for (const candidate of fieldExtrema.candidates) {
      if (candidate.reasons.includes('stationary')) add(candidate.xM, candidate.side, 'extremum')
    }
  }

  const boundaries = [
    0,
    ...solution.discontinuitiesM.filter((xM) => xM > 0 && xM < lengthM),
    lengthM,
  ].sort((a, b) => a - b)
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const leftM = boundaries[index]
    const rightM = boundaries[index + 1]
    if (leftM === undefined || rightM === undefined) continue
    for (const xM of adaptivePositions(
      solution,
      leftM,
      rightM,
      relativeTolerance,
      maxRefinementDepth,
    )) {
      add(xM, 'right', 'adaptive')
    }
  }

  return [...samples.values()].sort(
    (a, b) => a.xM - b.xM || (a.side === b.side ? 0 : a.side === 'left' ? -1 : 1),
  )
}
