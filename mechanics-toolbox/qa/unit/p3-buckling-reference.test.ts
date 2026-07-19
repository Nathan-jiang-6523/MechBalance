import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/p3-buckling.json'
import { solvePlateBuckling, solveShellBuckling } from '../../src/core/plate-shell'

const close = (actual: number, expected: number, rtol = 1e-8) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * rtol)

describe('P3 屈曲独立公开对照', () => {
  it('简支方板经典 k=4 独立复算', () => {
    const f = fixture.plateSquare
    const d = f.e * f.t ** 3 / (12 * (1 - f.nu ** 2))
    const independent = 4 * Math.PI ** 2 * d / f.b ** 2
    close(independent, f.criticalLineLoad)
    const production = solvePlateBuckling({ calculatorId: 'plate-buckling', boundary: 'ssss-uniaxial', lengthXM: f.a, widthYM: f.b, thicknessM: f.t, material: { elasticModulusPa: f.e, poissonRatio: f.nu }, appliedCompressionNPerM: f.applied, maximumLongitudinalHalfWaves: 200 })
    close(production.criticalLineLoadNPerM, independent)
    expect(production.bucklingCoefficient).toBe(4)
  })

  it('NASA SP-8007 完美圆柱壳闭式独立复算', () => {
    const f = fixture.shell
    const independentStress = f.e * (f.t / f.radius) / Math.sqrt(3 * (1 - f.nu ** 2))
    const independentLineLoad = independentStress * f.t
    close(independentStress, f.criticalStress)
    close(independentLineLoad, f.criticalLineLoad)
    const production = solveShellBuckling({ calculatorId: 'shell-buckling', boundary: 'simply-supported-axial', lengthM: f.length, meanRadiusM: f.radius, thicknessM: f.t, material: { elasticModulusPa: f.e, poissonRatio: f.nu }, appliedCompressionNPerM: f.applied, maximumAxialHalfWaves: 200, maximumCircumferentialWaves: 200 })
    close(production.criticalStressPa, independentStress)
    close(production.criticalLineLoadNPerM, independentLineLoad)
    expect(production.warnings[0]).toContain('规范或试验折减')
  })
})
