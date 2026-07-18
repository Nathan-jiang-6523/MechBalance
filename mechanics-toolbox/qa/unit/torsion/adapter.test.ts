import { describe, expect, it } from 'vitest'
import {
  buildCircularShaftInput,
  buildPowerTransmissionInput,
  calculateCircularShaftDraft,
  calculatePowerTransmissionDraft,
  createDefaultCircularShaftDraft,
  createDefaultPowerTransmissionDraft,
  resolveCircularShaftShearModulusPa,
} from '../../../src/features/torsion'

describe('torsion UI adapters', () => {
  it('normalizes default engineering shaft units to SI', () => {
    expect(buildCircularShaftInput(createDefaultCircularShaftDraft())).toEqual({
      kind: 'solid', diameterM: 0.05, lengthM: 1, shearModulusPa: 200e9 / 2.6, torqueNm: 1000,
    })
  })

  it('produces identical results from E + ν and direct G input modes', () => {
    const engineering = calculateCircularShaftDraft(createDefaultCircularShaftDraft())
    const alternate = createDefaultCircularShaftDraft()
    alternate.diameter = { value: '0.05', unit: 'm' }
    alternate.length = { value: '1', unit: 'm' }
    alternate.elasticConstantInputMode = 'shearModulus'
    alternate.shearModulus = { value: String(200 / 2.6), unit: 'GPa' }
    alternate.torque = { value: '1', unit: 'kN_m' }
    const siFriendly = calculateCircularShaftDraft(alternate)
    expect(siFriendly.torsionConstantM4).toBeCloseTo(engineering.torsionConstantM4, 16)
    expect(siFriendly.maximumShearStressPa).toBeCloseTo(engineering.maximumShearStressPa, 6)
    expect(siFriendly.twistAngleRad).toBeCloseTo(engineering.twistAngleRad, 13)
  })

  it('rejects a Poisson ratio outside the isotropic elastic range', () => {
    const draft = createDefaultCircularShaftDraft()
    draft.poissonRatio = '0.5'
    expect(() => resolveCircularShaftShearModulusPa(draft)).toThrow('-1 < ν < 0.5')
  })

  it('only includes two known values for each power solve mode', () => {
    const draft = createDefaultPowerTransmissionDraft()
    expect(buildPowerTransmissionInput(draft)).toEqual({
      solveFor: 'torque', powerW: 10000, rotationalSpeedRps: 25,
    })
    draft.solveFor = 'power'
    draft.torque.value = '100000'
    expect(buildPowerTransmissionInput(draft)).toEqual({
      solveFor: 'power', torqueNm: 100, rotationalSpeedRps: 25,
    })
  })

  it('normalizes rpm/kW/N·mm and returns engineering benchmark', () => {
    const result = calculatePowerTransmissionDraft(createDefaultPowerTransmissionDraft())
    expect(result.torqueNm * 1000).toBeCloseTo(63661.9772368, 6)
  })
})
