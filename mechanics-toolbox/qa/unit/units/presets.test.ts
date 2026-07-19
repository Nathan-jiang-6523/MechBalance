import { describe, expect, it } from 'vitest'

import {
  convertPresetValue,
  getPresetUnit,
  getUnitPreset,
} from '../../../src/core/units'

describe('全局单位制预设契约', () => {
  it('工程预设默认 t-mm-N-MPa，SI 预设使用 kg-m-N-Pa', () => {
    expect(getUnitPreset('engineering').label).toContain('t–mm–s–N–MPa')
    expect(getPresetUnit('mass', 'engineering')).toBe('t')
    expect(getPresetUnit('length', 'engineering')).toBe('mm')
    expect(getPresetUnit('pressure', 'engineering')).toBe('MPa')
    expect(getPresetUnit('mass', 'si')).toBe('kg')
    expect(getPresetUnit('length', 'si')).toBe('m')
    expect(getPresetUnit('pressure', 'si')).toBe('Pa')
  })

  it('切换预设只改变显示值，不改变物理问题', () => {
    expect(convertPresetValue(1_000, 'length', 'engineering', 'si')).toBe(1)
    expect(convertPresetValue(2, 'pressure', 'engineering', 'si')).toBe(2_000_000)
    expect(convertPresetValue(2_000_000, 'pressure', 'si', 'engineering')).toBe(2)
  })

  it('空字段保持空', () => {
    expect(convertPresetValue(null, 'length', 'engineering', 'si')).toBeNull()
  })

  it('板线弯矩保留物理值并切换标签单位', () => {
    expect(getPresetUnit('momentPerLength', 'engineering')).toBe('N_mm_per_mm')
    expect(getPresetUnit('momentPerLength', 'si')).toBe('N_m_per_m')
    expect(convertPresetValue(478.863821, 'momentPerLength', 'engineering', 'si'))
      .toBeCloseTo(478.863821, 12)
  })

  it('非有限值沿用共享换算错误', () => {
    expect(() => convertPresetValue(Number.NaN, 'length', 'engineering', 'si'))
      .toThrow('换算输入必须是有限数值')
  })
})
