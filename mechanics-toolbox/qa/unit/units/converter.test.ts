import { describe, expect, it } from 'vitest'

import {
  convertUnit,
  convertUnitDetailed,
  isUnitCompatible,
  QUANTITY_CATALOG,
  UnitConversionError,
  type QuantityId,
} from '../../../src/core/units'
import { nearlyEqual } from '../../../src/core/numeric'

describe('用户单位验收算例', () => {
  it('UNIT-01：长度、面积、体积', () => {
    expect(convertUnit(1.25, 'length', 'm', 'mm')).toBeCloseTo(1250, 12)
    expect(convertUnit(2.5, 'area', 'm2', 'mm2')).toBeCloseTo(2_500_000, 12)
    expect(convertUnit(0.003, 'volume', 'm3', 'mm3')).toBeCloseTo(3_000_000, 12)
  })

  it('UNIT-02：截面模量、截面二次矩使用三次和四次比例', () => {
    expect(nearlyEqual(convertUnit(12, 'sectionModulus', 'cm3', 'mm3'), 12_000, 1e-12)).toBe(
      true,
    )
    expect(
      nearlyEqual(convertUnit(3, 'secondMomentOfArea', 'cm4', 'mm4'), 30_000, 1e-12),
    ).toBe(true)
  })

  it('UNIT-03：力和质量独立换算', () => {
    expect(convertUnit(2.5, 'force', 'kN', 'N')).toBeCloseTo(2500, 12)
    expect(convertUnit(1.2, 'mass', 't', 'kg')).toBeCloseTo(1200, 12)
  })

  it('UNIT-04：应力和弹性模量同量纲、分类独立', () => {
    expect(convertUnit(-125, 'stress', 'MPa', 'N_per_mm2')).toBeCloseTo(-125, 12)
    expect(convertUnit(210, 'elasticModulus', 'GPa', 'MPa')).toBeCloseTo(210_000, 12)
  })

  it('UNIT-05：力矩与线载荷保留负号', () => {
    expect(convertUnit(-2.5, 'moment', 'kN_m', 'N_mm')).toBeCloseTo(-2_500_000, 12)
    expect(convertUnit(-3, 'lineLoad', 'kN_per_m', 'N_per_mm')).toBeCloseTo(-3, 12)
  })

  it('UNIT-06：密度归一到 kg/m³', () => {
    const result = convertUnitDetailed(7850, 'density', 'kg_per_m3', 't_per_mm3')
    expect(result.siValue).toBe(7850)
    expect(result.outputValue).toBeCloseTo(7.85e-9, 20)
  })

  it('UNIT-07：绝对温度有偏置，温差只有比例', () => {
    expect(convertUnit(25, 'temperature', 'degC', 'degF')).toBeCloseTo(77, 12)
    expect(convertUnit(20, 'temperatureDifference', 'deltaDegC', 'deltaDegF')).toBeCloseTo(
      36,
      12,
    )
    expect(convertUnit(180, 'angle', 'deg', 'rad')).toBeCloseTo(Math.PI, 12)
  })

  it('UNIT-08：功率和转速', () => {
    expect(convertUnit(15, 'power', 'kW', 'W')).toBeCloseTo(15_000, 12)
    expect(convertUnit(1500, 'rotationalSpeed', 'r_per_min', 'r_per_s')).toBeCloseTo(25, 12)
  })
})

describe('共享换算表回归', () => {
  it.each(Object.keys(QUANTITY_CATALOG) as QuantityId[])('%s 全部单位对可往返', (quantity) => {
    const units = QUANTITY_CATALOG[quantity].units
    for (const from of units) {
      for (const to of units) {
        for (const value of [0, 1.23456789, -987.654321, 1e-15, 1e15]) {
          const converted = convertUnit(value, quantity, from.id, to.id)
          const roundTrip = convertUnit(converted, quantity, to.id, from.id)
          const absoluteTolerance = quantity === 'temperature' ? 1e-12 : 0
          expect(nearlyEqual(roundTrip, value, 1e-12, absoluteTolerance)).toBe(true)
        }
      }
    }
  })

  it('拒绝量纲不相容单位', () => {
    expect(isUnitCompatible('force', 'mm')).toBe(false)
    expect(() => convertUnit(1, 'force', 'mm', 'N')).toThrow(UnitConversionError)
    try {
      convertUnit(1, 'force', 'mm', 'N')
    } catch (error) {
      expect(error).toMatchObject({ code: 'INCOMPATIBLE_UNIT' })
    }
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '拒绝非有限输入 %s',
    (value) => {
      expect(() => convertUnit(value, 'length', 'm', 'mm')).toThrow(UnitConversionError)
    },
  )

  it('负零换算后统一为零', () => {
    const result = convertUnit(-0, 'force', 'kN', 'N')
    expect(result).toBe(0)
    expect(Object.is(result, -0)).toBe(false)
  })
})
