import { describe, expect, it } from 'vitest'

import {
  formatChartValue,
  formatEngineeringValue,
  formatExtremaPosition,
  formatScientific,
  INVALID_NUMBER_DISPLAY,
  nearlyEqual,
  normalizeNegativeZero,
} from '../../../src/core/numeric'

describe('数值格式化', () => {
  it('普通值显示 3 位小数', () => {
    expect(formatEngineeringValue(12.3456)).toBe('12.346')
    expect(formatEngineeringValue(0)).toBe('0.000')
  })

  it('非零值显示为零时改用 6 位有效数字科学计数法', () => {
    expect(formatEngineeringValue(7.85e-9)).toBe('7.85000e-9')
    expect(formatEngineeringValue(-4e-7)).toBe('-4.00000e-7')
  })

  it('|x| >= 1e6 时使用科学计数法', () => {
    expect(formatEngineeringValue(1_000_000)).toBe('1.00000e6')
    expect(formatScientific(-2_500_000)).toBe('-2.50000e6')
  })

  it('极值位置 2 位小数，曲线值 6 位有效数字', () => {
    expect(formatExtremaPosition(12.345)).toBe('12.35')
    expect(formatChartValue(123.456789)).toBe('123.457')
  })

  it('不显示 NaN、Infinity 或 -0', () => {
    expect(formatEngineeringValue(Number.NaN)).toBe(INVALID_NUMBER_DISPLAY)
    expect(formatEngineeringValue(Number.POSITIVE_INFINITY)).toBe(INVALID_NUMBER_DISPLAY)
    expect(formatEngineeringValue(-0)).toBe('0.000')
    expect(formatChartValue(-0)).toBe('0')
    expect(Object.is(normalizeNegativeZero(-0), -0)).toBe(false)
  })
})

describe('基础数值比较', () => {
  it('同时支持相对与绝对容差', () => {
    expect(nearlyEqual(1_000_000.5, 1_000_000, 1e-6)).toBe(true)
    expect(nearlyEqual(1e-10, 0, 0, 1e-9)).toBe(true)
    expect(nearlyEqual(Number.NaN, Number.NaN)).toBe(false)
  })
})
