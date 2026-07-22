import { describe, expect, it } from 'vitest'

import { convertUnit, QUANTITY_CATALOG, UNIT_PRESETS } from '../../../src/core/units'
import {
  DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
  getStructuralQuantityId,
  getStructuralUnit,
  getStructuralUnitSelection,
  SI_STRUCTURAL_UNIT_PRESET_ID,
  STRUCTURAL_QUANTITY_MAP,
  STRUCTURAL_UNIT_GAPS,
  STRUCTURAL_UNIT_SYSTEMS,
  type MappedStructuralQuantityKey,
} from '../../../src/core/structural/units'

describe('P2 结构量到 P1 单位目录的映射', () => {
  it('覆盖坐标、材料、荷载、结果和刚度矩阵可复用量纲', () => {
    expect(STRUCTURAL_QUANTITY_MAP).toMatchObject({
      length: 'length',
      coordinate: 'length',
      displacement: 'length',
      extremumPosition: 'length',
      area: 'area',
      secondMomentOfArea: 'secondMomentOfArea',
      elasticModulus: 'elasticModulus',
      stress: 'stress',
      force: 'force',
      mass: 'mass',
      moment: 'moment',
      lineLoad: 'lineLoad',
      density: 'density',
      rotation: 'angle',
      temperatureDifference: 'temperatureDifference',
      translationRotationStiffness: 'force',
      rotationalStiffness: 'moment',
      translationalStiffness: 'lineLoad',
      acceleration: 'acceleration',
      strain: 'strain',
      thermalExpansionCoefficient: 'thermalExpansionCoefficient',
      dimensionless: 'dimensionless',
      flexibility: 'flexibility',
    })
  })

  it('工程制和 SI 选择直接来自共享 preset/catalog', () => {
    expect(STRUCTURAL_UNIT_SYSTEMS).toBe(UNIT_PRESETS)
    expect(DEFAULT_STRUCTURAL_UNIT_PRESET_ID).toBe('engineering')
    expect(SI_STRUCTURAL_UNIT_PRESET_ID).toBe('si')

    for (const [key, quantityId] of Object.entries(STRUCTURAL_QUANTITY_MAP)) {
      const structuralKey = key as MappedStructuralQuantityKey
      const sharedQuantity = quantityId as keyof typeof QUANTITY_CATALOG
      const engineeringPreset = UNIT_PRESETS.find((preset) => preset.id === 'engineering')
      expect(getStructuralQuantityId(structuralKey)).toBe(sharedQuantity)
      expect(getStructuralUnit(structuralKey)).toBe(engineeringPreset?.units[sharedQuantity])
      expect(getStructuralUnit(structuralKey, 'si')).toBe(QUANTITY_CATALOG[sharedQuantity].siUnit)
      expect(getStructuralUnitSelection(structuralKey)).toEqual({
        quantity: sharedQuantity,
        engineering: engineeringPreset?.units[sharedQuantity],
        si: QUANTITY_CATALOG[sharedQuantity].siUnit,
      })
    }
  })

  it('共享 converter 执行默认工程制到 SI 的换算', () => {
    const samples: readonly [MappedStructuralQuantityKey, number][] = [
      ['coordinate', 4],
      ['displacement', -33.3333333333],
      ['area', 1000],
      ['secondMomentOfArea', 8_000_000],
      ['elasticModulus', 200_000],
      ['stress', -100],
      ['force', -40_000],
      ['mass', 15.7],
      ['moment', 40_000_000],
      ['lineLoad', -10],
      ['density', 7.85e-9],
      ['rotation', -0.001],
      ['temperatureDifference', 50],
      ['translationRotationStiffness', 6_000_000],
      ['rotationalStiffness', 12_000_000],
      ['acceleration', 9_806.65],
      ['strain', 500],
      ['thermalExpansionCoefficient', 12e-6],
      ['dimensionless', 1.2],
      ['flexibility', 0.002],
    ]

    for (const [key, value] of samples) {
      const quantity = getStructuralQuantityId(key)
      const engineering = getStructuralUnit(key, 'engineering')
      const si = getStructuralUnit(key, 'si')
      const siValue = convertUnit(value, quantity, engineering, si)
      const roundTrip = convertUnit(siValue, quantity, si, engineering)
      expect(roundTrip).toBeCloseTo(value, 10)
    }
  })

  it('固定冻结算例使用的绝对换算真值', () => {
    const toSi = (key: MappedStructuralQuantityKey, value: number) => {
      const quantity = getStructuralQuantityId(key)
      return convertUnit(
        value,
        quantity,
        getStructuralUnit(key, 'engineering'),
        getStructuralUnit(key, 'si'),
      )
    }

    expect(toSi('coordinate', 4_000)).toBe(4)
    expect(toSi('secondMomentOfArea', 8_000_000)).toBeCloseTo(8e-6, 15)
    expect(toSi('elasticModulus', 200_000)).toBe(2e11)
    expect(toSi('moment', 40_000_000)).toBe(40_000)
    expect(toSi('lineLoad', -10)).toBe(-10_000)
    expect(toSi('translationalStiffness', 300)).toBe(300_000)
    expect(toSi('density', 7.85e-9)).toBeCloseTo(7_850, 10)
    expect(toSi('acceleration', 9_806.65)).toBeCloseTo(9.80665, 12)
    expect(toSi('strain', 500)).toBeCloseTo(500e-6, 15)
    expect(toSi('thermalExpansionCoefficient', 12e-6)).toBe(12e-6)
    expect(toSi('dimensionless', 1.2)).toBe(1.2)
    expect(toSi('flexibility', 2)).toBeCloseTo(0.002, 15)
  })
})

describe('P2 共享单位已完整', () => {
  it('没有剩余结构单位缺口', () => {
    expect(STRUCTURAL_UNIT_GAPS).toEqual({})
  })
})
