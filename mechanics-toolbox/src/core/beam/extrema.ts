import type {
  BeamCandidateReason,
  BeamExtrema,
  BeamExtremumCandidate,
  BeamFieldExtrema,
  BeamFieldKey,
  BeamSolution,
  DiscontinuitySide,
} from './types'

const DERIVATIVE_FIELD: Partial<Record<BeamFieldKey, BeamFieldKey>> = {
  momentNm: 'shearN',
  rotationRad: 'momentNm',
  deflectionM: 'rotationRad',
}

interface LocatedPoint {
  xM: number
  side: DiscontinuitySide
}

function positionTolerance(lengthM: number): number {
  return Math.max(lengthM * 1e-12, 1e-14)
}

function uniqueSorted(values: readonly number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const result: number[] = []
  for (const value of sorted) {
    const previous = result.at(-1)
    if (previous === undefined || Math.abs(value - previous) > tolerance) result.push(value)
  }
  return result
}

function fieldValue(solution: BeamSolution, field: BeamFieldKey, point: LocatedPoint): number {
  return solution.evaluate(point.xM, point.side)[field]
}

function pointAtIntervalPosition(
  xM: number,
  startM: number,
  endM: number,
  tolerance: number,
): LocatedPoint {
  if (Math.abs(xM - startM) <= tolerance) return { xM: startM, side: 'right' }
  if (Math.abs(xM - endM) <= tolerance) return { xM: endM, side: 'left' }
  return { xM, side: 'right' }
}

function zeroTolerance(values: readonly number[]): number {
  const scale = Math.max(...values.map(Math.abs), Number.MIN_VALUE)
  return Math.max(scale * 1e-12, Number.MIN_VALUE * 32)
}

function bisectSignChange(
  solution: BeamSolution,
  field: BeamFieldKey,
  leftM: number,
  rightM: number,
  segmentStartM: number,
  segmentEndM: number,
): number {
  const xTolerance = positionTolerance(solution.model.lengthM)
  let left = leftM
  let right = rightM
  let leftValue = fieldValue(
    solution,
    field,
    pointAtIntervalPosition(left, segmentStartM, segmentEndM, xTolerance),
  )
  let rightValue = fieldValue(
    solution,
    field,
    pointAtIntervalPosition(right, segmentStartM, segmentEndM, xTolerance),
  )
  const valueTolerance = zeroTolerance([leftValue, rightValue])

  if (Math.abs(leftValue) <= valueTolerance) return left
  if (Math.abs(rightValue) <= valueTolerance) return right

  for (let iteration = 0; iteration < 80 && right - left > xTolerance; iteration += 1) {
    const middle = (left + right) / 2
    const middleValue = fieldValue(solution, field, { xM: middle, side: 'right' })
    if (Math.abs(middleValue) <= valueTolerance) return middle
    if (Math.sign(leftValue) === Math.sign(middleValue)) {
      left = middle
      leftValue = middleValue
    } else {
      right = middle
      rightValue = middleValue
    }
  }
  return (left + right) / 2
}

function rootsInsideSegment(
  solution: BeamSolution,
  field: BeamFieldKey,
  startM: number,
  endM: number,
): number[] {
  const tolerance = positionTolerance(solution.model.lengthM)
  if (endM - startM <= tolerance) return []

  const derivativeField = DERIVATIVE_FIELD[field]
  const criticalPoints = derivativeField
    ? rootsInsideSegment(solution, derivativeField, startM, endM)
    : []
  const partitions = uniqueSorted([startM, ...criticalPoints, endM], tolerance)
  const roots: number[] = []

  for (let index = 0; index < partitions.length - 1; index += 1) {
    const left = partitions[index]
    const right = partitions[index + 1]
    if (left === undefined || right === undefined) continue
    const leftPoint = pointAtIntervalPosition(left, startM, endM, tolerance)
    const rightPoint = pointAtIntervalPosition(right, startM, endM, tolerance)
    const leftValue = fieldValue(solution, field, leftPoint)
    const rightValue = fieldValue(solution, field, rightPoint)
    const valueTolerance = zeroTolerance([leftValue, rightValue])
    const leftIsZero = Math.abs(leftValue) <= valueTolerance
    const rightIsZero = Math.abs(rightValue) <= valueTolerance

    if (leftIsZero) roots.push(left)
    if (rightIsZero) roots.push(right)
    if (!leftIsZero && !rightIsZero && Math.sign(leftValue) !== Math.sign(rightValue)) {
      roots.push(bisectSignChange(solution, field, left, right, startM, endM))
    }
  }

  return uniqueSorted(roots, tolerance).filter(
    (root) => root > startM + tolerance && root < endM - tolerance,
  )
}

