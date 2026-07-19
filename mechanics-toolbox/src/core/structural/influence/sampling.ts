import type { InfluenceLineRequest } from '../contracts'
import {
  evaluateInfluenceOrdinate,
  influenceOrdinateUnit,
  influenceResponseId,
  validateInfluenceDefinition,
  type InfluenceOrdinateUnit,
  type InfluencePointSide,
} from './response'

export interface InfluenceLinePoint {
  readonly position: number
  readonly ordinate: number
  readonly side: InfluencePointSide
}

export interface InfluenceLineSeries {
  readonly responseId: string
  readonly ordinateUnit: InfluenceOrdinateUnit
  readonly points: readonly InfluenceLinePoint[]
  readonly minimum: InfluenceLinePoint
  readonly maximum: InfluenceLinePoint
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => value === 0 ? 0 : value))].sort((left, right) => left - right)
}

function displacementStationaryPositions(request: InfluenceLineRequest): readonly number[] {
  const { response } = request
  if (response.type !== 'displacement') return []
  const { span } = request.beam
  const leftRoot = Math.sqrt((span ** 2 - (span - response.position) ** 2) / 3)
  const rightRoot = span - Math.sqrt((span ** 2 - response.position ** 2) / 3)
  return [
    ...(leftRoot >= 0 && leftRoot <= response.position ? [leftRoot] : []),
    ...(rightRoot >= response.position && rightRoot <= span ? [rightRoot] : []),
  ]
}

export function generateInfluenceLineSeries(request: InfluenceLineRequest): InfluenceLineSeries {
  const issues = validateInfluenceDefinition(request.beam.span, request.response)
  if (request.beam.topology !== 'simply-supported') throw new RangeError('仅支持简支梁影响线')
  if (issues.length > 0) throw new RangeError(issues[0]!.message)
  if (request.samplePositions.some((value) => !Number.isFinite(value))) {
    throw new RangeError('samplePositions 必须全为有限数')
  }
  const critical = 'position' in request.response ? [request.response.position] : []
  const positions = uniqueSorted([
    ...request.samplePositions,
    0,
    request.beam.span,
    ...critical,
    ...displacementStationaryPositions(request),
  ])
  const points = positions.flatMap((position): InfluenceLinePoint[] => {
    if (request.response.type === 'section-shear' && position === request.response.position) {
      return [
        { position, side: 'left', ordinate: evaluateInfluenceOrdinate(request.beam.span, request.response, position, 'left') },
        { position, side: 'right', ordinate: evaluateInfluenceOrdinate(request.beam.span, request.response, position, 'right') },
      ]
    }
    return [{
      position,
      side: 'continuous',
      ordinate: evaluateInfluenceOrdinate(request.beam.span, request.response, position),
    }]
  })
  return {
    responseId: influenceResponseId(request.response),
    ordinateUnit: influenceOrdinateUnit(request.response),
    points,
    minimum: points.reduce((best, point) => point.ordinate < best.ordinate ? point : best),
    maximum: points.reduce((best, point) => point.ordinate > best.ordinate ? point : best),
  }
}
