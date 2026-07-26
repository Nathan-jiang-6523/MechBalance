import { describe, expect, it } from 'vitest'

import { calculateSectionProperties } from '../../../src/core/sections'

const mm = (value: number) => value / 1_000
const mm2 = (value: number) => value / 1e6
const mm3 = (value: number) => value / 1e9
const mm4 = (value: number) => value / 1e12

function expectRelative(actual: number, expected: number, relative = 1e-6): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * relative)
}

describe('section properties acceptance fixtures', () => {
  it('SEC-RECT-01 rectangle', () => {
    const result = calculateSectionProperties({
      kind: 'rectangle',
      widthM: mm(80),
      heightM: mm(120),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectRelative(result.value.areaM2, mm2(9_600))
    expectRelative(result.value.ixM4, mm4(11_520_000))
    expectRelative(result.value.iyM4, mm4(5_120_000))
    expectRelative(result.value.sectionModuli.xPositiveM3, mm3(192_000))
    expectRelative(result.value.sectionModuli.yPositiveM3, mm3(128_000))
    expectRelative(result.value.polarMomentM4, mm4(16_640_000))
    expectRelative(result.value.torsionConstantM4, mm4(12_018_641.6461))
  })

  it('SEC-RECT-02 rejects zero width', () => {
    const result = calculateSectionProperties({
      kind: 'rectangle',
      widthM: 0,
      heightM: mm(120),
    })
    expect(result).toEqual({
      ok: false,
      errors: [{ field: 'b', message: '宽度 b 必须大于 0' }],
    })
  })

  it('SEC-HRECT-01 equal-wall hollow rectangle', () => {
    const result = calculateSectionProperties({
      kind: 'hollowRectangle',
      outerWidthM: mm(100),
      outerHeightM: mm(140),
      innerWidthM: mm(80),
      innerHeightM: mm(120),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectRelative(result.value.areaM2, mm2(4_400))
    expectRelative(result.value.ixM4, mm4(11_346_666.6667))
    expectRelative(result.value.iyM4, mm4(6_546_666.6667))
    expectRelative(result.value.sectionModuli.xPositiveM3, mm3(162_095.2381))
    expectRelative(result.value.sectionModuli.yPositiveM3, mm3(130_933.3333))
    expectRelative(result.value.polarMomentM4, mm4(17_893_333.3333))
    expectRelative(result.value.torsionConstantM4, mm4(12_444_545.4545))
  })

  it('SEC-HRECT-02 rejects inner width equal to outer width', () => {
    const result = calculateSectionProperties({
      kind: 'hollowRectangle',
      outerWidthM: mm(100),
      outerHeightM: mm(140),
      innerWidthM: mm(100),
      innerHeightM: mm(80),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContainEqual({ field: 'b', message: '内宽 b 必须小于外宽 B' })
  })

  it('SEC-CIRCLE-01 solid circle', () => {
    const result = calculateSectionProperties({ kind: 'solidCircle', diameterM: mm(100) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectRelative(result.value.areaM2, mm2(7_853.981634))
    expectRelative(result.value.ixM4, mm4(4_908_738.521234))
    expectRelative(result.value.sectionModuli.xPositiveM3, mm3(98_174.770425))
    expectRelative(result.value.polarMomentM4, mm4(9_817_477.042468))
    expectRelative(result.value.torsionConstantM4, mm4(9_817_477.042468))
    expect(result.value.principal.directionUnique).toBe(false)
  })

  it('SEC-CIRCLE-02 rejects zero diameter', () => {
    expect(calculateSectionProperties({ kind: 'solidCircle', diameterM: 0 })).toEqual({
      ok: false,
      errors: [{ field: 'd', message: '直径 d 必须大于 0' }],
    })
  })

  it('SEC-TUBE-01 circular tube', () => {
    const result = calculateSectionProperties({
      kind: 'circularTube',
      outerDiameterM: mm(120),
      innerDiameterM: mm(80),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectRelative(result.value.areaM2, mm2(6_283.185307))
    expectRelative(result.value.ixM4, mm4(8_168_140.899333))
    expectRelative(result.value.sectionModuli.xPositiveM3, mm3(136_135.681656))
    expectRelative(result.value.polarMomentM4, mm4(16_336_281.798667))
    expectRelative(result.value.torsionConstantM4, mm4(16_336_281.798667))
  })

  it('SEC-TUBE-02 rejects equal diameters', () => {
    const result = calculateSectionProperties({
      kind: 'circularTube',
      outerDiameterM: mm(100),
      innerDiameterM: mm(100),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContainEqual({ field: 'd', message: '内径 d 必须小于外径 D' })
  })

  it('SEC-HANDBOOK-POLYGON-01 regular hexagon and octagon', () => {
    const hexagon = calculateSectionProperties({
      kind: 'regularHexagon',
      dimensionMode: 'circumradius',
      circumradiusM: mm(100),
    })
    expect(hexagon.ok).toBe(true)
    if (!hexagon.ok) return
    expectRelative(hexagon.value.areaM2, mm2(25_980.7621135))
    expectRelative(hexagon.value.ixM4, mm4(54_126_587.7365))
    expectRelative(hexagon.value.iyM4, mm4(54_126_587.7365))
    expectRelative(hexagon.value.sectionModuli.xPositiveM3, mm3(625_000))
    expect(hexagon.value.torsionConstantM4).toBeNull()

    const octagon = calculateSectionProperties({
      kind: 'regularOctagon',
      dimensionMode: 'circumradius',
      circumradiusM: mm(100),
    })
    expect(octagon.ok).toBe(true)
    if (!octagon.ok) return
    expectRelative(octagon.value.areaM2, mm2(28_284.2712475))
    expectRelative(octagon.value.ixM4, mm4(63_807_118.7458))
    expectRelative(octagon.value.sectionModuli.xPositiveM3, mm3(690_643.2765))

    const hexagonFromSide = calculateSectionProperties({
      kind: 'regularHexagon',
      dimensionMode: 'sideLength',
      sideLengthM: mm(100),
    })
    const octagonFromSide = calculateSectionProperties({
      kind: 'regularOctagon',
      dimensionMode: 'sideLength',
      sideLengthM: mm(200 * Math.sin(Math.PI / 8)),
    })
    expect(hexagonFromSide.ok && octagonFromSide.ok).toBe(true)
    if (!hexagonFromSide.ok || !octagonFromSide.ok) return
    expectRelative(hexagonFromSide.value.areaM2, hexagon.value.areaM2)
    expectRelative(hexagonFromSide.value.ixM4, hexagon.value.ixM4)
    expectRelative(octagonFromSide.value.areaM2, octagon.value.areaM2)
    expectRelative(octagonFromSide.value.ixM4, octagon.value.ixM4)
  })

  it('SEC-HANDBOOK-SEMI-01 semicircle and semi-annulus', () => {
    const semicircle = calculateSectionProperties({ kind: 'semicircle', diameterM: mm(100) })
    expect(semicircle.ok).toBe(true)
    if (!semicircle.ok) return
    expectRelative(semicircle.value.areaM2, mm2(3_926.990817))
    expectRelative(semicircle.value.centroidM.y, mm(21.22065908))
    expectRelative(semicircle.value.ixM4, mm4(685_981.004))
    expectRelative(semicircle.value.iyM4, mm4(2_454_369.2606))
    expect(semicircle.value.sectionModuli.xPositiveM3).toBeLessThan(
      semicircle.value.sectionModuli.xNegativeM3,
    )

    const semiAnnulus = calculateSectionProperties({
      kind: 'semiAnnulus',
      outerDiameterM: mm(120),
      innerDiameterM: mm(80),
    })
    expect(semiAnnulus.ok).toBe(true)
    if (!semiAnnulus.ok) return
    expectRelative(semiAnnulus.value.areaM2, mm2(3_141.5926536))
    expectRelative(semiAnnulus.value.centroidM.y, mm(32.2554018))
    expectRelative(semiAnnulus.value.iyM4, mm4(4_084_070.4497))
  })

  it('SEC-HANDBOOK-ARC-01 sectors and segment reduce to semicircular cases at 180 degrees', () => {
    const diameterM = mm(100)
    const semicircle = calculateSectionProperties({ kind: 'semicircle', diameterM })
    const sector = calculateSectionProperties({
      kind: 'circularSector',
      radiusM: diameterM / 2,
      angleRad: Math.PI,
    })
    const segment = calculateSectionProperties({
      kind: 'circularSegment',
      radiusM: diameterM / 2,
      angleRad: Math.PI,
    })
    expect(semicircle.ok && sector.ok && segment.ok).toBe(true)
    if (!semicircle.ok || !sector.ok || !segment.ok) return
    expectRelative(sector.value.areaM2, semicircle.value.areaM2)
    expectRelative(sector.value.centroidM.y, semicircle.value.centroidM.y)
    expectRelative(sector.value.ixM4, semicircle.value.ixM4)
    expectRelative(segment.value.areaM2, semicircle.value.areaM2)
    expectRelative(segment.value.ixM4, semicircle.value.ixM4)
    expectRelative(segment.value.iyM4, semicircle.value.iyM4)

    const semiAnnulus = calculateSectionProperties({
      kind: 'semiAnnulus',
      outerDiameterM: mm(120),
      innerDiameterM: mm(80),
    })
    const annularSector = calculateSectionProperties({
      kind: 'annularSector',
      outerRadiusM: mm(60),
      innerRadiusM: mm(40),
      angleRad: Math.PI,
    })
    expect(semiAnnulus.ok && annularSector.ok).toBe(true)
    if (!semiAnnulus.ok || !annularSector.ok) return
    expectRelative(annularSector.value.areaM2, semiAnnulus.value.areaM2)
    expectRelative(annularSector.value.centroidM.y, semiAnnulus.value.centroidM.y)
    expectRelative(annularSector.value.ixM4, semiAnnulus.value.ixM4)
    expectRelative(annularSector.value.iyM4, semiAnnulus.value.iyM4)
  })

  it('SEC-HANDBOOK-ELLIPSE-01 solid and hollow ellipses', () => {
    const solid = calculateSectionProperties({
      kind: 'ellipse',
      horizontalSemiAxisM: mm(60),
      verticalSemiAxisM: mm(40),
    })
    expect(solid.ok).toBe(true)
    if (!solid.ok) return
    expectRelative(solid.value.areaM2, mm2(7_539.8223686))
    expectRelative(solid.value.ixM4, mm4(3_015_928.9474))
    expectRelative(solid.value.iyM4, mm4(6_785_840.1318))

    const hollow = calculateSectionProperties({
      kind: 'hollowEllipse',
      outerHorizontalSemiAxisM: mm(60),
      outerVerticalSemiAxisM: mm(40),
      innerHorizontalSemiAxisM: mm(50),
      innerVerticalSemiAxisM: mm(30),
    })
    expect(hollow.ok).toBe(true)
    if (!hollow.ok) return
    expectRelative(hollow.value.areaM2, mm2(2_827.4333882))
    expectRelative(hollow.value.ixM4, mm4(1_955_641.426))
    expectRelative(hollow.value.iyM4, mm4(3_840_597.019))
  })

  it('SEC-HANDBOOK-CUTOUT-01 centred hole and slot subtraction models', () => {
    const squareHole = calculateSectionProperties({
      kind: 'squareCircularHole',
      sideM: mm(100),
      holeDiameterM: mm(40),
    })
    expect(squareHole.ok).toBe(true)
    if (!squareHole.ok) return
    expectRelative(squareHole.value.areaM2, mm2(8_743.3629386))
    expectRelative(squareHole.value.ixM4, mm4(8_207_669.6164))
    expectRelative(squareHole.value.iyM4, squareHole.value.ixM4)

    const circleSlot = calculateSectionProperties({
      kind: 'circleCrossSlot',
      diameterM: mm(100),
      slotWidthM: mm(10),
    })
    expect(circleSlot.ok).toBe(true)
    if (!circleSlot.ok) return
    expectRelative(circleSlot.value.areaM2, mm2(6_853.981634))
    expectRelative(circleSlot.value.ixM4, mm4(4_075_405.1879))
    expectRelative(circleSlot.value.iyM4, mm4(4_900_405.1879))

    const rectangleSlot = calculateSectionProperties({
      kind: 'rectangleCrossSlot',
      widthM: mm(80),
      outerHeightM: mm(120),
      slotHeightM: mm(20),
    })
    expect(rectangleSlot.ok).toBe(true)
    if (!rectangleSlot.ok) return
    expectRelative(rectangleSlot.value.areaM2, mm2(8_000))
    expectRelative(rectangleSlot.value.ixM4, mm4(11_466_666.6667))
    expectRelative(rectangleSlot.value.iyM4, mm4(4_266_666.6667))
  })

  it('SEC-HANDBOOK-VALIDATION-01 rejects invalid angles and nested dimensions', () => {
    expect(calculateSectionProperties({
      kind: 'circularSector',
      radiusM: mm(50),
      angleRad: 0,
    })).toEqual({
      ok: false,
      errors: [{ field: 'angle', message: '夹角 α 必须大于 0° 且不超过 180°' }],
    })

    const invalidEllipse = calculateSectionProperties({
      kind: 'hollowEllipse',
      outerHorizontalSemiAxisM: mm(60),
      outerVerticalSemiAxisM: mm(40),
      innerHorizontalSemiAxisM: mm(60),
      innerVerticalSemiAxisM: mm(20),
    })
    expect(invalidEllipse.ok).toBe(false)
    if (invalidEllipse.ok) return
    expect(invalidEllipse.errors).toContainEqual({
      field: 'a1',
      message: '内水平半轴 a₁ 必须小于外水平半轴 a',
    })
  })
})
