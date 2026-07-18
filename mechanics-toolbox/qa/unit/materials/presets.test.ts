import { describe, expect, it } from 'vitest'

import { getMaterialPreset, listMaterialPresets } from '../../../src/core/materials'

describe('material presets', () => {
  it('registers only confirmed first-release materials', () => {
    expect(listMaterialPresets().map(({ id }) => id)).toEqual(['al-6061-t6', 'spcc'])
  })

  it('stores AL6061-T6 nominal values in SI', () => {
    const material = getMaterialPreset('al-6061-t6')
    expect(material.elasticModulusPa).toBe(69e9)
    expect(material.densityKgM3).toBe(2_700)
    expect(material.editable).toBe(true)
    expect(material.nominalOnly).toBe(true)
  })

  it('marks SPCC values as non-guaranteed', () => {
    const material = getMaterialPreset('spcc')
    expect(material.elasticModulusPa).toBe(205e9)
    expect(material.densityKgM3).toBe(7_870)
    expect(material.warning).toContain('非 JIS 保证值')
  })

  it('returns a fresh editable copy', () => {
    const first = getMaterialPreset('al-6061-t6')
    first.elasticModulusPa = 70e9
    expect(getMaterialPreset('al-6061-t6').elasticModulusPa).toBe(69e9)
  })

  it('keeps source and access date for every preset', () => {
    for (const material of listMaterialPresets()) {
      expect(material.sources.length).toBeGreaterThan(0)
      for (const source of material.sources) {
        expect(source.url).toMatch(/^https:\/\//)
        expect(source.accessedOn).toBe('2026-07-18')
      }
    }
  })
})
