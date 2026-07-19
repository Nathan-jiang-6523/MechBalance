import { describe, expect, it } from 'vitest'
import { convertFromSI, normalizeToSI, type QuantityId, type UnitId } from '../../src/core/units'
import { solveCircularPlate, solvePlateBuckling, solveShellBuckling } from '../../src/core/plate-shell'

function si(value: number, quantity: QuantityId, unit: UnitId): number { return normalizeToSI(value, quantity, unit) }
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(1e-12, Math.abs(b) * 1e-12))

describe('P3 工程/SI 跨单位回归', () => {
  it('圆板工程字段与 SI 字段表示同一物理问题', () => {
    const engineering = solveCircularPlate({ calculatorId: 'circular-plate', boundary: 'clamped', radiusM: si(1000,'length','mm'), thicknessM: si(20,'length','mm'), material: { elasticModulusPa: si(200000,'elasticModulus','MPa'), poissonRatio: .3 }, pressurePa: si(.01,'pressure','MPa'), evaluationRadiusM: 0 })
    const metric = solveCircularPlate({ calculatorId: 'circular-plate', boundary: 'clamped', radiusM: si(1,'length','m'), thicknessM: si(.02,'length','m'), material: { elasticModulusPa: si(2e11,'elasticModulus','Pa'), poissonRatio: .3 }, pressurePa: si(10000,'pressure','Pa'), evaluationRadiusM: 0 })
    close(engineering.points[0].deflectionM, metric.points[0].deflectionM)
    close(engineering.points[0].radialMomentN, metric.points[0].radialMomentN)
  })

  it('板与圆柱壳屈曲工程字段与 SI 字段等价', () => {
    const plateEngineering = solvePlateBuckling({ calculatorId:'plate-buckling', boundary:'ssss-uniaxial', lengthXM:si(1000,'length','mm'), widthYM:si(1000,'length','mm'), thicknessM:si(20,'length','mm'), material:{elasticModulusPa:si(200000,'elasticModulus','MPa'),poissonRatio:.3}, appliedCompressionNPerM:si(1000,'lineLoad','N_per_mm'), maximumLongitudinalHalfWaves:200 })
    const plateSI = solvePlateBuckling({ calculatorId:'plate-buckling', boundary:'ssss-uniaxial', lengthXM:1, widthYM:1, thicknessM:.02, material:{elasticModulusPa:200e9,poissonRatio:.3}, appliedCompressionNPerM:1e6, maximumLongitudinalHalfWaves:200 })
    close(plateEngineering.criticalLineLoadNPerM, plateSI.criticalLineLoadNPerM)
    const shellEngineering = solveShellBuckling({ calculatorId:'shell-buckling', boundary:'simply-supported-axial', lengthM:si(1000,'length','mm'), meanRadiusM:si(500,'length','mm'), thicknessM:si(5,'length','mm'), material:{elasticModulusPa:si(200000,'elasticModulus','MPa'),poissonRatio:.3}, appliedCompressionNPerM:si(1000,'lineLoad','N_per_mm'), maximumAxialHalfWaves:200, maximumCircumferentialWaves:200 })
    const shellSI = solveShellBuckling({ calculatorId:'shell-buckling', boundary:'simply-supported-axial', lengthM:1, meanRadiusM:.5, thicknessM:.005, material:{elasticModulusPa:200e9,poissonRatio:.3}, appliedCompressionNPerM:1e6, maximumAxialHalfWaves:200, maximumCircumferentialWaves:200 })
    close(shellEngineering.criticalStressPa, shellSI.criticalStressPa)
    close(convertFromSI(shellEngineering.criticalLineLoadNPerM,'lineLoad','N_per_mm'), 6052.275326685)
  })
})
