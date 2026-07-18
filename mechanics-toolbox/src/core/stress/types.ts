export interface PlaneStressInput {
  /** Normal stress on the positive x face. Tension is positive. */
  sigmaXPa: number
  /** Normal stress on the positive y face. Tension is positive. */
  sigmaYPa: number
  /** Positive x face acting toward +y. */
  tauXyPa: number
  /** Optional uniaxial yield/allowable strength used only for utilization. */
  strengthPa?: number
}

export interface StressUtilization {
  vonMises: number
  tresca: number
  controllingCriterion: 'von-mises' | 'tresca' | 'equal'
  controllingUtilization: number
  exceedsStrength: boolean
}

export interface PlaneStressResult {
  sigmaXPa: number
  sigmaYPa: number
  tauXyPa: number
  mohrCenterPa: number
  mohrRadiusPa: number
  sigma1Pa: number
  sigma2Pa: number
  /** Sorted descending and including the plane-stress third principal stress, sigma3 = 0. */
  principalStressesPa: readonly [number, number, number]
  /** Physical CCW angle from x to the sigma1 direction; null when every direction is principal. */
  principalAngleRad: number | null
  /** Physical CCW angle from x to a positive/negative maximum in-plane shear orientation. */
  maxInPlaneShearAngleRad: number | null
  maxInPlaneShearPa: number
  vonMisesPa: number
  trescaPa: number
  maximum3dShearPa: number
  strengthPa: number | null
  utilization: StressUtilization | null
}

export type RoundSectionInput =
  | { kind: 'solid-circle'; diameterM: number }
  | { kind: 'circular-tube'; outerDiameterM: number; innerDiameterM: number }

export interface BendingTorsionInput {
  bendingMomentNm: number
  torqueNm: number
  section: RoundSectionInput
  strengthPa?: number
}

export interface BendingTorsionResult {
  section: RoundSectionInput
  outerRadiusM: number
  secondMomentM4: number
  polarMomentM4: number
  outerBendingStressPa: number
  outerTorsionalShearPa: number
  stress: PlaneStressResult
}
