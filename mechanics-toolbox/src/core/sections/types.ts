export type SectionKind =
  | 'rectangle'
  | 'hollowRectangle'
  | 'solidCircle'
  | 'circularTube'

export interface RectangleSection {
  kind: 'rectangle'
  widthM: number
  heightM: number
}

export interface HollowRectangleSection {
  kind: 'hollowRectangle'
  outerWidthM: number
  outerHeightM: number
  innerWidthM: number
  innerHeightM: number
}

export interface SolidCircleSection {
  kind: 'solidCircle'
  diameterM: number
}

export interface CircularTubeSection {
  kind: 'circularTube'
  outerDiameterM: number
  innerDiameterM: number
}

export type SectionInput =
  | RectangleSection
  | HollowRectangleSection
  | SolidCircleSection
  | CircularTubeSection

export interface SectionValidationError {
  field: string
  message: string
}

export interface SectionModuli {
  xPositiveM3: number
  xNegativeM3: number
  yPositiveM3: number
  yNegativeM3: number
}

export interface PrincipalInertia {
  majorM4: number
  minorM4: number
  /** Counter-clockwise from the global x axis. Null means every direction is principal. */
  majorAxisAngleRad: number | null
  directionUnique: boolean
}

export interface SectionProperties {
  kind: SectionKind
  areaM2: number
  centroidM: { x: number; y: number }
  ixM4: number
  iyM4: number
  ixyM4: number
  sectionModuli: SectionModuli
  polarMomentM4: number
  torsionConstantM4: number
  torsionModel:
    | 'rectangle-engineering-approximation'
    | 'thin-walled-closed-section-midline'
    | 'circular-exact'
  principal: PrincipalInertia
}

export type SectionCalculationResult =
  | { ok: true; value: SectionProperties }
  | { ok: false; errors: SectionValidationError[] }
