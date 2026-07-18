import { solvePlaneStress } from './planeStress'
import type { BendingTorsionInput, BendingTorsionResult, RoundSectionInput } from './types'

interface RoundProperties {
  outerRadiusM: number
  secondMomentM4: number
  polarMomentM4: number
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label}必须是大于 0 的有限数值`)
}

export function calculateRoundSectionProperties(section: RoundSectionInput): RoundProperties {
  if (section.kind === 'solid-circle') {
    assertFinitePositive(section.diameterM, '直径')
    const diameter4 = section.diameterM ** 4
    const secondMomentM4 = (Math.PI * diameter4) / 64
    const polarMomentM4 = (Math.PI * diameter4) / 32
    if (![secondMomentM4, polarMomentM4].every((value) => Number.isFinite(value) && value > 0)) {
      throw new RangeError('圆截面性质超出数值范围')
    }
    return { outerRadiusM: section.diameterM / 2, secondMomentM4, polarMomentM4 }
  }

  assertFinitePositive(section.outerDiameterM, '外径')
  if (!Number.isFinite(section.innerDiameterM) || section.innerDiameterM < 0) {
    throw new RangeError('内径必须是大于等于 0 的有限数值')
  }
  if (section.innerDiameterM >= section.outerDiameterM) throw new RangeError('内径必须小于外径')
  const diameterDifference4 = section.outerDiameterM ** 4 - section.innerDiameterM ** 4
  const secondMomentM4 = (Math.PI * diameterDifference4) / 64
  const polarMomentM4 = (Math.PI * diameterDifference4) / 32
  if (![secondMomentM4, polarMomentM4].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError('圆管截面性质超出数值范围')
  }
  return { outerRadiusM: section.outerDiameterM / 2, secondMomentM4, polarMomentM4 }
}

/** Positive M gives tensile stress at the selected outer-fibre point; positive T gives positive tau_xy. */
export function solveBendingTorsion(input: BendingTorsionInput): BendingTorsionResult {
  if (![input.bendingMomentNm, input.torqueNm].every(Number.isFinite)) {
    throw new RangeError('弯矩和转矩必须是有限数值')
  }
  const properties = calculateRoundSectionProperties(input.section)
  const outerBendingStressPa =
    (input.bendingMomentNm * properties.outerRadiusM) / properties.secondMomentM4
  const outerTorsionalShearPa =
    (input.torqueNm * properties.outerRadiusM) / properties.polarMomentM4
  if (![outerBendingStressPa, outerTorsionalShearPa].every(Number.isFinite)) {
    throw new RangeError('弯扭应力超出数值范围')
  }
  const planeInput = {
    sigmaXPa: Object.is(outerBendingStressPa, -0) ? 0 : outerBendingStressPa,
    sigmaYPa: 0,
    tauXyPa: Object.is(outerTorsionalShearPa, -0) ? 0 : outerTorsionalShearPa,
    ...(input.strengthPa === undefined ? {} : { strengthPa: input.strengthPa }),
  }
  return {
    section: input.section,
    ...properties,
    outerBendingStressPa: planeInput.sigmaXPa,
    outerTorsionalShearPa: planeInput.tauXyPa,
    stress: solvePlaneStress(planeInput),
  }
}
