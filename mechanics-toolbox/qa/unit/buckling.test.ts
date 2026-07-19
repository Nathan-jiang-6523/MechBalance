import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/p3-buckling.json'
import { IDEAL_BUCKLING_WARNING, solvePlateBuckling, solveShellBuckling, type PlateBucklingInput, type ShellBucklingInput } from '../../src/core/plate-shell'

const plate = (patch: Partial<PlateBucklingInput> = {}): PlateBucklingInput => ({
  calculatorId: 'plate-buckling', boundary: 'ssss-uniaxial', lengthXM: fixture.plateSquare.a,
  widthYM: fixture.plateSquare.b, thicknessM: fixture.plateSquare.t,
  material: { elasticModulusPa: fixture.plateSquare.e, poissonRatio: fixture.plateSquare.nu },
  appliedCompressionNPerM: fixture.plateSquare.applied, maximumLongitudinalHalfWaves: 200, ...patch,
})
const shell = (patch: Partial<ShellBucklingInput> = {}): ShellBucklingInput => ({
  calculatorId: 'shell-buckling', boundary: 'simply-supported-axial', lengthM: fixture.shell.length,
  meanRadiusM: fixture.shell.radius, thicknessM: fixture.shell.t,
  material: { elasticModulusPa: fixture.shell.e, poissonRatio: fixture.shell.nu },
  appliedCompressionNPerM: fixture.shell.applied, maximumAxialHalfWaves: 200,
  maximumCircumferentialWaves: 200, ...patch,
})
const close = (actual: number, expected: number, rtol = fixture.tolerance.relative) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * rtol)

describe('板与圆柱壳屈曲', () => {
  it('方板基准与量纲', () => {
    const result = solvePlateBuckling(plate())
    expect(result.longitudinalHalfWaves).toBe(fixture.plateSquare.m)
    expect(result.transverseHalfWaves).toBe(fixture.plateSquare.n)
    close(result.bucklingCoefficient, fixture.plateSquare.k)
    close(result.criticalLineLoadNPerM, fixture.plateSquare.criticalLineLoad)
    close(result.criticalStressPa, fixture.plateSquare.criticalStress)
    close(result.criticalTotalForceN, fixture.plateSquare.criticalForce)
  })
  it('板长宽比改变会切换控制半波数', () => {
    expect(solvePlateBuckling(plate({ lengthXM: 1.4 })).longitudinalHalfWaves).toBe(1)
    expect(solvePlateBuckling(plate({ lengthXM: 1.5 })).longitudinalHalfWaves).toBe(2)
  })
  it('板厚度立方与载荷利用比', () => {
    const a = solvePlateBuckling(plate())
    const b = solvePlateBuckling(plate({ thicknessM: .04 }))
    close(b.criticalLineLoadNPerM / a.criticalLineLoadNPerM, 8)
    close(a.utilization, fixture.plateSquare.applied / fixture.plateSquare.criticalLineLoad)
  })
  it('板边界、零值与拉力拒绝', () => {
    expect(() => solvePlateBuckling({ ...plate(), boundary: null } as unknown as PlateBucklingInput)).toThrow('显式选择')
    expect(() => solvePlateBuckling(plate({ appliedCompressionNPerM: 0 }))).toThrow()
    expect(() => solvePlateBuckling(plate({ appliedCompressionNPerM: -1 }))).toThrow()
  })
  it('圆柱壳闭式基准与模式搜索', () => {
    const result = solveShellBuckling(shell())
    close(result.criticalStressPa, fixture.shell.criticalStress)
    close(result.criticalLineLoadNPerM, fixture.shell.criticalLineLoad)
    close(result.criticalTotalForceN, fixture.shell.criticalForce)
    expect(result.axialHalfWaves).toBeGreaterThan(0)
    expect(result.circumferentialWaves).toBeGreaterThanOrEqual(0)
    expect(result.searchLineLoadNPerM).toBeGreaterThanOrEqual(result.classicalLineLoadNPerM * .999)
  })
  it('圆柱壳半径、厚度趋势与强警告', () => {
    const base = solveShellBuckling(shell())
    const thicker = solveShellBuckling(shell({ thicknessM: .01 }))
    close(thicker.criticalStressPa / base.criticalStressPa, 2)
    close(thicker.criticalLineLoadNPerM / base.criticalLineLoadNPerM, 4)
    expect(base.warnings[0]).toBe(IDEAL_BUCKLING_WARNING)
    expect(base.warnings[0]).toContain('缺陷')
  })
  it('薄壳上限警告、超限阻断、长壳警告', () => {
    expect(solveShellBuckling(shell({ thicknessM: .025 })).warnings.join()).toContain('上限')
    expect(() => solveShellBuckling(shell({ thicknessM: .02501 }))).toThrow('不适用')
    expect(solveShellBuckling(shell({ lengthM: 3 })).warnings.join()).toContain('整体柱屈曲')
  })
  it('圆柱壳非法输入拒绝', () => {
    expect(() => solveShellBuckling({ ...shell(), boundary: null } as unknown as ShellBucklingInput)).toThrow('显式选择')
    expect(() => solveShellBuckling(shell({ appliedCompressionNPerM: 0 }))).toThrow()
    expect(() => solveShellBuckling(shell({ material: { elasticModulusPa: 200e9, poissonRatio: .5 } }))).toThrow()
  })
})
