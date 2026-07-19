import { describe, expect, it } from 'vitest'
import { getStructuralExample, STRUCTURAL_EXAMPLES } from '../../../src/features/structural/examples'
import { runStructuralCalculation } from '../../../src/features/structural/calculation'

describe('P2 frozen UI examples', () => {
  it('registers the frozen and requested examples across all five analyses and returns defensive copies', () => {
    expect(STRUCTURAL_EXAMPLES.map(({ id }) => id)).toEqual([
      'BEAM-A01', 'CBEAM-A03',
      'TRUSS-A01', 'TRUSS-T01', 'TRUSS-IS01', 'TRUSS-SW01',
      'FRAME-A01', 'FRAME-A02', 'FRAME-A03', 'FRAME-T01', 'FRAME-IS01',
      'IL-A03', 'ML-A01',
    ])
    expect(getStructuralExample('BEAM-A01')).not.toBe(getStructuralExample('BEAM-A01'))
  })

  it('BEAM-A01 retains u/v/theta from the first P2 stage', () => {
    const result = runStructuralCalculation(getStructuralExample('BEAM-A01'))
    expect(result.status).toBe('success')
    if (result.status === 'error' || result.structural.analysis !== 'beam') return
    expect(result.structural.displacements.find(({ nodeId }) => nodeId === '2')).toMatchObject({
      u: { value: 0 },
      v: { value: expect.closeTo(-0.0333333333333, 10) },
      theta: { value: expect.closeTo(0, 12) },
    })
    expect(result.structural.reactions.filter(({ nodeId }) => nodeId !== '2').map(({ fy }) => fy.value))
      .toEqual([expect.closeTo(20_000, 6), expect.closeTo(20_000, 6)])
    expect(result.structural.controls.find(({ responseId, kind }) => responseId === 'bendingMoment' && kind === 'maximum'))
      .toMatchObject({ value: { value: expect.closeTo(40_000, 6) }, position: { value: 2 } })
    expect(result.structural.stations.filter(({ x }) => x.value === 2).map(({ side }) => side)).toEqual(['left', 'right'])
    expect(result.metadata.formulaReferences.map(({ id }) => id)).toEqual([
      'P2-EB-001', 'P2-EB-002', 'P2-DSM-001', 'P2-EB-RECOVERY-001', 'P2-CBEAM-001',
    ])
  })

  it('TRUSS-A01 and FRAME-A01 retain frozen controls', () => {
    const truss = runStructuralCalculation(getStructuralExample('TRUSS-A01'))
    expect(truss.status).toBe('success')
    if (truss.status !== 'error' && truss.structural.analysis === 'truss') {
      expect(truss.structural.elements.find(({ elementId }) => elementId === '13')?.axialForce.value)
        .toBeCloseTo(-60_092.5212577, 5)
      expect(truss.structural.elements.find(({ elementId }) => elementId === '12')?.axialForce.value)
        .toBeCloseTo(33_333.3333333, 5)
    }

    const frame = runStructuralCalculation(getStructuralExample('FRAME-A01'))
    expect(frame.status).toBe('success')
    if (frame.status !== 'error' && frame.structural.analysis === 'frame') {
      expect(frame.structural.displacements.find(({ nodeId }) => nodeId === '2')?.u.value)
        .toBeCloseTo(0.00130736068252, 10)
      expect(frame.structural.reactions.find(({ nodeId }) => nodeId === '1')?.mz?.value)
        .toBeCloseTo(10_648.3935378, 4)
    }
  })

  it('IL-A03 preserves the jump and ML-A01 finds the frozen maximum', () => {
    const influence = runStructuralCalculation(getStructuralExample('IL-A03'))
    expect(influence.status).toBe('success')
    if (influence.status !== 'error' && influence.structural.analysis === 'influence-line') {
      const atFour = influence.structural.ordinates.filter(({ position }) => position.value === 4)
      expect(atFour.map(({ ordinate }) => ordinate.value)).toEqual([
        expect.closeTo(-0.4, 12), expect.closeTo(0.6, 12),
      ])
    }

    const moving = runStructuralCalculation(getStructuralExample('ML-A01'))
    expect(moving.status).toBe('success')
    if (moving.status !== 'error' && moving.structural.analysis === 'moving-load') {
      expect(moving.structural.controls.find(({ kind }) => kind === 'maximum')).toMatchObject({
        value: { value: expect.closeTo(130_000, 6) },
        controllingAxleId: 'rear',
      })
    }
  })
})
