import { describe, expect, it } from 'vitest'
import thinFixture from '../fixtures/p3-thin-cylinder.json'
import lameFixture from '../fixtures/p3-lame-cylinder.json'
import { solveLameCylinder, solveThinCylinder, type LameCylinderInput, type ThinCylinderInput } from '../../src/core/plate-shell'

const close = (actual: number, expected: number, rtol = 1e-10) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-8, Math.abs(expected) * rtol))

describe('P3 圆筒独立公开对照', () => {
  it('USAF 薄壁膜平衡式独立复算封闭端', () => {
    const source = thinFixture.cases[0]!
    const { meanRadiusM: r, thicknessM: t, internalPressurePa: pi, externalPressurePa: po } = source.input
    const independentHoop = (pi - po) * r / t
    const independentAxial = independentHoop / 2
    close(independentHoop, source.expected.hoopPa!)
    close(independentAxial, source.expected.axialPa!)
    const input: ThinCylinderInput = { calculatorId: 'thin-cylinder', boundary: 'closed', geometry: { kind: 'thin-cylinder', meanRadiusM: r, thicknessM: t }, material: thinFixture.commonMaterial, load: { internalPressurePa: pi, externalPressurePa: po, axialForceN: 0, torqueNm: 0 } }
    const production = solveThinCylinder(input)
    close(production.stresses.hoopPa, independentHoop)
    close(production.stresses.axialTotalPa, independentAxial)
  })

  it('USAF Lamé 两常数场独立复算三处应力', () => {
    const source = lameFixture.cases[0]!
    const { ri, ro, pi, po } = source
    const a = (pi * ri ** 2 - po * ro ** 2) / (ro ** 2 - ri ** 2)
    const b = (pi - po) * ri ** 2 * ro ** 2 / (ro ** 2 - ri ** 2)
    const field = (r: number) => ({ radial: a - b / r ** 2, hoop: a + b / r ** 2 })
    for (const expected of source.expected.points!) {
      const independent = field(expected.r)
      close(independent.radial, expected.sr)
      close(independent.hoop, expected.sh)
    }
    const input: LameCylinderInput = { calculatorId: 'lame-cylinder', boundary: 'closed', geometry: { kind: 'lame-cylinder', innerRadiusM: ri, outerRadiusM: ro }, material: lameFixture.commonMaterial, load: { internalPressurePa: pi, externalPressurePa: po, axialForceN: 0 }, evaluationRadiusM: source.r }
    const production = solveLameCylinder(input)
    production.points.forEach((point) => { const independent = field(point.radiusM); close(point.radialStressPa, independent.radial); close(point.hoopStressPa, independent.hoop) })
  })
})
