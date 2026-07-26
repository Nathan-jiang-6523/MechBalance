import type {
  AnnularSectorSection,
  CircleCrossSlotSection,
  CircularSegmentSection,
  CircularSectorSection,
  CircularTubeSection,
  EllipseSection,
  HollowEllipseSection,
  HollowRectangleSection,
  PrincipalInertia,
  RectangleCrossSlotSection,
  RectangleSection,
  RegularHexagonSection,
  RegularOctagonSection,
  SectionCalculationResult,
  SectionInput,
  SectionModuli,
  SectionProperties,
  SectionValidationError,
  SemiAnnulusSection,
  SemicircleSection,
  SolidCircleSection,
  SquareCircularHoleSection,
} from './types'

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0

const positiveError = (
  field: string,
  value: number,
  message: string,
): SectionValidationError[] => (isPositiveFinite(value) ? [] : [{ field, message }])

function angleErrors(angleRad: number): SectionValidationError[] {
  if (!Number.isFinite(angleRad) || angleRad <= 0 || angleRad > Math.PI) {
    return [{ field: 'angle', message: '夹角 α 必须大于 0° 且不超过 180°' }]
  }
  return []
}

function principal(ixM4: number, iyM4: number, ixyM4 = 0): PrincipalInertia {
  const average = (ixM4 + iyM4) / 2
  const radius = Math.hypot((ixM4 - iyM4) / 2, ixyM4)
  const majorM4 = average + radius
  const minorM4 = average - radius
  const scale = Math.max(Math.abs(majorM4), Math.abs(minorM4), 1)

  if (radius <= Number.EPSILON * scale * 8) {
    return {
      majorM4,
      minorM4,
      majorAxisAngleRad: null,
      directionUnique: false,
    }
  }

  const rawAngle = 0.5 * Math.atan2(-2 * ixyM4, ixM4 - iyM4)
  return {
    majorM4,
    minorM4,
    majorAxisAngleRad: rawAngle < 0 ? rawAngle + Math.PI : rawAngle,
    directionUnique: true,
  }
}

function sectionModuli(
  ixM4: number,
  iyM4: number,
  xPositiveM: number,
  xNegativeM: number,
  yPositiveM: number,
  yNegativeM: number,
): SectionModuli {
  return {
    xPositiveM3: ixM4 / yPositiveM,
    xNegativeM3: ixM4 / yNegativeM,
    yPositiveM3: iyM4 / xPositiveM,
    yNegativeM3: iyM4 / xNegativeM,
  }
}

interface SuccessGeometry {
  areaM2: number
  centroidM?: { x: number; y: number }
  ixM4: number
  iyM4: number
  ixyM4?: number
  xPositiveM: number
  xNegativeM: number
  yPositiveM: number
  yNegativeM: number
  torsionConstantM4?: number | null
  torsionModel?: SectionProperties['torsionModel']
}

function success(
  kind: SectionProperties['kind'],
  geometry: SuccessGeometry,
): SectionCalculationResult {
  const positiveGeometry = [
    geometry.areaM2,
    geometry.ixM4,
    geometry.iyM4,
    geometry.xPositiveM,
    geometry.xNegativeM,
    geometry.yPositiveM,
    geometry.yNegativeM,
  ]
  if (!positiveGeometry.every(isPositiveFinite)) {
    return {
      ok: false,
      errors: [{ field: 'geometry', message: '当前尺寸导致非正或非有限截面性质' }],
    }
  }

  const ixyM4 = geometry.ixyM4 ?? 0
  const torsionConstantM4 = geometry.torsionConstantM4 ?? null
  return {
    ok: true,
    value: {
      kind,
      areaM2: geometry.areaM2,
      centroidM: geometry.centroidM ?? { x: 0, y: 0 },
      ixM4: geometry.ixM4,
      iyM4: geometry.iyM4,
      ixyM4,
      sectionModuli: sectionModuli(
        geometry.ixM4,
        geometry.iyM4,
        geometry.xPositiveM,
        geometry.xNegativeM,
        geometry.yPositiveM,
        geometry.yNegativeM,
      ),
      polarMomentM4: geometry.ixM4 + geometry.iyM4,
      torsionConstantM4,
      torsionModel: geometry.torsionModel ?? 'not-provided',
      principal: principal(geometry.ixM4, geometry.iyM4, ixyM4),
    },
  }
}

