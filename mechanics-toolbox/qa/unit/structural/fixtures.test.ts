import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

interface FrozenCase {
  readonly id: string
  readonly title: string
  readonly status: string
  readonly inputs: string
  readonly expected: string
  readonly tolerance: string
  readonly source: string
  readonly excluded?: boolean
  readonly errors?: readonly {
    readonly code?: string
    readonly field?: string
    readonly message?: string
  }[]
}

interface FixtureDocument {
  readonly schemaVersion: string
  readonly source: string
  readonly frozenAt: string
  readonly truthPolicy: string
  readonly cases: readonly FrozenCase[]
}

const fixtureNames = [
  'p2-beam.json',
  'p2-cbeam.json',
  'p2-truss.json',
  'p2-frame.json',
  'p2-influence-moving.json',
  'p2-ui-offline.json',
] as const

const expectedIdsByFixture = {
  'p2-beam.json': ['P2-BEAM-E01', 'P2-BEAM-E02', 'P2-BEAM-E03', 'P2-BEAM-A01', 'P2-BEAM-A02', 'P2-BEAM-A03', 'P2-BEAM-A04', 'P2-BEAM-A05', 'P2-BEAM-A06', 'P2-BEAM-C01', 'P2-BEAM-N01', 'P2-BEAM-N02'],
  'p2-cbeam.json': ['P2-CBEAM-A03', 'P2-CBEAM-A05', 'P2-CBEAM-A04', 'P2-CBEAM-X01'],
  'p2-truss.json': ['P2-TRUSS-E01', 'P2-TRUSS-A01', 'P2-TRUSS-A02', 'P2-TRUSS-T01', 'P2-TRUSS-IS01', 'P2-TRUSS-SW01', 'P2-TRUSS-N01', 'P2-TRUSS-X01'],
  'p2-frame.json': ['P2-FRAME-E01', 'P2-FRAME-A01', 'P2-FRAME-A02', 'P2-FRAME-A03', 'P2-FRAME-T01', 'P2-FRAME-IS01', 'P2-FRAME-N01', 'P2-FRAME-X01'],
  'p2-influence-moving.json': ['P2-IL-A01', 'P2-IL-A02', 'P2-IL-A03', 'P2-ML-A01', 'P2-ML-A02', 'P2-ML-A03'],
  'p2-ui-offline.json': ['P2-UI-01', 'P2-UI-02', 'P2-UI-03', 'P2-UI-04'],
} as const satisfies Readonly<Record<(typeof fixtureNames)[number], readonly string[]>>

function readFixture(name: (typeof fixtureNames)[number]): FixtureDocument {
  const fixturePath = path.resolve(process.cwd(), 'qa', 'fixtures', name)
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as FixtureDocument
}

describe('P2 frozen acceptance fixtures', () => {
  it('keeps six parseable documents with frozen provenance', () => {
    const documents = fixtureNames.map(readFixture)

    expect(documents.map(({ cases }) => cases.length)).toEqual([12, 4, 8, 8, 6, 4])
    for (const document of documents) {
      expect(document).toMatchObject({
        schemaVersion: '1.0.0',
        source: 'ai/memory-bank/p2-acceptance-cases-form.md',
        frozenAt: '2026-07-19',
      })
      expect(document.truthPolicy).not.toBe('')
    }
    for (const name of fixtureNames) {
      expect(readFixture(name).cases.map(({ id }) => id)).toEqual(expectedIdsByFixture[name])
    }
  })

  it('keeps exactly 42 unique, reviewable case records', () => {
    const cases = fixtureNames.flatMap((name) => readFixture(name).cases)
    const ids = cases.map(({ id }) => id)

    expect(cases).toHaveLength(42)
    expect(new Set(ids).size).toBe(42)
    for (const fixtureCase of cases) {
      expect(fixtureCase.id).toMatch(/^P2-(BEAM|CBEAM|TRUSS|FRAME|IL|ML|UI)-/)
      expect([
        'confirmed-three-independent-reviews',
        'confirmed-excluded-feature',
      ]).toContain(fixtureCase.status)
      expect(fixtureCase.tolerance).not.toBe('')
      expect(fixtureCase.source).not.toBe('')
      expect(fixtureCase.title).not.toBe('')
      expect(fixtureCase.inputs).not.toBe('')
      expect(fixtureCase.expected).not.toBe('')
    }
  })

  it('keeps the internal-hinge/end-release exclusion executable', () => {
    const cbeam = readFixture('p2-cbeam.json')
    const excluded = cbeam.cases.find(({ id }) => id === 'P2-CBEAM-A04')

    expect(excluded).toMatchObject({
      status: 'confirmed-excluded-feature',
      excluded: true,
      errors: [{
        code: 'P2_FEATURE_NOT_INCLUDED',
        field: 'elements[0].releaseJMz',
        message: 'P2 未纳入梁端弯矩释放/内部铰',
      }],
    })
  })

  it('keeps frozen negative-case error codes and fields', () => {
    const cases = fixtureNames.flatMap((name) => readFixture(name).cases)
    const errors = (id: string) => cases.find((fixtureCase) => fixtureCase.id === id)?.errors

    expect(errors('P2-BEAM-N01')).toMatchObject([{ code: 'P2_SINGULAR_STIFFNESS', field: 'constraints' }])
    expect(errors('P2-BEAM-N02')?.map(({ code }) => code)).toEqual([
      'P2_NONFINITE_INPUT',
      'P2_NONPOSITIVE_PROPERTY',
      'P2_ZERO_LENGTH_ELEMENT',
    ])
    expect(errors('P2-TRUSS-N01')).toMatchObject([{ code: 'P2_SINGULAR_STIFFNESS', field: 'constraints' }])
    expect(errors('P2-FRAME-N01')?.map(({ code, field }) => ({ code, field }))).toEqual([
      { code: 'P2_SINGULAR_STIFFNESS', field: 'constraints' },
      { code: 'P2_ZERO_LENGTH_ELEMENT', field: 'elements[0].nodeJ' },
    ])
    expect(errors('P2-ML-A03')?.map(({ code, field }) => ({ code, field }))).toEqual([
      { code: 'P2_NONPOSITIVE_PROPERTY', field: 'movingLoad.dynamicFactor' },
      { code: 'P2_NONFINITE_INPUT', field: 'movingLoad.dynamicFactor' },
    ])
  })
})
