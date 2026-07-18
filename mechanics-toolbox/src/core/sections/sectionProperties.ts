import type {
  CircularTubeSection,
  HollowRectangleSection,
  PrincipalInertia,
  RectangleSection,
  SectionCalculationResult,
  SectionInput,
  SectionProperties,
  SectionValidationError,
  SolidCircleSection,
} from './types'

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0

const positiveError = (
  field: string,
  value: number,
  message: string,
): SectionValidationError[] => (isPositiveFinite(value) ? [] : [{ field, message }])

function principal(ixM4: number, iyM4: number): PrincipalInertia {
  const scale = Math.max(Math.abs(ixM4), Math.abs(iyM4), 1)
  if (Math.abs(ixM4 - iyM4) <= Number.EPSILON * scale * 8) {
    return {
      majorM4: ixM4,
      minorM4: iyM4,
      majorAxisAngleRad: null,
      directionUnique: false,
    }
  }

  return ixM4 > iyM4
    ? {
        majorM4: ixM4,
        minorM4: iyM4,
        majorAxisAngleRad: 0,
        directionUnique: true,
      }
    : {
        majorM4: iyM4,
        minorM4: ixM4,
        majorAxisAngleRad: Math.PI / 2,
        directionUnique: true,
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
  const areaM2 = b * h
  const ixM4 = (b * h ** 3) / 12
  const iyM4 = (h * b ** 3) / 12
  const shortSideM = Math.min(b, h)
  const longSideM = Math.max(b, h)

  return success(input.kind, areaM2, ixM4, iyM4, {
    xPositiveM3: ixM4 / (h / 2),
    xNegativeM3: ixM4 / (h / 2),
    yPositiveM3: iyM4 / (b / 2),
    yNegativeM3: iyM4 / (b / 2),
  }, rectangleTorsionConstant(shortSideM, longSideM), 'rectangle-engineering-approximation')
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
  const torsionConstantM4 = (4 * midlineAreaM2 ** 2) / contourIntegral
  const areaM2 = B * H - b * h
  const ixM4 = (B * H ** 3 - b * h ** 3) / 12
  const iyM4 = (H * B ** 3 - h * b ** 3) / 12

  return success(input.kind, areaM2, ixM4, iyM4, {
    xPositiveM3: ixM4 / (H / 2),
    xNegativeM3: ixM4 / (H / 2),
    yPositiveM3: iyM4 / (B / 2),
    yNegativeM3: iyM4 / (B / 2),
  }, torsionConstantM4, 'thin-walled-closed-section-midline')
}

function solidCircle(input: SolidCircleSection): SectionCalculationResult {
  const errors = positiveError('d', input.diameterM, '直径 d 必须大于 0')
  if (errors.length > 0) return { ok: false, errors }

  const d = input.diameterM
  const areaM2 = (Math.PI * d ** 2) / 4
  const ixM4 = (Math.PI * d ** 4) / 64
  const polarMomentM4 = 2 * ixM4

  return success(input.kind, areaM2, ixM4, ixM4, {
    xPositiveM3: ixM4 / (d / 2),
    xNegativeM3: ixM4 / (d / 2),
    yPositiveM3: ixM4 / (d / 2),
    yNegativeM3: ixM4 / (d / 2),
  }, polarMomentM4, 'circular-exact')
}

function circularTube(input: CircularTubeSection): SectionCalculationResult {
  const errors = [
    ...positiveError('D', input.outerDiameterM, '外径 D 必须大于 0'),
    ...positiveError('d', input.innerDiameterM, '内径 d 必须大于 0'),
  ]
  if (
    isPositiveFinite(input.outerDiameterM) &&
    input.innerDiameterM >= input.outerDiameterM
  ) {
    errors.push({ field: 'd', message: '内径 d 必须小于外径 D' })
  }
  if (errors.length > 0) return { ok: false, errors }

  const D = input.outerDiameterM
  const d = input.innerDiameterM
  const areaM2 = (Math.PI * (D ** 2 - d ** 2)) / 4
  const ixM4 = (Math.PI * (D ** 4 - d ** 4)) / 64
  const polarMomentM4 = 2 * ixM4

  return success(input.kind, areaM2, ixM4, ixM4, {
    xPositiveM3: ixM4 / (D / 2),
    xNegativeM3: ixM4 / (D / 2),
    yPositiveM3: ixM4 / (D / 2),
    yNegativeM3: ixM4 / (D / 2),
  }, polarMomentM4, 'circular-exact')
}

function success(
  kind: SectionProperties['kind'],
  areaM2: number,
  ixM4: number,
  iyM4: number,
  sectionModuli: SectionProperties['sectionModuli'],
  torsionConstantM4: number,
  torsionModel: SectionProperties['torsionModel'],
): SectionCalculationResult {
  return {
    ok: true,
    value: {
      kind,
      areaM2,
      centroidM: { x: 0, y: 0 },
      ixM4,
      iyM4,
      ixyM4: 0,
      sectionModuli,
      polarMomentM4: ixM4 + iyM4,
      torsionConstantM4,
      torsionModel,
      principal: principal(ixM4, iyM4),
    },
  }
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
  }
}
