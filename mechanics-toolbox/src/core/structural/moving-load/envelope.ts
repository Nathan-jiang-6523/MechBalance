import type { MovingLoadRequest, StructuralIssue } from '../contracts'
import { influenceBreakpoints, type InfluencePointSide } from '../influence'
import {
  evaluateMovingLoadResponseAt,
  evaluateMovingLoadResponseDerivativeAt,
  movingAxleOffsets,
  type MovingLoadResponseAtPosition,
} from './scan'
import { validateMovingLoadRequest } from './validation'

export type MovingResponseUnit = 'N' | 'N*m' | 'm'

export interface MovingLoadControl extends MovingLoadResponseAtPosition {
  readonly kind: 'maximum' | 'minimum'
  readonly controllingAxleId?: string
}

export interface MovingLoadEnvelope {
  readonly responseUnit: MovingResponseUnit
  readonly maximum: MovingLoadControl
  readonly minimum: MovingLoadControl
  readonly evaluatedCandidateCount: number
}

export type MovingLoadEnvelopeResult =
  | Readonly<{ ok: true; value: MovingLoadEnvelope }>
  | Readonly<{ ok: false; issues: readonly StructuralIssue[] }>

interface Candidate {
  readonly frontAxlePosition: number
  readonly side: InfluencePointSide
  readonly controllingAxleId?: string
}

function responseUnit(request: MovingLoadRequest): MovingResponseUnit {
  if (request.response.type === 'section-moment') return 'N*m'
  if (request.response.type === 'displacement') return 'm'
  return 'N'
}

function eventCandidates(request: MovingLoadRequest): Candidate[] {
  const offsets = movingAxleOffsets(request.movingLoad)
  const sign = request.movingLoad.direction === 'left-to-right' ? -1 : 1
  const breakpoints = influenceBreakpoints(request.beam.span, request.response)
  const totalLength = offsets[offsets.length - 1] ?? 0
  const margin = Math.max(1, request.beam.span, totalLength)
  const candidates: Candidate[] = [
    { frontAxlePosition: -totalLength - margin, side: 'at' },
    { frontAxlePosition: request.beam.span + totalLength + margin, side: 'at' },
  ]
  for (const [axleIndex, axle] of request.movingLoad.axles.entries()) {
    for (const breakpoint of breakpoints) {
      const frontAxlePosition = breakpoint - sign * offsets[axleIndex]!
      if (request.response.type === 'section-shear' && breakpoint === request.response.position) {
        candidates.push(
          { frontAxlePosition, side: 'left', controllingAxleId: axle.id },
          { frontAxlePosition, side: 'right', controllingAxleId: axle.id },
        )
      } else {
        candidates.push({ frontAxlePosition, side: 'at', controllingAxleId: axle.id })
      }
    }
  }
  return candidates
}

function quadraticRootsFromInteriorDerivative(
  request: MovingLoadRequest,
  start: number,
  end: number,
): readonly number[] {
  if (request.response.type !== 'displacement' || end <= start) return []
  const width = end - start
  const y1 = evaluateMovingLoadResponseDerivativeAt(request, start + width * 0.25)
  const y2 = evaluateMovingLoadResponseDerivativeAt(request, start + width * 0.5)
  const y3 = evaluateMovingLoadResponseDerivativeAt(request, start + width * 0.75)
  const a = 8 * (y3 - 2 * y2 + y1)
  const b = 2 * (y3 - y1) - a
  const c = y2 - a * 0.25 - b * 0.5
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c))
  if (scale === 0) return []
  const tolerance = scale * 1e-12
  const normalizedRoots: number[] = []
  if (Math.abs(a) <= tolerance) {
    if (Math.abs(b) > tolerance) normalizedRoots.push(-c / b)
  } else {
    const discriminant = b * b - 4 * a * c
    if (discriminant >= -tolerance) {
      const root = Math.sqrt(Math.max(0, discriminant))
      normalizedRoots.push((-b - root) / (2 * a), (-b + root) / (2 * a))
    }
  }
  return normalizedRoots
    .filter((value) => value > 0 && value < 1)
    .map((value) => start + width * value)
}

function allCandidates(request: MovingLoadRequest): readonly Candidate[] {
  const events = eventCandidates(request)
  const eventPositions = [...new Set(events.map(({ frontAxlePosition }) => frontAxlePosition))]
    .sort((left, right) => left - right)
  const stationary = eventPositions.slice(1).flatMap((end, index) =>
    quadraticRootsFromInteriorDerivative(request, eventPositions[index]!, end)
      .map((frontAxlePosition): Candidate => ({ frontAxlePosition, side: 'continuous' })))
  return [...events, ...stationary]
}

function control(
  kind: MovingLoadControl['kind'],
  candidate: Candidate,
  evaluated: MovingLoadResponseAtPosition,
): MovingLoadControl {
  return candidate.controllingAxleId === undefined
    ? { kind, ...evaluated }
    : { kind, ...evaluated, controllingAxleId: candidate.controllingAxleId }
}

export function solveMovingLoadEnvelope(request: MovingLoadRequest): MovingLoadEnvelopeResult {
  const issues = validateMovingLoadRequest(request)
  if (issues.length > 0) return { ok: false, issues }
  const candidates = allCandidates(request)
  const evaluated = candidates.map((candidate) => ({
    candidate,
    response: evaluateMovingLoadResponseAt(request, candidate.frontAxlePosition, candidate.side),
  }))
  const maximum = evaluated.reduce((best, item) =>
    item.response.value > best.response.value ? item : best)
  const minimum = evaluated.reduce((best, item) =>
    item.response.value < best.response.value ? item : best)
  return {
    ok: true,
    value: {
      responseUnit: responseUnit(request),
      maximum: control('maximum', maximum.candidate, maximum.response),
      minimum: control('minimum', minimum.candidate, minimum.response),
      evaluatedCandidateCount: evaluated.length,
    },
  }
}
