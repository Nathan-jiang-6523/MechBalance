export type BeamSupport = 'simplySupported' | 'cantileverLeft' | 'cantileverRight'

export interface PointForceLoad {
  type: 'pointForce'
  positionM: number
  /** Global +y is positive. */
  forceN: number
}

export interface PointMomentLoad {
  type: 'pointMoment'
  positionM: number
  /** Counter-clockwise is positive. */
  momentNm: number
}

export interface UniformLoad {
  type: 'uniformLoad'
  startM: number
  endM: number
  /** Global +y is positive. */
  intensityNPerM: number
}

export type BeamLoad = PointForceLoad | PointMomentLoad | UniformLoad
export type DiscontinuitySide = 'left' | 'right'

export interface BeamModel {
  lengthM: number
  elasticModulusPa: number
  secondMomentM4: number
  support: BeamSupport
  loads: BeamLoad[]
}

export interface BeamFieldValue {
  xM: number
  side: DiscontinuitySide
  shearN: number
  momentNm: number
  rotationRad: number
  deflectionM: number
}

export interface BeamReactions {
  leftForceN: number
  rightForceN: number
  leftMomentNm: number
  rightMomentNm: number
}

export interface BeamBalanceResidual {
  forceN: number
  momentAboutLeftNm: number
}

export interface BeamValidationError {
  field: string
  message: string
}

export interface BeamSolution {
  model: BeamModel
  reactions: BeamReactions
  balanceResidual: BeamBalanceResidual
  discontinuitiesM: number[]
  evaluate: (xM: number, side?: DiscontinuitySide) => BeamFieldValue
}

export type BeamFieldKey = 'shearN' | 'momentNm' | 'rotationRad' | 'deflectionM'
export type BeamCandidateReason = 'endpoint' | 'discontinuity' | 'stationary'

export interface BeamExtremumCandidate {
  xM: number
  side: DiscontinuitySide
  value: number
  reasons: BeamCandidateReason[]
}

export interface BeamFieldExtrema {
  field: BeamFieldKey
  candidates: BeamExtremumCandidate[]
  minimum: BeamExtremumCandidate
  maximum: BeamExtremumCandidate
}

export type BeamExtrema = Readonly<Record<BeamFieldKey, BeamFieldExtrema>>

export type BeamSampleReason = 'base' | 'discontinuity' | 'extremum' | 'adaptive'

export interface BeamSamplePoint extends BeamFieldValue {
  reasons: BeamSampleReason[]
}

export interface BeamSamplingOptions {
  basePointCount?: number
  relativeTolerance?: number
  maxRefinementDepth?: number
}

export type BeamSolveResult =
  | { ok: true; value: BeamSolution }
  | { ok: false; errors: BeamValidationError[] }
