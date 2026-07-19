import { BEAM_LOCAL_DOF_COUNT, type BeamMatrix6, type BeamVector6 } from './element'

const ZERO_LOAD: BeamVector6 = [0, 0, 0, 0, 0, 0]

function requireFiniteVector(name: string, vector: BeamVector6): void {
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`${name} must contain only finite values`)
  }
}

/** Recover FE local resisting vector k*d-f in local beam DOF order. */
export function recoverBeamResistingVector(
  stiffness: BeamMatrix6,
  localDisplacements: BeamVector6,
  consistentLoad: BeamVector6 = ZERO_LOAD,
): BeamVector6 {
  requireFiniteVector('localDisplacements', localDisplacements)
  requireFiniteVector('consistentLoad', consistentLoad)
  if (stiffness.some((row) => row.length !== BEAM_LOCAL_DOF_COUNT || row.some((value) => !Number.isFinite(value)))) {
    throw new RangeError('stiffness must be a finite 6x6 matrix')
  }

  return stiffness.map((row, rowIndex) =>
    row.reduce((sum, coefficient, columnIndex) => sum + coefficient * localDisplacements[columnIndex]!, 0)
      - consistentLoad[rowIndex]!,
  ) as unknown as BeamVector6
}

/** Recover actions exerted by the element on its end nodes: f-k*d. */
export function recoverBeamElementOnNodeEndForces(
  stiffness: BeamMatrix6,
  localDisplacements: BeamVector6,
  consistentLoad: BeamVector6 = ZERO_LOAD,
): BeamVector6 {
  return recoverBeamResistingVector(stiffness, localDisplacements, consistentLoad).map(
    (value) => (value === 0 ? 0 : -value),
  ) as unknown as BeamVector6
}
