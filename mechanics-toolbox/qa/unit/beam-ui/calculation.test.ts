import { describe, expect, it } from 'vitest'

import { runBeamCalculation } from '../../../src/features/beam/calculation'
import {
  buildBeamModel,
} from '../../../src/features/beam/input/adapter'
import { createDefaultBeamInputDraft } from '../../../src/features/beam/input/input-types'

describe('beam integrated calculation chain', () => {
  it('reproduces BEAM-SS-P-01 deformation and stress chain', () => {
    const built = buildBeamModel(createDefaultBeamInputDraft())
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const calculated = runBeamCalculation(built.value)
    expect(calculated.ok).toBe(true)
    if (!calculated.ok) return

    expect(calculated.value.solution.reactions.leftForceN).toBeCloseTo(6_000, 9)
    expect(calculated.value.solution.reactions.rightForceN).toBeCloseTo(4_000, 9)
    expect(calculated.value.extrema.deflectionM.minimum.xM * 1_000).toBeCloseTo(
      470.849738,
      5,
    )
    expect(calculated.value.stressSummary.topBendingStressPa / 1e6).toBeCloseTo(-15, 9)
    expect(calculated.value.stressSummary.bottomBendingStressPa / 1e6).toBeCloseTo(15, 9)
    expect(calculated.value.stressSummary.shear.supported).toBe(true)
    if (calculated.value.stressSummary.shear.supported) {
      expect(
        calculated.value.stressSummary.shear.maximumShearStressPa / 1e6,
      ).toBeCloseTo(0.9375, 9)
    }
  })

  it('disables shear stress recovery for circular sections', () => {
    const draft = createDefaultBeamInputDraft()
    draft.section = {
      kind: 'solidCircle',
      dimensions: { diameter: { value: '100', unit: 'mm' } },
    }
    const built = buildBeamModel(draft)
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const calculated = runBeamCalculation(built.value)
    expect(calculated.ok).toBe(true)
    if (!calculated.ok) return
    expect(calculated.value.stressSummary.shear).toEqual({
      supported: false,
      message: '当前截面暂不支持剪应力恢复',
    })
  })
})
