import type { FrameVector6 } from './element'

/** Uniform axial free strain from temperature and prescribed initial strain. */
export function frameFreeStrain(
  alpha: number,
  deltaT: number,
  initialStrain = 0,
): number {
  if (![alpha, deltaT, initialStrain].every(Number.isFinite)) {
    throw new RangeError('frame free-strain parameters must be finite')
  }
  return alpha * deltaT + initialStrain
}

/**
 * Equivalent local nodal load for uniform axial free strain.
 * No temperature-gradient bending or initial-curvature terms are included.
 */
export function frameInitialStrainLoadVector(
  E: number,
  A: number,
  freeStrain: number,
): FrameVector6 {
  if (![E, A, freeStrain].every(Number.isFinite)) {
    throw new RangeError('frame initial-strain load parameters must be finite')
  }
  if (E <= 0 || A <= 0) throw new RangeError('frame element E and A must be positive')
  const force = E * A * freeStrain
  return [-force, 0, 0, force, 0, 0]
}
