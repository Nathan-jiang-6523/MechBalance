import type { PointSide, ScreenResult } from '../../contracts'
import type { ElementId, NodeId } from './model'

export type StructuralResultUnit = 'm' | 'm/N' | 'rad' | 'N' | 'N*m' | 'Pa' | 'kg' | '1'

export interface StructuralQuantity<Unit extends StructuralResultUnit = StructuralResultUnit> {
  readonly value: number
  readonly unit: Unit
  /** 明确该标量正值的物理方向或正负含义。 */
  readonly positive: string
}

export class StructuralResultValueError extends RangeError {
  readonly code = 'P2_NONFINITE_INPUT'

  constructor(readonly field: string, message: string) {
    super(message)
    this.name = 'StructuralResultValueError'
  }
}

export function createStructuralQuantity<Unit extends StructuralResultUnit>(
  value: number,
  unit: Unit,
  positive: string,
  field = 'result.value',
): StructuralQuantity<Unit> {
  if (!Number.isFinite(value)) {
    throw new StructuralResultValueError(field, `${field} 必须为有限数值`)
  }
  if (positive.trim() === '') {
    throw new StructuralResultValueError(field, `${field} 必须说明正值含义`)
  }
  return { value: Object.is(value, -0) ? 0 : value, unit, positive }
}

export function isFiniteStructuralQuantity(value: unknown): value is StructuralQuantity {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return Number.isFinite(candidate.value)
    && typeof candidate.unit === 'string'
    && typeof candidate.positive === 'string'
    && candidate.positive.trim() !== ''
}

export interface NodeDisplacementResult {
  readonly nodeId: NodeId
  readonly u: StructuralQuantity<'m'>
  readonly v: StructuralQuantity<'m'>
  readonly theta?: StructuralQuantity<'rad'>
}

export interface NodeReactionResult {
  readonly nodeId: NodeId
  readonly fx: StructuralQuantity<'N'>
  readonly fy: StructuralQuantity<'N'>
  readonly mz?: StructuralQuantity<'N*m'>
}

export interface EndForceComponents {
  readonly fx: StructuralQuantity<'N'>
  readonly fy: StructuralQuantity<'N'>
  readonly mz: StructuralQuantity<'N*m'>
}

/** 单元作用于节点的端力，而非其相反量。 */
export interface ElementEndForceResult {
  readonly elementId: ElementId
  readonly coordinateSystem: 'local' | 'global'
  readonly nodeI: EndForceComponents
  readonly nodeJ: EndForceComponents
}

export interface ElementStationResult {
  readonly elementId: ElementId
  readonly x: StructuralQuantity<'m'>
  readonly side: PointSide
  readonly axialForce: StructuralQuantity<'N'>
  readonly shearForce: StructuralQuantity<'N'>
  readonly bendingMoment: StructuralQuantity<'N*m'>
  readonly displacement?: StructuralQuantity<'m'>
  readonly rotation?: StructuralQuantity<'rad'>
  readonly fiberStresses?: readonly Readonly<{
    y: StructuralQuantity<'m'>
    stress: StructuralQuantity<'Pa'>
  }>[]
}

export interface TrussElementResult {
  readonly elementId: ElementId
  readonly axialForce: StructuralQuantity<'N'>
  readonly stress: StructuralQuantity<'Pa'>
  readonly state: 'tension' | 'compression' | 'zero'
}

export interface ControlPositionResult {
  readonly responseId: string
  readonly kind: 'maximum' | 'minimum'
  readonly value: StructuralQuantity
  readonly position: StructuralQuantity<'m'>
  readonly side?: PointSide
  readonly controllingObjectId?: string
  readonly controllingAxleId?: string
}

interface StructuralResultDataBase {
  readonly displacements: readonly NodeDisplacementResult[]
  readonly reactions: readonly NodeReactionResult[]
  readonly controls: readonly ControlPositionResult[]
}

export interface BeamResultData extends StructuralResultDataBase {
  readonly analysis: 'beam'
  readonly endForces: readonly ElementEndForceResult[]
  readonly stations: readonly ElementStationResult[]
}

export interface TrussResultData extends StructuralResultDataBase {
  readonly analysis: 'truss'
  readonly elements: readonly TrussElementResult[]
}

export interface FrameResultData extends StructuralResultDataBase {
  readonly analysis: 'frame'
  readonly endForces: readonly ElementEndForceResult[]
  readonly stations: readonly ElementStationResult[]
}

export interface InfluenceLineOrdinateResult {
  readonly position: StructuralQuantity<'m'>
  readonly ordinate: StructuralQuantity<'1' | 'm' | 'm/N'>
  readonly side: PointSide
}

export interface InfluenceLineResultData {
  readonly analysis: 'influence-line'
  readonly responseId: string
  readonly ordinates: readonly InfluenceLineOrdinateResult[]
  readonly controls: readonly ControlPositionResult[]
}

export interface MovingLoadResultData {
  readonly analysis: 'moving-load'
  readonly responseId: string
  readonly controls: readonly ControlPositionResult[]
  readonly axlePositions: readonly Readonly<{
    axleId: string
    position: StructuralQuantity<'m'>
  }>[]
}

export type StructuralResultData =
  | BeamResultData
  | TrussResultData
  | FrameResultData
  | InfluenceLineResultData
  | MovingLoadResultData

export function hasSafeStructuralQuantities(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(hasSafeStructuralQuantities)
  if (typeof value !== 'object' || value === null) return true

  const candidate = value as Record<string, unknown>
  if ('value' in candidate || 'unit' in candidate || 'positive' in candidate) {
    return isFiniteStructuralQuantity(candidate)
  }
  return Object.values(candidate).every(hasSafeStructuralQuantities)
}

type StructuralSuccessScreenResult = Omit<ScreenResult, 'status'> & Readonly<{
  status: 'success' | 'warning'
  readonly structural: StructuralResultData
}>

type StructuralErrorScreenResult = Omit<
  ScreenResult,
  'status' | 'groups' | 'charts' | 'balanceChecks'
> & Readonly<{
  status: 'error'
  groups: readonly []
  charts: readonly []
  balanceChecks: readonly []
  structural?: never
}>

/** 错误状态禁止携带结构成功数值；成功/警告状态必须通过有限数值守卫。 */
export type StructuralScreenResult = StructuralSuccessScreenResult | StructuralErrorScreenResult

export function isSafeStructuralScreenResult(result: StructuralScreenResult): boolean {
  if (result.status === 'error') {
    return !('structural' in result)
      && result.groups.length === 0
      && result.charts.length === 0
      && result.balanceChecks.length === 0
  }
  return hasSafeStructuralQuantities(result.structural)
}
