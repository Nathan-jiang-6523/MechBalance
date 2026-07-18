import type { MaterialPreset } from './types'

const presets = {
  'al-6061-t6': {
    id: 'al-6061-t6',
    name: 'AL 6061',
    condition: 'T6',
    elasticModulusPa: 69_000_000_000,
    densityKgM3: 2_700,
    editable: true,
    nominalOnly: true,
    warning: '名义预设值，不是材料批次保证值；请按实际材料证明书覆盖。',
    sources: [
      {
        title: 'Density of Metals',
        url: 'https://www.thyssenkrupp-materials.co.uk/technical-knowledge-hub/density-of-metal',
        accessedOn: '2026-07-18',
        supports: 'density',
      },
      {
        title: 'Density of Metals',
        url: 'https://www.thyssenkrupp-materials.co.uk/technical-knowledge-hub/density-of-metal',
        accessedOn: '2026-07-18',
        supports: 'elastic-modulus',
      },
    ],
  },
  spcc: {
    id: 'spcc',
    name: 'SPCC',
    condition: '通用名义预设',
    elasticModulusPa: 205_000_000_000,
    densityKgM3: 7_870,
    editable: true,
    nominalOnly: true,
    warning: '非 JIS 保证值；请按牌号、供货状态和材料证明书覆盖。',
    sources: [
      {
        title: 'Cold-Rolled Steel Sheets and Coils',
        url: 'https://www.nipponsteel.com/product/catalog_download/__icsFiles/afieldfile/2025/09/11/U003en.pdf',
        accessedOn: '2026-07-18',
        supports: 'designation',
      },
      {
        title: 'Nippon Steel Technical Report No. 135',
        url: 'https://www.nipponsteel.com/en/tech/report/pdf/135-04s.pdf',
        accessedOn: '2026-07-18',
        supports: 'elastic-modulus',
      },
    ],
  },
} as const satisfies Record<MaterialPreset['id'], MaterialPreset>

export type MaterialPresetId = keyof typeof presets

/** Returns a copy so calculator fields can be edited without mutating the registry. */
export function getMaterialPreset(id: MaterialPresetId): MaterialPreset {
  const preset = presets[id]
  return {
    ...preset,
    sources: preset.sources.map((source) => ({ ...source })),
  }
}

export function listMaterialPresets(): MaterialPreset[] {
  return (Object.keys(presets) as MaterialPresetId[]).map(getMaterialPreset)
}