/**
 * Saint-Venant rectangle approximation used by acceptance case SEC-RECT-01.
 * Formula: J=(a*b^3/3)[1-0.63(b/a)+0.052(b/a)^5], where b <= a.
 */
export function rectangleTorsionConstant(
  shortSideM: number,
  longSideM: number,
): number {
  const ratio = shortSideM / longSideM
  return (
    (longSideM * shortSideM ** 3) / 3 *
    (1 - 0.63 * ratio + 0.052 * ratio ** 5)
  )
}

function rectangle(input: RectangleSection): SectionCalculationResult {
  const errors = [
    ...positiveError('b', input.widthM, '宽度 b 必须大于 0'),
    ...positiveError('h', input.heightM, '高度 h 必须大于 0'),
  ]
  if (errors.length > 0) return { ok: false, errors }

  const { widthM: b, heightM: h } = input
  const ixM4 = (b * h ** 3) / 12
  const iyM4 = (h * b ** 3) / 12
  return success(input.kind, {
    areaM2: b * h,
    ixM4,
    iyM4,
    xPositiveM: b / 2,
    xNegativeM: b / 2,
    yPositiveM: h / 2,
    yNegativeM: h / 2,
    torsionConstantM4: rectangleTorsionConstant(Math.min(b, h), Math.max(b, h)),
    torsionModel: 'rectangle-engineering-approximation',
  })
}

