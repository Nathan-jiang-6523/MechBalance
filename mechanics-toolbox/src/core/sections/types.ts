export type SectionKind =
  | 'rectangle'
  | 'hollowRectangle'
  | 'solidCircle'
  | 'circularTube'

export type HandbookSectionKind =
  | 'regularHexagon'
  | 'regularOctagon'
  | 'semicircle'
  | 'semiAnnulus'
  | 'circularSector'
  | 'circularSegment'
  | 'annularSector'
  | 'ellipse'
  | 'hollowEllipse'
  | 'squareCircularHole'
  | 'circleCrossSlot'
  | 'rectangleCrossSlot'

/** All shapes exposed by the standalone section-properties workbench. */
export type SectionCalculatorKind = SectionKind | HandbookSectionKind

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

export type RegularHexagonSection =
  | {
      kind: 'regularHexagon'
      dimensionMode: 'sideLength'
      sideLengthM: number
    }
  | {
      kind: 'regularHexagon'
      dimensionMode: 'circumradius'
      circumradiusM: number
    }

export type RegularOctagonSection =
  | {
      kind: 'regularOctagon'
      dimensionMode: 'sideLength'
      sideLengthM: number
    }
  | {
      kind: 'regularOctagon'
      dimensionMode: 'circumradius'
      circumradiusM: number
    }

export interface SemicircleSection {
  kind: 'semicircle'
  diameterM: number
}

export interface SemiAnnulusSection {
  kind: 'semiAnnulus'
  outerDiameterM: number
  innerDiameterM: number
}

export interface CircularSectorSection {
  kind: 'circularSector'
  radiusM: number
  angleRad: number
}

export interface CircularSegmentSection {
  kind: 'circularSegment'
  radiusM: number
  angleRad: number
}

export interface AnnularSectorSection {
  kind: 'annularSector'
  outerRadiusM: number
  innerRadiusM: number
  angleRad: number
}

export interface EllipseSection {
  kind: 'ellipse'
  horizontalSemiAxisM: number
  verticalSemiAxisM: number
}

export interface HollowEllipseSection {
  kind: 'hollowEllipse'
  outerHorizontalSemiAxisM: number
  outerVerticalSemiAxisM: number
  innerHorizontalSemiAxisM: number
  innerVerticalSemiAxisM: number
}

export interface SquareCircularHoleSection {
  kind: 'squareCircularHole'
  sideM: number
  holeDiameterM: number
}

/**
 * Handbook subtraction model: a circular section minus a centred,
 * full-diameter rectangular slot of width slotWidthM.
 */
export interface CircleCrossSlotSection {
  kind: 'circleCrossSlot'
  diameterM: number
  slotWidthM: number
}

/** A rectangle minus a centred, full-width horizontal rectangular slot. */
export interface RectangleCrossSlotSection {
  kind: 'rectangleCrossSlot'
  widthM: number
  outerHeightM: number
  slotHeightM: number
}

export type SectionInput =
  | RectangleSection
  | HollowRectangleSection
  | SolidCircleSection
  | CircularTubeSection
  | RegularHexagonSection
  | RegularOctagonSection
  | SemicircleSection
  | SemiAnnulusSection
  | CircularSectorSection
  | CircularSegmentSection
  | AnnularSectorSection
  | EllipseSection
  | HollowEllipseSection
  | SquareCircularHoleSection
  | CircleCrossSlotSection
  | RectangleCrossSlotSection

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
  kind: SectionCalculatorKind
  /**
   * Centroid from each shape's documented reference origin.
   * Ix/Iy/Ixy and section moduli always use centroidal axes.
   */
  areaM2: number
  centroidM: { x: number; y: number }
  ixM4: number
  iyM4: number
  ixyM4: number
  sectionModuli: SectionModuli
  polarMomentM4: number
  /** Null when the handbook table does not provide a Saint-Venant torsion model. */
  torsionConstantM4: number | null
  torsionModel:
    | 'rectangle-engineering-approximation'
    | 'thin-walled-closed-section-midline'
    | 'circular-exact'
    | 'not-provided'
  principal: PrincipalInertia
}

export type SectionCalculationResult =
  | { ok: true; value: SectionProperties }
  | { ok: false; errors: SectionValidationError[] }