function analyticSegments(solution: BeamSolution): Array<readonly [number, number]> {
  const tolerance = positionTolerance(solution.model.lengthM)
  const boundaries = uniqueSorted(
    [
      0,
      ...solution.discontinuitiesM.filter(
        (xM) => xM > tolerance && xM < solution.model.lengthM - tolerance,
      ),
      solution.model.lengthM,
    ],
    tolerance,
  )
  return boundaries.slice(0, -1).map((startM, index) => [startM, boundaries[index + 1]!])
}

function stationaryPoints(solution: BeamSolution, field: BeamFieldKey): LocatedPoint[] {
  const derivativeField = DERIVATIVE_FIELD[field]
  if (!derivativeField) return []
  const roots = analyticSegments(solution).flatMap(([startM, endM]) =>
    rootsInsideSegment(solution, derivativeField, startM, endM),
  )
  return uniqueSorted(roots, positionTolerance(solution.model.lengthM)).map((xM) => ({
    xM,
    side: 'right',
  }))
}

function candidateKey(point: LocatedPoint): string {
  return `${point.xM.toPrecision(16)}:${point.side}`
}

function collectCandidates(solution: BeamSolution, field: BeamFieldKey): BeamExtremumCandidate[] {
  const map = new Map<string, BeamExtremumCandidate>()
  const add = (point: LocatedPoint, reason: BeamCandidateReason): void => {
    const key = candidateKey(point)
    const current = map.get(key)
    if (current) {
      if (!current.reasons.includes(reason)) current.reasons.push(reason)
      return
    }
    map.set(key, {
      ...point,
      value: fieldValue(solution, field, point),
      reasons: [reason],
    })
  }

  add({ xM: 0, side: 'right' }, 'endpoint')
  add({ xM: solution.model.lengthM, side: 'left' }, 'endpoint')
  for (const xM of solution.discontinuitiesM) {
    if (xM <= 0 || xM >= solution.model.lengthM) continue
    add({ xM, side: 'left' }, 'discontinuity')
    add({ xM, side: 'right' }, 'discontinuity')
  }
  for (const point of stationaryPoints(solution, field)) add(point, 'stationary')

  return [...map.values()].sort(
    (a, b) => a.xM - b.xM || (a.side === b.side ? 0 : a.side === 'left' ? -1 : 1),
  )
}

export function findBeamFieldExtrema(
  solution: BeamSolution,
  field: BeamFieldKey,
): BeamFieldExtrema {
  const candidates = collectCandidates(solution, field)
  if (candidates.length === 0) throw new Error('梁极值候选不能为空')
  let minimum = candidates[0]!
  let maximum = candidates[0]!
  for (const candidate of candidates.slice(1)) {
    if (candidate.value < minimum.value) minimum = candidate
    if (candidate.value > maximum.value) maximum = candidate
  }
  return { field, candidates, minimum, maximum }
}

export function findBeamExtrema(solution: BeamSolution): BeamExtrema {
  return {
    shearN: findBeamFieldExtrema(solution, 'shearN'),
    momentNm: findBeamFieldExtrema(solution, 'momentNm'),
    rotationRad: findBeamFieldExtrema(solution, 'rotationRad'),
    deflectionM: findBeamFieldExtrema(solution, 'deflectionM'),
  }
}
