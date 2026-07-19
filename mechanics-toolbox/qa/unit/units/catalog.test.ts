import { describe, expect, it } from 'vitest'

import { QUANTITY_CATALOG, UNIT_PRESETS } from '../../../src/core/units'

describe('单位目录', () => {
  it('登记首版全部物理量', () => {
    expect(Object.keys(QUANTITY_CATALOG)).toEqual([
      'length',
      'area',
      'volume',
      'sectionModulus',
      'secondMomentOfArea',
      'force',
      'mass',
      'stress',
      'pressure',
      'elasticModulus',
      'moment',
      'momentPerLength',
      'torque',
      'lineLoad',
      'density',
      'temperature',
      'temperatureDifference',
      'angle',
      'power',
      'rotationalSpeed',
    ])
  })

  it('保持已确认的工程单位排序', () => {
    const unitIds = (quantity: keyof typeof QUANTITY_CATALOG) =>
      QUANTITY_CATALOG[quantity].units.map((unit) => unit.id)

    expect(unitIds('length')).toEqual(['mm', 'm', 'cm'])
    expect(unitIds('area')).toEqual(['mm2', 'cm2', 'm2'])
    expect(unitIds('force')).toEqual(['N', 'kN'])
    expect(unitIds('moment')).toEqual(['N_mm', 'N_m', 'kN_m'])
    expect(unitIds('momentPerLength')).toEqual([
      'N_mm_per_mm',
      'N_m_per_m',
      'kN_m_per_m',
    ])
    expect(unitIds('lineLoad')).toEqual(['N_per_mm', 'kN_per_m', 'N_per_m'])
    expect(unitIds('stress')).toEqual(['MPa', 'GPa', 'Pa', 'N_per_mm2'])
    expect(unitIds('angle')).toEqual(['rad', 'deg'])
    expect(unitIds('sectionModulus')).toEqual(['mm3', 'cm3', 'm3'])
    expect(unitIds('secondMomentOfArea')).toEqual(['mm4', 'cm4', 'm4'])
    expect(unitIds('mass')).toEqual(['t', 'kg', 'g'])
    expect(unitIds('density')).toEqual(['t_per_mm3', 'kg_per_m3', 'g_per_cm3'])
  })

  it('工程预设排在 SI 前且 t 只登记为质量单位', () => {
    expect(UNIT_PRESETS.map((preset) => preset.id)).toEqual(['engineering', 'si'])
    expect(UNIT_PRESETS[0]?.units.mass).toBe('t')
    expect(UNIT_PRESETS[0]?.units.momentPerLength).toBe('N_mm_per_mm')
    expect(UNIT_PRESETS[1]?.units.momentPerLength).toBe('N_m_per_m')
    expect(QUANTITY_CATALOG.force.units.some((unit) => unit.id === ('t' as never))).toBe(false)
    expect(QUANTITY_CATALOG.force.units.some((unit) => unit.symbol === 'tf')).toBe(false)
  })
})
