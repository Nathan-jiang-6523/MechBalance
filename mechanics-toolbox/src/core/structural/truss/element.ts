import type { Matrix } from '../math'

export type TrussVector4 = readonly [number, number, number, number]
export type TrussMatrix4 = readonly [
  TrussVector4,
  TrussVector4,
  TrussVector4,
  TrussVector4,
]

export interface TrussElementGeometry {
  readonly length: number
  readonly cosine: number
  readonly sine: number
}

export function trussElementGeometry(
  nodeI: Readonly<{ x: number; y: number }>,
  nodeJ: Readonly<{ x: number; y: number }>,
): TrussElementGeometry {
  const dx = nodeJ.x - nodeI.x
  const dy = nodeJ.y - nodeI.y
  const length = Math.hypot(dx, dy)
  if (![nodeI.x, nodeI.y, nodeJ.x, nodeJ.y, length].every(Number.isFinite)) {
    throw new RangeError('桁架单元坐标必须为有限数')
  }
  if (length <= 0) throw new RangeError('桁架单元长度必须大于零')
  return { length, cosine: dx / length, sine: dy / length }
}

export function trussGlobalStiffness(
  E: number,
  A: number,
  geometry: TrussElementGeometry,
): TrussMatrix4 {
  if (![E, A, geometry.length, geometry.cosine, geometry.sine].every(Number.isFinite)) {
    throw new RangeError('桁架单元刚度参数必须为有限数')
  }
  if (E <= 0 || A <= 0 || geometry.length <= 0) {
    throw new RangeError('桁架单元 E、A、L 必须大于零')
  }
  const factor = E * A / geometry.length
  const c = geometry.cosine
  const s = geometry.sine
  const cc = c * c * factor
  const cs = c * s * factor
  const ss = s * s * factor
  return [
    [cc, cs, -cc, -cs],
    [cs, ss, -cs, -ss],
    [-cc, -cs, cc, cs],
    [-cs, -ss, cs, ss],
  ]
}

export function trussAxialExtension(
  displacements: TrussVector4,
  geometry: Pick<TrussElementGeometry, 'cosine' | 'sine'>,
): number {
  const { cosine: c, sine: s } = geometry
  const values = [...displacements, c, s]
  if (!values.every(Number.isFinite)) throw new RangeError('桁架单元位移必须为有限数')
  return -c * displacements[0] - s * displacements[1]
    + c * displacements[2] + s * displacements[3]
}

export function asTrussMatrix4(matrix: Matrix): TrussMatrix4 {
  if (matrix.length !== 4 || matrix.some((row) => row.length !== 4)) {
    throw new RangeError('桁架单元矩阵必须为 4x4')
  }
  return matrix as TrussMatrix4
}
