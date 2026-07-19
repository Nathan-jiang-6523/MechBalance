/** Local frame DOF order: [u_i, v_i, theta_i, u_j, v_j, theta_j]. */
export const FRAME_LOCAL_DOF_COUNT = 6 as const

export type FrameVector6 = readonly [number, number, number, number, number, number]
export type FrameMatrix6 = readonly [
  FrameVector6,
  FrameVector6,
  FrameVector6,
  FrameVector6,
  FrameVector6,
  FrameVector6,
]

export interface FrameLocalStiffnessInput {
  /** Young's modulus, Pa. */
  readonly E: number
  /** Cross-sectional area, m^2. */
  readonly A: number
  /** Second moment of area about local z, m^4. */
  readonly I: number
  /** Element length, m. */
  readonly L: number
}

function requirePositiveFinite(name: keyof FrameLocalStiffnessInput, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`)
  }
}

/** Euler-Bernoulli 2D frame local stiffness, including axial deformation. */
export function frameLocalStiffness({ E, A, I, L }: FrameLocalStiffnessInput): FrameMatrix6 {
  requirePositiveFinite('E', E)
  requirePositiveFinite('A', A)
  requirePositiveFinite('I', I)
  requirePositiveFinite('L', L)

  const axial = E * A / L
  const flexural = E * I / (L * L * L)
  const k12 = 12 * flexural
  const k6L = 6 * L * flexural
  const k4L2 = 4 * L * L * flexural
  const k2L2 = 2 * L * L * flexural

  return [
    [axial, 0, 0, -axial, 0, 0],
    [0, k12, k6L, 0, -k12, k6L],
    [0, k6L, k4L2, 0, -k6L, k2L2],
    [-axial, 0, 0, axial, 0, 0],
    [0, -k12, -k6L, 0, k12, -k6L],
    [0, k6L, k2L2, 0, -k6L, k4L2],
  ]
}
