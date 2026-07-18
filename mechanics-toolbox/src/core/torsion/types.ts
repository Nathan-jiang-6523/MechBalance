export type CircularShaftKind = 'solid' | 'tube'

interface CircularShaftBaseInput {
  readonly lengthM: number
  readonly shearModulusPa: number
  /** Signed torque. Positive follows the right-hand-rule convention. */
  readonly torqueNm: number
}

export interface SolidCircularShaftInput extends CircularShaftBaseInput {
  readonly kind: 'solid'
  readonly diameterM: number
}

export interface CircularTubeShaftInput extends CircularShaftBaseInput {
  readonly kind: 'tube'
  readonly outerDiameterM: number
  readonly innerDiameterM: number
}

export type CircularShaftInput = SolidCircularShaftInput | CircularTubeShaftInput

export interface CircularShaftTorsionResult {
  readonly kind: CircularShaftKind
  readonly torsionConstantM4: number
  readonly outerRadiusM: number
  /** Signed maximum shear stress at the outer surface. */
  readonly maximumShearStressPa: number
  readonly maximumAbsoluteShearStressPa: number
  /** Signed twist angle; same sign as torque for positive G and J. */
  readonly twistAngleRad: number
}

export type PowerSolveMode = 'power' | 'torque' | 'speed'

export interface PowerTransmissionInput {
  readonly solveFor: PowerSolveMode
  /** Power, present unless solveFor is power. */
  readonly powerW?: number
  /** Signed torque, present unless solveFor is torque. */
  readonly torqueNm?: number
  /** Non-negative revolutions per second, present unless solveFor is speed. */
  readonly rotationalSpeedRps?: number
}

export interface PowerTransmissionResult {
  readonly solvedFor: PowerSolveMode
  readonly powerW: number
  readonly torqueNm: number
  readonly rotationalSpeedRps: number
  readonly angularSpeedRadPerS: number
}

export type TorsionErrorCode =
  | 'NON_FINITE_INPUT'
  | 'NON_POSITIVE_DIAMETER'
  | 'INVALID_TUBE_GEOMETRY'
  | 'NON_POSITIVE_LENGTH'
  | 'NON_POSITIVE_SHEAR_MODULUS'
  | 'MISSING_KNOWN_VALUE'
  | 'NEGATIVE_SPEED'
  | 'ZERO_SPEED_DIVISOR'
  | 'ZERO_TORQUE_DIVISOR'
  | 'NEGATIVE_SOLVED_SPEED'

export class TorsionCalculationError extends Error {
  constructor(
    readonly code: TorsionErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'TorsionCalculationError'
  }
}
