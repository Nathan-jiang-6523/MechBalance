import type { FrameVector6 } from './element'

export interface FrameLoadInterval {
  /** Loaded interval start in local x, m. */
  readonly a: number
  /** Loaded interval end in local x, m. */
  readonly b: number
}

export type FrameDistributedLoadComponents =
  | Readonly<{ qX: number; qY?: number }>
  | Readonly<{ qX?: number; qY: number }>

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value
}

/** Consistent local nodal load for constant local qX/qY over [a,b]. */
export function frameDistributedLoadVector(
  components: FrameDistributedLoadComponents,
  L: number,
  interval: FrameLoadInterval = { a: 0, b: L },
): FrameVector6 {
  requireFinite('L', L)
  requireFinite('interval.a', interval.a)
  requireFinite('interval.b', interval.b)
  if (L <= 0) throw new RangeError('L must be positive')
  if (interval.a < 0 || interval.b > L || interval.a >= interval.b) {
    throw new RangeError('load interval must satisfy 0 <= a < b <= L')
  }

  const hasQX = components.qX !== undefined
  const hasQY = components.qY !== undefined
  if (!hasQX && !hasQY) throw new RangeError('distributed load requires qX or qY')
  if (components.qX !== undefined) requireFinite('qX', components.qX)
  if (components.qY !== undefined) requireFinite('qY', components.qY)
  const qX = components.qX ?? 0
  const qY = components.qY ?? 0

  const start = interval.a / L
  const end = interval.b / L
  const difference = (primitive: (xi: number) => number): number => primitive(end) - primitive(start)

  const axialForceI = qX * L * difference((xi) => xi - xi ** 2 / 2)
  const axialForceJ = qX * L * difference((xi) => xi ** 2 / 2)

  const forceI = qY * L * difference((xi) => xi - xi ** 3 + xi ** 4 / 2)
  const momentI = qY * L * L * difference(
    (xi) => xi ** 2 / 2 - 2 * xi ** 3 / 3 + xi ** 4 / 4,
  )
  const forceJ = qY * L * difference((xi) => xi ** 3 - xi ** 4 / 2)
  const momentJ = qY * L * L * difference((xi) => -(xi ** 3) / 3 + xi ** 4 / 4)

  return [
    cleanZero(axialForceI), cleanZero(forceI), cleanZero(momentI),
    cleanZero(axialForceJ), cleanZero(forceJ), cleanZero(momentJ),
  ]
}

/** Backward-compatible transverse-only qY API. */
export function frameUniformLoadVector(
  qY: number,
  L: number,
  interval: FrameLoadInterval = { a: 0, b: L },
): FrameVector6 {
  return frameDistributedLoadVector({ qY }, L, interval)
}
