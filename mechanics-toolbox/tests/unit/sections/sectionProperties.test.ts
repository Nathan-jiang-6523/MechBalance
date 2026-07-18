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
})
