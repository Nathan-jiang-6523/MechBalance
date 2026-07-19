import { describe, expect, it } from 'vitest'

import beamFixture from '../../fixtures/p2-beam.json'
import cbeamFixture from '../../fixtures/p2-cbeam.json'
import frameFixture from '../../fixtures/p2-frame.json'
import influenceMovingFixture from '../../fixtures/p2-influence-moving.json'
import trussFixture from '../../fixtures/p2-truss.json'
import { runStructuralCalculation } from '../../../src/features/structural/calculation'
import { getStructuralExample, STRUCTURAL_EXAMPLES, type StructuralExample } from '../../../src/features/structural/examples'

type ExampleId = StructuralExample['id']

function calculate(id: ExampleId) {
  const result = runStructuralCalculation(getStructuralExample(id))
  if (result.status === 'error') {
    throw new Error(`${id} failed: ${result.messages.map(({ code, message }) => `${code}: ${message}`).join('; ')}`)
  }
  return result.structural
}

function fixtureCases(fixture: { readonly cases: readonly { readonly id: string }[] }): readonly string[] {
  return fixture.cases.map(({ id }) => id)
}

describe('P2 additional frozen UI examples', () => {
  it('links every UI example to an existing frozen fixture case and version', () => {
    const fixtureIndex = {
      'qa/fixtures/p2-beam.json': {
        version: beamFixture.fixtureVersion,
        cases: fixtureCases(beamFixture),
      },
      'qa/fixtures/p2-cbeam.json': {
        version: cbeamFixture.fixtureVersion,
        cases: fixtureCases(cbeamFixture),
      },
      'qa/fixtures/p2-truss.json': {
        version: trussFixture.fixtureVersion,
        cases: fixtureCases(trussFixture),
      },
      'qa/fixtures/p2-frame.json': {
        version: frameFixture.fixtureVersion,
        cases: fixtureCases(frameFixture),
      },
      'qa/fixtures/p2-influence-moving.json': {
        version: influenceMovingFixture.fixtureVersion,
        cases: fixtureCases(influenceMovingFixture),
      },
    } as const

    for (const example of STRUCTURAL_EXAMPLES) {
      const source = fixtureIndex[example.fixtureSource.path as keyof typeof fixtureIndex]
      expect(source, `${example.id} fixture path`).toBeDefined()
      expect(example.fixtureSource.fixtureVersion, `${example.id} fixture version`).toBe(source.version)
      expect(source.cases, `${example.id} fixture case`).toContain(example.fixtureSource.caseId)
    }
  })

  it('calculates CBEAM-A03 fixed-pinned beam truth', () => {
    const data = calculate('CBEAM-A03')
    if (data.analysis !== 'beam') throw new Error('beam result expected')

    expect(data.reactions.find(({ nodeId }) => nodeId === '1')).toMatchObject({
      fy: { value: expect.closeTo(25_000, 5) },
      mz: { value: expect.closeTo(20_000, 5) },
    })
    expect(data.reactions.find(({ nodeId }) => nodeId === '2')?.fy.value).toBeCloseTo(15_000, 5)
    expect(data.displacements.find(({ nodeId }) => nodeId === '2')?.theta.value)
      .toBeCloseTo(0.00833333333333, 10)
  })

  it('calculates truss temperature, initial strain, and self-weight truths', () => {
    const thermal = calculate('TRUSS-T01')
    if (thermal.analysis !== 'truss') throw new Error('truss result expected')
    expect(thermal.displacements.find(({ nodeId }) => nodeId === '2')?.u.value).toBeCloseTo(0.0012, 12)
    expect(thermal.elements[0]?.axialForce.value).toBeCloseTo(0, 6)

    const initialStrain = calculate('TRUSS-IS01')
    if (initialStrain.analysis !== 'truss') throw new Error('truss result expected')
    expect(initialStrain.elements[0]).toMatchObject({
      axialForce: { value: expect.closeTo(-100_000, 5) },
      stress: { value: expect.closeTo(-100e6, 5) },
      state: 'compression',
    })
    expect(initialStrain.reactions.find(({ nodeId }) => nodeId === '1')?.fx.value).toBeCloseTo(100_000, 5)
    expect(initialStrain.reactions.find(({ nodeId }) => nodeId === '2')?.fx.value).toBeCloseTo(-100_000, 5)

    const selfWeight = calculate('TRUSS-SW01')
    if (selfWeight.analysis !== 'truss') throw new Error('truss result expected')
    expect(selfWeight.reactions.map(({ fy }) => fy.value)).toEqual([
      expect.closeTo(76.9822025, 8),
      expect.closeTo(76.9822025, 8),
    ])
    expect(selfWeight.elements[0]?.axialForce.value).toBeCloseTo(0, 6)
  })

  it('calculates frame full-span and partial distributed-load truths', () => {
    const fullSpan = calculate('FRAME-A02')
    if (fullSpan.analysis !== 'frame') throw new Error('frame result expected')
    expect(fullSpan.reactions.find(({ nodeId }) => nodeId === '1')).toMatchObject({
      fy: { value: expect.closeTo(20_000, 5) },
      mz: { value: expect.closeTo(13_333.3333333333, 5) },
    })
    expect(fullSpan.reactions.find(({ nodeId }) => nodeId === '2')).toMatchObject({
      fy: { value: expect.closeTo(20_000, 5) },
      mz: { value: expect.closeTo(-13_333.3333333333, 5) },
    })

    const partial = calculate('FRAME-A03')
    if (partial.analysis !== 'frame') throw new Error('frame result expected')
    expect(partial.reactions.find(({ nodeId }) => nodeId === '1')?.fy.value).toBeCloseTo(15_000, 5)
    expect(partial.reactions.find(({ nodeId }) => nodeId === '2')?.fy.value).toBeCloseTo(5_000, 5)
    expect(partial.displacements.find(({ nodeId }) => nodeId === '1')?.theta.value).toBeCloseTo(-0.0009375, 11)
    expect(partial.displacements.find(({ nodeId }) => nodeId === '2')?.theta.value)
      .toBeCloseTo(0.000729166666666667, 11)
    expect(partial.controls.find(({ responseId, kind }) => responseId === 'bendingMoment' && kind === 'maximum'))
      .toMatchObject({ value: { value: expect.closeTo(11_250, 5) }, position: { value: expect.closeTo(1.5, 10) } })
  })

  it('calculates frame temperature and initial-strain truths', () => {
    const thermal = calculate('FRAME-T01')
    if (thermal.analysis !== 'frame') throw new Error('frame result expected')
    expect(thermal.reactions.find(({ nodeId }) => nodeId === '1')?.fx.value).toBeCloseTo(120_000, 5)
    expect(thermal.reactions.find(({ nodeId }) => nodeId === '2')?.fx.value).toBeCloseTo(-120_000, 5)
    expect(thermal.stations[0]?.axialForce?.value).toBeCloseTo(-120_000, 5)

    const initialStrain = calculate('FRAME-IS01')
    if (initialStrain.analysis !== 'frame') throw new Error('frame result expected')
    expect(initialStrain.reactions.find(({ nodeId }) => nodeId === '1')?.fx.value).toBeCloseTo(100_000, 5)
    expect(initialStrain.reactions.find(({ nodeId }) => nodeId === '2')?.fx.value).toBeCloseTo(-100_000, 5)
    expect(initialStrain.stations[0]?.axialForce?.value).toBeCloseTo(-100_000, 5)
  })
})
