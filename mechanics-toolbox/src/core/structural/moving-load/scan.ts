import type { MovingAxleGroup, MovingLoadRequest } from '../contracts'
import {
  evaluateInfluenceDerivative,
  evaluateInfluenceOrdinate,
  type InfluencePointSide,
} from '../influence'
import { validateMovingLoadRequest } from './validation'

export interface PositionedAxle {
  readonly axleId: string
  readonly nominalLoad: number
  readonly effectiveLoad: number
  readonly position: number
  readonly onBridge: boolean
}

export interface MovingLoadResponseAtPosition {
  readonly frontAxlePosition: number
  readonly value: number
  readonly side: InfluencePointSide
  readonly axlePositions: readonly PositionedAxle[]
}

export function movingAxleOffsets(group: MovingAxleGroup): readonly number[] {
  const offsets = [0]
  for (const spacing of group.adjacentSpacings) offsets.push(offsets[offsets.length - 1]! + spacing)
  return offsets
}

export function positionMovingAxles(
  group: MovingAxleGroup,
  frontAxlePosition: number,
  span: number,
): readonly PositionedAxle[] {
  if (!Number.isFinite(frontAxlePosition)) throw new RangeError('frontAxlePosition 必须为有限数')
  if (!Number.isFinite(span) || span <= 0) throw new RangeError('span 必须为有限正数')
  if (group.axles.length === 0) throw new RangeError('axles 不能为空')
  if (group.adjacentSpacings.length !== group.axles.length - 1) {
    throw new RangeError('相邻轴距数量必须等于车轴数减一')
  }
  if (group.axles.some(({ load }) => !Number.isFinite(load) || load <= 0)) {
    throw new RangeError('轴载必须为有限正数')
  }
  if (group.adjacentSpacings.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('轴距必须为有限非负数')
  }
  if (!Number.isFinite(group.dynamicFactor) || group.dynamicFactor <= 0) {
    throw new RangeError('dynamicFactor 必须为有限正数')
  }
  if (group.direction !== 'left-to-right' && group.direction !== 'right-to-left') {
    throw new RangeError('行进方向无效')
  }
  const directionSign = group.direction === 'left-to-right' ? -1 : 1
  const offsets = movingAxleOffsets(group)
  return group.axles.map((axle, index) => {
    const position = frontAxlePosition + directionSign * offsets[index]!
    return {
      axleId: axle.id,
      nominalLoad: axle.load,
      effectiveLoad: axle.load * group.dynamicFactor,
      position: position === 0 ? 0 : position,
      onBridge: position >= 0 && position <= span,
    }
  })
}

function requireValid(request: MovingLoadRequest): void {
  const issues = validateMovingLoadRequest(request)
  if (issues.length > 0) throw new RangeError(issues[0]!.message)
}

export function evaluateMovingLoadResponseAt(
  request: MovingLoadRequest,
  frontAxlePosition: number,
  side: InfluencePointSide = 'at',
): MovingLoadResponseAtPosition {
  requireValid(request)
  const axlePositions = positionMovingAxles(request.movingLoad, frontAxlePosition, request.beam.span)
  const value = axlePositions.reduce((sum, axle) => sum + (axle.onBridge
    ? axle.effectiveLoad * evaluateInfluenceOrdinate(
      request.beam.span,
      request.response,
      axle.position,
      side,
    )
    : 0), 0)
  return { frontAxlePosition, value: value === 0 ? 0 : value, side, axlePositions }
}

export function evaluateMovingLoadResponseDerivativeAt(
  request: MovingLoadRequest,
  frontAxlePosition: number,
): number {
  requireValid(request)
  return positionMovingAxles(request.movingLoad, frontAxlePosition, request.beam.span)
    .reduce((sum, axle) => sum + (axle.onBridge
      ? axle.effectiveLoad * evaluateInfluenceDerivative(
        request.beam.span,
        request.response,
        axle.position,
      )
      : 0), 0)
}
