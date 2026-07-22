import type { BeamVector6 } from './element'

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
}

/**
 * Consistent local nodal load for a full-span constant qY.
 * Positive qY follows local +y; result order is [Fx_i, Fy_i, Mz_i, Fx_j, Fy_j, Mz_j].
 */
export function beamUniformLoadVector(qY: number, L: number): BeamVector6 {
  requireFinite('qY', qY)
  requireFinite('L', L)
  if (L <= 0) throw new RangeError('L must be positive')

  const shear = (qY * L) / 2
  const moment = (qY * L * L) / 12
  return [0, shear, moment, 0, shear, -moment]
}