function hollowRectangle(input: HollowRectangleSection): SectionCalculationResult {
  const errors = [
    ...positiveError('B', input.outerWidthM, '外宽 B 必须大于 0'),
    ...positiveError('H', input.outerHeightM, '外高 H 必须大于 0'),
    ...positiveError('b', input.innerWidthM, '内宽 b 必须大于 0'),
    ...positiveError('h', input.innerHeightM, '内高 h 必须大于 0'),
  ]
  if (isPositiveFinite(input.outerWidthM) && input.innerWidthM >= input.outerWidthM) {
    errors.push({ field: 'b', message: '内宽 b 必须小于外宽 B' })
  }
  if (isPositiveFinite(input.outerHeightM) && input.innerHeightM >= input.outerHeightM) {
    errors.push({ field: 'h', message: '内高 h 必须小于外高 H' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const B = input.outerWidthM
  const H = input.outerHeightM
  const b = input.innerWidthM
  const h = input.innerHeightM
  const horizontalThicknessM = (H - h) / 2
  const verticalThicknessM = (B - b) / 2
  if (Math.abs(horizontalThicknessM - verticalThicknessM) > Number.EPSILON * Math.max(B, H) * 8) {
    return {
      ok: false,
      errors: [{ field: 'geometry', message: '首版空心矩形仅支持四壁等厚截面' }],
    }
  }

  const thicknessM = horizontalThicknessM
  const midlineWidthM = (B + b) / 2
  const midlineHeightM = (H + h) / 2
  const midlineAreaM2 = midlineWidthM * midlineHeightM
  const contourIntegral = (2 * (midlineWidthM + midlineHeightM)) / thicknessM
  const ixM4 = (B * H ** 3 - b * h ** 3) / 12
  const iyM4 = (H * B ** 3 - h * b ** 3) / 12

  return success(input.kind, {
    areaM2: B * H - b * h,
    ixM4,
    iyM4,
    xPositiveM: B / 2,
    xNegativeM: B / 2,
    yPositiveM: H / 2,
    yNegativeM: H / 2,
    torsionConstantM4: (4 * midlineAreaM2 ** 2) / contourIntegral,
    torsionModel: 'thin-walled-closed-section-midline',
  })
}

function solidCircle(input: SolidCircleSection): SectionCalculationResult {
  const errors = positiveError('d', input.diameterM, '直径 d 必须大于 0')
  if (errors.length > 0) return { ok: false, errors }

  const d = input.diameterM
  const ixM4 = (Math.PI * d ** 4) / 64
  return success(input.kind, {
    areaM2: (Math.PI * d ** 2) / 4,
    ixM4,
    iyM4: ixM4,
    xPositiveM: d / 2,
    xNegativeM: d / 2,
    yPositiveM: d / 2,
    yNegativeM: d / 2,
    torsionConstantM4: 2 * ixM4,
    torsionModel: 'circular-exact',
  })
}

function circularTube(input: CircularTubeSection): SectionCalculationResult {
  const errors = [
    ...positiveError('D', input.outerDiameterM, '外径 D 必须大于 0'),
    ...positiveError('d', input.innerDiameterM, '内径 d 必须大于 0'),
  ]
  if (isPositiveFinite(input.outerDiameterM) && input.innerDiameterM >= input.outerDiameterM) {
    errors.push({ field: 'd', message: '内径 d 必须小于外径 D' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const D = input.outerDiameterM
  const d = input.innerDiameterM
  const ixM4 = (Math.PI * (D ** 4 - d ** 4)) / 64
  return success(input.kind, {
    areaM2: (Math.PI * (D ** 2 - d ** 2)) / 4,
    ixM4,
    iyM4: ixM4,
    xPositiveM: D / 2,
    xNegativeM: D / 2,
    yPositiveM: D / 2,
    yNegativeM: D / 2,
    torsionConstantM4: 2 * ixM4,
    torsionModel: 'circular-exact',
  })
}

interface Point {
  x: number
  y: number
}

function polygonGeometry(vertices: readonly Point[]): Omit<SuccessGeometry, 'torsionConstantM4' | 'torsionModel'> {
  let twiceArea = 0
  let centroidXNumerator = 0
  let centroidYNumerator = 0
  let ixOriginNumerator = 0
  let iyOriginNumerator = 0
  let ixyOriginNumerator = 0

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!
    const next = vertices[(index + 1) % vertices.length]!
    const cross = current.x * next.y - next.x * current.y
    twiceArea += cross
    centroidXNumerator += (current.x + next.x) * cross
    centroidYNumerator += (current.y + next.y) * cross
    ixOriginNumerator += (current.y ** 2 + current.y * next.y + next.y ** 2) * cross
    iyOriginNumerator += (current.x ** 2 + current.x * next.x + next.x ** 2) * cross
    ixyOriginNumerator += (
      2 * current.x * current.y +
      current.x * next.y +
      next.x * current.y +
      2 * next.x * next.y
    ) * cross
  }

  const areaM2 = twiceArea / 2
  const centroidM = {
    x: centroidXNumerator / (3 * twiceArea),
    y: centroidYNumerator / (3 * twiceArea),
  }
  const ixOriginM4 = ixOriginNumerator / 12
  const iyOriginM4 = iyOriginNumerator / 12
  const ixyOriginM4 = ixyOriginNumerator / 24
  const ixM4 = ixOriginM4 - areaM2 * centroidM.y ** 2
  const iyM4 = iyOriginM4 - areaM2 * centroidM.x ** 2
  const ixyM4 = ixyOriginM4 - areaM2 * centroidM.x * centroidM.y
  const xs = vertices.map((vertex) => vertex.x - centroidM.x)
  const ys = vertices.map((vertex) => vertex.y - centroidM.y)

  return {
    areaM2,
    centroidM,
    ixM4,
    iyM4,
    ixyM4,
    xPositiveM: Math.max(...xs),
    xNegativeM: -Math.min(...xs),
    yPositiveM: Math.max(...ys),
    yNegativeM: -Math.min(...ys),
  }
}

function regularPolygon(
  input: RegularHexagonSection | RegularOctagonSection,
  sides: 6 | 8,
): SectionCalculationResult {
  const sourceDimensionM = input.dimensionMode === 'sideLength'
    ? input.sideLengthM
    : input.circumradiusM
  const field = input.dimensionMode === 'sideLength' ? 's' : 'R'
  const label = input.dimensionMode === 'sideLength' ? '边长 s' : '外接圆半径 R'
  const errors = positiveError(field, sourceDimensionM, `${label} 必须大于 0`)
  if (errors.length > 0) return { ok: false, errors }

  const circumradiusM = input.dimensionMode === 'circumradius'
    ? input.circumradiusM
    : input.sideLengthM / (2 * Math.sin(Math.PI / sides))
  const phase = sides === 6 ? 0 : Math.PI / 8
  const vertices = Array.from({ length: sides }, (_, index) => {
    const angle = phase + (index * 2 * Math.PI) / sides
    return {
      x: circumradiusM * Math.cos(angle),
      y: circumradiusM * Math.sin(angle),
    }
  })
  return success(input.kind, polygonGeometry(vertices))
}

function semicircle(input: SemicircleSection): SectionCalculationResult {
  const errors = positiveError('d', input.diameterM, '直径 d 必须大于 0')
  if (errors.length > 0) return { ok: false, errors }

  const r = input.diameterM / 2
  const areaM2 = (Math.PI * r ** 2) / 2
  const centroidY = (4 * r) / (3 * Math.PI)
  const ixM4 = (Math.PI * r ** 4) / 8 - areaM2 * centroidY ** 2
  const iyM4 = (Math.PI * r ** 4) / 8
  return success(input.kind, {
    areaM2,
    centroidM: { x: 0, y: centroidY },
    ixM4,
    iyM4,
    xPositiveM: r,
    xNegativeM: r,
    yPositiveM: r - centroidY,
    yNegativeM: centroidY,
  })
}

function semiAnnulus(input: SemiAnnulusSection): SectionCalculationResult {
  const errors = [
    ...positiveError('D', input.outerDiameterM, '外径 D 必须大于 0'),
    ...positiveError('d', input.innerDiameterM, '内径 d 必须大于 0'),
  ]
  if (isPositiveFinite(input.outerDiameterM) && input.innerDiameterM >= input.outerDiameterM) {
    errors.push({ field: 'd', message: '内径 d 必须小于外径 D' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const R = input.outerDiameterM / 2
  const r = input.innerDiameterM / 2
  const areaM2 = (Math.PI * (R ** 2 - r ** 2)) / 2
  const centroidY = (4 * (R ** 3 - r ** 3)) / (3 * Math.PI * (R ** 2 - r ** 2))
  const diameterAxisMoment = (Math.PI * (R ** 4 - r ** 4)) / 8
  return success(input.kind, {
    areaM2,
    centroidM: { x: 0, y: centroidY },
    ixM4: diameterAxisMoment - areaM2 * centroidY ** 2,
    iyM4: diameterAxisMoment,
    xPositiveM: R,
    xNegativeM: R,
    yPositiveM: R - centroidY,
    yNegativeM: centroidY,
  })
}

function circularSector(input: CircularSectorSection): SectionCalculationResult {
  const errors = [
    ...positiveError('r', input.radiusM, '半径 r 必须大于 0'),
    ...angleErrors(input.angleRad),
  ]
  if (errors.length > 0) return { ok: false, errors }

  const r = input.radiusM
  const theta = input.angleRad
  const areaM2 = (theta * r ** 2) / 2
  const centroidY = (4 * r * Math.sin(theta / 2)) / (3 * theta)
  const ixOriginM4 = (r ** 4 * (theta + Math.sin(theta))) / 8
  const iyM4 = (r ** 4 * (theta - Math.sin(theta))) / 8
  return success(input.kind, {
    areaM2,
    centroidM: { x: 0, y: centroidY },
    ixM4: ixOriginM4 - areaM2 * centroidY ** 2,
    iyM4,
    xPositiveM: r * Math.sin(theta / 2),
    xNegativeM: r * Math.sin(theta / 2),
    yPositiveM: r - centroidY,
    yNegativeM: centroidY,
  })
}

function circularSegment(input: CircularSegmentSection): SectionCalculationResult {
  const errors = [
    ...positiveError('r', input.radiusM, '半径 r 必须大于 0'),
    ...angleErrors(input.angleRad),
  ]
  if (errors.length > 0) return { ok: false, errors }

  const r = input.radiusM
  const theta = input.angleRad
  const halfAngle = theta / 2
  const areaM2 = (r ** 2 * (theta - Math.sin(theta))) / 2
  const centroidY = (4 * r * Math.sin(halfAngle) ** 3) / (3 * (theta - Math.sin(theta)))
  const chordY = r * Math.cos(halfAngle)
  const ixOriginM4 = (r ** 4 * (theta - Math.sin(theta) * Math.cos(theta))) / 8
  const iyM4 = (
    r ** 4 *
    (theta - Math.sin(theta) - (2 / 3) * Math.sin(theta) * Math.sin(halfAngle) ** 2)
  ) / 8
  return success(input.kind, {
    areaM2,
    centroidM: { x: 0, y: centroidY },
    ixM4: ixOriginM4 - areaM2 * centroidY ** 2,
    iyM4,
    xPositiveM: r * Math.sin(halfAngle),
    xNegativeM: r * Math.sin(halfAngle),
    yPositiveM: r - centroidY,
    yNegativeM: centroidY - chordY,
  })
}

function annularSector(input: AnnularSectorSection): SectionCalculationResult {
  const errors = [
    ...positiveError('R', input.outerRadiusM, '外半径 R 必须大于 0'),
    ...positiveError('r', input.innerRadiusM, '内半径 r 必须大于 0'),
    ...angleErrors(input.angleRad),
  ]
  if (isPositiveFinite(input.outerRadiusM) && input.innerRadiusM >= input.outerRadiusM) {
    errors.push({ field: 'r', message: '内半径 r 必须小于外半径 R' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const R = input.outerRadiusM
  const r = input.innerRadiusM
  const theta = input.angleRad
  const areaM2 = (theta * (R ** 2 - r ** 2)) / 2
  const centroidY = (
    4 * Math.sin(theta / 2) * (R ** 3 - r ** 3)
  ) / (3 * theta * (R ** 2 - r ** 2))
  const ixOriginM4 = ((R ** 4 - r ** 4) * (theta + Math.sin(theta))) / 8
  const iyM4 = ((R ** 4 - r ** 4) * (theta - Math.sin(theta))) / 8
  const minimumY = r * Math.cos(theta / 2)
  return success(input.kind, {
    areaM2,
    centroidM: { x: 0, y: centroidY },
    ixM4: ixOriginM4 - areaM2 * centroidY ** 2,
    iyM4,
    xPositiveM: R * Math.sin(theta / 2),
    xNegativeM: R * Math.sin(theta / 2),
    yPositiveM: R - centroidY,
    yNegativeM: centroidY - minimumY,
  })
}

function ellipse(input: EllipseSection): SectionCalculationResult {
  const errors = [
    ...positiveError('a', input.horizontalSemiAxisM, '水平半轴 a 必须大于 0'),
    ...positiveError('b', input.verticalSemiAxisM, '竖直半轴 b 必须大于 0'),
  ]
  if (errors.length > 0) return { ok: false, errors }

  const a = input.horizontalSemiAxisM
  const b = input.verticalSemiAxisM
  return success(input.kind, {
    areaM2: Math.PI * a * b,
    ixM4: (Math.PI * a * b ** 3) / 4,
    iyM4: (Math.PI * a ** 3 * b) / 4,
    xPositiveM: a,
    xNegativeM: a,
    yPositiveM: b,
    yNegativeM: b,
  })
}

function hollowEllipse(input: HollowEllipseSection): SectionCalculationResult {
  const errors = [
    ...positiveError('a', input.outerHorizontalSemiAxisM, '外水平半轴 a 必须大于 0'),
    ...positiveError('b', input.outerVerticalSemiAxisM, '外竖直半轴 b 必须大于 0'),
    ...positiveError('a1', input.innerHorizontalSemiAxisM, '内水平半轴 a₁ 必须大于 0'),
    ...positiveError('b1', input.innerVerticalSemiAxisM, '内竖直半轴 b₁ 必须大于 0'),
  ]
  if (
    isPositiveFinite(input.outerHorizontalSemiAxisM) &&
    input.innerHorizontalSemiAxisM >= input.outerHorizontalSemiAxisM
  ) {
    errors.push({ field: 'a1', message: '内水平半轴 a₁ 必须小于外水平半轴 a' })
  }
  if (
    isPositiveFinite(input.outerVerticalSemiAxisM) &&
    input.innerVerticalSemiAxisM >= input.outerVerticalSemiAxisM
  ) {
    errors.push({ field: 'b1', message: '内竖直半轴 b₁ 必须小于外竖直半轴 b' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const a = input.outerHorizontalSemiAxisM
  const b = input.outerVerticalSemiAxisM
  const a1 = input.innerHorizontalSemiAxisM
  const b1 = input.innerVerticalSemiAxisM
  return success(input.kind, {
    areaM2: Math.PI * (a * b - a1 * b1),
    ixM4: (Math.PI * (a * b ** 3 - a1 * b1 ** 3)) / 4,
    iyM4: (Math.PI * (a ** 3 * b - a1 ** 3 * b1)) / 4,
    xPositiveM: a,
    xNegativeM: a,
    yPositiveM: b,
    yNegativeM: b,
  })
}

function squareCircularHole(input: SquareCircularHoleSection): SectionCalculationResult {
  const errors = [
    ...positiveError('a', input.sideM, '正方形边长 a 必须大于 0'),
    ...positiveError('d', input.holeDiameterM, '圆孔直径 d 必须大于 0'),
  ]
  if (isPositiveFinite(input.sideM) && input.holeDiameterM >= input.sideM) {
    errors.push({ field: 'd', message: '圆孔直径 d 必须小于边长 a' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const a = input.sideM
  const d = input.holeDiameterM
  const inertiaM4 = a ** 4 / 12 - (Math.PI * d ** 4) / 64
  return success(input.kind, {
    areaM2: a ** 2 - (Math.PI * d ** 2) / 4,
    ixM4: inertiaM4,
    iyM4: inertiaM4,
    xPositiveM: a / 2,
    xNegativeM: a / 2,
    yPositiveM: a / 2,
    yNegativeM: a / 2,
  })
}

function circleCrossSlot(input: CircleCrossSlotSection): SectionCalculationResult {
  const errors = [
    ...positiveError('d', input.diameterM, '圆直径 d 必须大于 0'),
    ...positiveError('d1', input.slotWidthM, '通槽宽度 d₁ 必须大于 0'),
  ]
  if (isPositiveFinite(input.diameterM) && input.slotWidthM >= input.diameterM) {
    errors.push({ field: 'd1', message: '通槽宽度 d₁ 必须小于圆直径 d' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const d = input.diameterM
  const d1 = input.slotWidthM
  const areaM2 = (Math.PI * d ** 2) / 4 - d1 * d
  const ixM4 = (Math.PI * d ** 4) / 64 - (d1 * d ** 3) / 12
  const iyM4 = (Math.PI * d ** 4) / 64 - (d * d1 ** 3) / 12
  if (areaM2 <= 0 || ixM4 <= 0 || iyM4 <= 0) {
    return {
      ok: false,
      errors: [{ field: 'd1', message: '通槽过宽，手册扣除模型得到非正截面性质' }],
    }
  }
  return success(input.kind, {
    areaM2,
    ixM4,
    iyM4,
    xPositiveM: d / 2,
    xNegativeM: d / 2,
    yPositiveM: d / 2,
    yNegativeM: d / 2,
  })
}

function rectangleCrossSlot(input: RectangleCrossSlotSection): SectionCalculationResult {
  const errors = [
    ...positiveError('b', input.widthM, '宽度 b 必须大于 0'),
    ...positiveError('H', input.outerHeightM, '外高 H 必须大于 0'),
    ...positiveError('h', input.slotHeightM, '通槽高度 h 必须大于 0'),
  ]
  if (isPositiveFinite(input.outerHeightM) && input.slotHeightM >= input.outerHeightM) {
    errors.push({ field: 'h', message: '通槽高度 h 必须小于外高 H' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const b = input.widthM
  const H = input.outerHeightM
  const h = input.slotHeightM
  return success(input.kind, {
    areaM2: b * (H - h),
    ixM4: (b * (H ** 3 - h ** 3)) / 12,
    iyM4: (b ** 3 * (H - h)) / 12,
    xPositiveM: b / 2,
    xNegativeM: b / 2,
    yPositiveM: H / 2,
    yNegativeM: H / 2,
  })
}

export function calculateSectionProperties(input: SectionInput): SectionCalculationResult {
  switch (input.kind) {
    case 'rectangle':
      return rectangle(input)
    case 'hollowRectangle':
      return hollowRectangle(input)
    case 'solidCircle':
      return solidCircle(input)
    case 'circularTube':
      return circularTube(input)
    case 'regularHexagon':
      return regularPolygon(input, 6)
    case 'regularOctagon':
      return regularPolygon(input, 8)
    case 'semicircle':
      return semicircle(input)
    case 'semiAnnulus':
      return semiAnnulus(input)
    case 'circularSector':
      return circularSector(input)
    case 'circularSegment':
      return circularSegment(input)
    case 'annularSector':
      return annularSector(input)
    case 'ellipse':
      return ellipse(input)
    case 'hollowEllipse':
      return hollowEllipse(input)
    case 'squareCircularHole':
      return squareCircularHole(input)
    case 'circleCrossSlot':
      return circleCrossSlot(input)
    case 'rectangleCrossSlot':
      return rectangleCrossSlot(input)
  }
}
