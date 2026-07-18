import { describe, expect, it } from 'vitest'

import { buildBeamModel } from '../../../src/features/beam/input/adapter'
import {
  changeDirectionMode,
  createDefaultBeamInputDraft,
  createEmptyLoad,
  createSectionDraft,
  type BeamInputDraft,
  type PointForceDraft,
} from '../../../src/features/beam/input/input-types'

function built(draft: BeamInputDraft) {
  const result = buildBeamModel(draft)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.value
}

describe('beam input adapter', () => {
  it('builds default BEAM-SS-P-01 in SI from a 96 × 100 mm rectangle', () => {
    const value = built(createDefaultBeamInputDraft())
    expect(value.lengthM).toBeCloseTo(1, 14)
    expect(value.elasticModulusPa).toBeCloseTo(200e9, 3)
    expect(value.secondMomentM4).toBeCloseTo(8e-6, 16)
    expect(value.sectionHeightM).toBeCloseTo(0.1, 14)
    expect(value.sectionKind).toBe('rectangle')
    expect(value.sectionInput).toEqual({ kind: 'rectangle', widthM: 0.096, heightM: 0.1 })
    expect(value.loads).toEqual([{ type: 'pointForce', positionM: 0.4, forceN: -10_000 }])
  })

  it('merges coincident entries only after validating raw count', () => {
    const draft = createDefaultBeamInputDraft()
    const second: PointForceDraft = {
      ...draft.loads[0] as PointForceDraft,
      id: 'load-2',
      magnitude: { value: '2000', unit: 'N' },
      direction: 'up',
    }
    const value = built({ ...draft, loads: [...draft.loads, second] })
    expect(value.loads).toEqual([{ type: 'pointForce', positionM: 0.4, forceN: -8_000 }])

    const eleven = Array.from({ length: 11 }, (_, index) => ({ ...second, id: `load-${index}` }))
    const invalid = buildBeamModel({ ...draft, loads: eleven })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.errors).toContainEqual({
      field: 'loads',
      message: '原始载荷合计最多 10 项（后台合并前计数）',
    })
  })

  it('enforces mutually exclusive direction modes and preserves physical sign', () => {
    const magnitudeDraft = createDefaultBeamInputDraft()
    const signedDraft = changeDirectionMode(magnitudeDraft, 'signed')
    expect(signedDraft.directionMode).toBe('signed')
    expect(signedDraft.loads[0]?.magnitude.value).toBe('-10000')
    expect(built(signedDraft).loads[0]).toMatchObject({ forceN: -10_000 })

    const magnitudeAgain = changeDirectionMode(signedDraft, 'magnitudeDirection')
    expect(magnitudeAgain.loads[0]).toMatchObject({
      magnitude: { value: '10000' },
      direction: 'down',
    })
  })

  it('rejects negative magnitude in magnitude-plus-direction mode', () => {
    const draft = createDefaultBeamInputDraft()
    const load = draft.loads[0] as PointForceDraft
    const result = buildBeamModel({
      ...draft,
      loads: [{ ...load, magnitude: { ...load.magnitude, value: '-1' } }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some(({ field, message }) =>
      field === 'loads.0.magnitude' && message.includes('不得为负数'))).toBe(true)
  })

  it('applies support-specific point-force position limits', () => {
    const draft = createDefaultBeamInputDraft()
    const load = draft.loads[0] as PointForceDraft
    const atEnd = { ...load, position: { value: '1000', unit: 'mm' as const } }
    const simple = buildBeamModel({ ...draft, loads: [atEnd] })
    expect(simple.ok).toBe(false)
    if (!simple.ok) expect(simple.errors.some(({ message }) => message.includes('0 < a < L'))).toBe(true)

    expect(buildBeamModel({ ...draft, support: 'cantileverLeft', loads: [atEnd] }).ok).toBe(true)
    const atLeft = { ...atEnd, position: { value: '0', unit: 'mm' as const } }
    expect(buildBeamModel({ ...draft, support: 'cantileverRight', loads: [atLeft] }).ok).toBe(true)
  })

  it('uses section core for every supported geometry and reports invalid geometry', () => {
    for (const kind of ['rectangle', 'hollowRectangle', 'solidCircle', 'circularTube'] as const) {
      const draft = createDefaultBeamInputDraft()
      const value = built({ ...draft, section: createSectionDraft(kind) })
      expect(value.sectionKind).toBe(kind)
      expect(value.secondMomentM4).toBeGreaterThan(0)
      expect(value.sectionHeightM).toBeGreaterThan(0)
    }

    const draft = createDefaultBeamInputDraft()
    const hollow = createSectionDraft('hollowRectangle')
    hollow.dimensions.innerWidth = { value: '101', unit: 'mm' }
    const invalid = buildBeamModel({ ...draft, section: hollow })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.errors.some(({ field }) => field === 'section.innerWidth')).toBe(true)
  })

  it('supports point moments and partial uniform loads with compatible units', () => {
    const draft = createDefaultBeamInputDraft()
    const moment = createEmptyLoad('m', 'pointMoment')
    const uniform = createEmptyLoad('q', 'uniformLoad')
    if (moment.type !== 'pointMoment' || uniform.type !== 'uniformLoad') throw new Error('fixture type')
    moment.position = { value: '0.5', unit: 'm' }
    moment.magnitude = { value: '1', unit: 'kN_m' }
    uniform.start = { value: '250', unit: 'mm' }
    uniform.end = { value: '750', unit: 'mm' }
    uniform.magnitude = { value: '10', unit: 'kN_per_m' }
    const value = built({ ...draft, loads: [moment, uniform] })
    expect(value.loads).toEqual([
      { type: 'pointMoment', positionM: 0.5, momentNm: 1000 },
      { type: 'uniformLoad', startM: 0.25, endM: 0.75, intensityNPerM: -10_000 },
    ])
  })
})
