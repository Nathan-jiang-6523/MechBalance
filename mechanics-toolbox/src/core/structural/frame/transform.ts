import type { FrameMatrix6, FrameVector6 } from './element'

export interface FrameGeometry {
  readonly length: number
  readonly cosine: number
  readonly sine: number
}

function requireFinite(values: readonly number[], label: string): void {
  if (!values.every(Number.isFinite)) throw new RangeError(`${label} must be finite`)
}

export function frameGeometry(
  nodeI: Readonly<{ x: number; y: number }>,
  nodeJ: Readonly<{ x: number; y: number }>,
): FrameGeometry {
  requireFinite([nodeI.x, nodeI.y, nodeJ.x, nodeJ.y], 'frame coordinates')
  const dx = nodeJ.x - nodeI.x
  const dy = nodeJ.y - nodeI.y
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length <= 0) {
    throw new RangeError('frame element length must be positive')
  }
  return { length, cosine: dx / length, sine: dy / length }
}

/** Global displacement to local displacement transform: d_local = T d_global. */
export function frameTransformationMatrix(cosine: number, sine: number): FrameMatrix6 {
  requireFinite([cosine, sine], 'frame direction cosines')
  if (Math.abs(cosine * cosine + sine * sine - 1) > 1e-12) {
    throw new RangeError('frame direction cosines must have unit norm')
  }
  return [
    [cosine, sine, 0, 0, 0, 0],
    [-sine, cosine, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, cosine, sine, 0],
    [0, 0, 0, -sine, cosine, 0],
    [0, 0, 0, 0, 0, 1],
  ]
}

function matrixVector(matrix: FrameMatrix6, vector: FrameVector6): FrameVector6 {
  requireFinite(vector, 'frame vector')
  const output = matrix.map((row) => row.reduce(
    (sum, coefficient, column) => sum + coefficient * vector[column]!,
    0,
  ))
  return output as unknown as FrameVector6
}

/** Convert a global displacement vector to local coordinates. */
export function globalToLocalVector(
  globalVector: FrameVector6,
  transformation: FrameMatrix6,
): FrameVector6 {
  return matrixVector(transformation, globalVector)
}

/** Convert a local force vector to global coordinates: f_global = T^T f_local. */
export function localToGlobalVector(
  localVector: FrameVector6,
  transformation: FrameMatrix6,
): FrameVector6 {
  requireFinite(localVector, 'frame vector')
  const output = Array.from({ length: 6 }, (_, row) => transformation.reduce(
    (sum, transformRow, column) => sum + transformRow[row]! * localVector[column]!,
    0,
  ))
  return output as unknown as FrameVector6
}

/** Transform local stiffness into global coordinates: K = T^T k T. */
export function frameGlobalStiffness(
  localStiffness: FrameMatrix6,
  transformation: FrameMatrix6,
): FrameMatrix6 {
  const output = Array.from({ length: 6 }, (_, row) => Array.from(
    { length: 6 },
    (_, column) => {
      let value = 0
      for (let localRow = 0; localRow < 6; localRow += 1) {
        for (let localColumn = 0; localColumn < 6; localColumn += 1) {
          value += transformation[localRow]![row]!
            * localStiffness[localRow]![localColumn]!
            * transformation[localColumn]![column]!
        }
      }
      return value
    },
  ))
  requireFinite(output.flat(), 'global frame stiffness')
  return output as unknown as FrameMatrix6
}

export const frameTransformation = frameTransformationMatrix
export const frameLocalToGlobalVector = localToGlobalVector
export const frameGlobalToLocalVector = globalToLocalVector
export const localToGlobalStiffness = frameGlobalStiffness
