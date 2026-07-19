import { describe, expect, it } from 'vitest'

import fixture from '../fixtures/p3-lame-cylinder.json'
import {
  solveLameCylinder,
  validateLameCylinderInput,
  type LameCylinderAxialCondition,
  type LameCylinderDraftInput,
  type LameCylinderInput,
} from '../../src/core/plate-shell'

interface FixtureCase {
  id: string
  boundary: LameCylinderAxialCondition
  ri: number
  ro: number
  pi: number
  po: number
  r: number
  expected: {
    aPa?: number
    bPaM2?: number
    axialStrain?: number
    points?: Array<{ r: number; sr: number; sh: number; sz: number; u?: number }>
    thin?: {
      lameHoopPa: number; thinHoopPa: number; hoopDifference: number
      lameAxialPa: number; thinAxialPa: number; axialDifference: number
    }
  }
}

function input(item: FixtureCase, axialForceN = 0): LameCylinderInput {
  return {
    calculatorId: 'lame-cylinder', boundary: item.boundary,
    geometry: { kind: 'lame-cylinder', innerRadiusM: item.ri, outerRadiusM: item.ro },
    material: fixture.commonMaterial,
    load: { internalPressurePa: item.pi, externalPressurePa: item.po, axialForceN },
    evaluationRadiusM: item.r,
  }
}

function item(id: string): FixtureCase {
  const found = fixture.cases.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`缺少 fixture：${id}`)
  return found as FixtureCase
}

function closeStress(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1, Math.abs(expected) * 1e-6))
}

function closeDisplacement(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-9, Math.abs(expected) * 1e-6))
}

describe('厚壁圆筒 Lamé 解', () => {
  it.each(fixture.cases.map(({ id }) => id))('满足签收真值 %s', (id) => {
    const current = item(id)
    const result = solveLameCylinder(input(current))
    if (current.expected.aPa !== undefined) closeStress(result.constants.aPa, current.expected.aPa)
    if (current.expected.bPaM2 !== undefined) closeStress(result.constants.bPaM2, current.expected.bPaM2)
    if (current.expected.axialStrain !== undefined) expect(result.axialStrain).toBe(current.expected.axialStrain)
    for (const expected of current.expected.points ?? []) {
      const actual = result.points.find((point) => Math.abs(point.radiusM - expected.r) < 1e-12)
      expect(actual, `缺少半径 ${expected.r}`).toBeDefined()
      if (!actual) continue
      closeStress(actual.radialStressPa, expected.sr)
      closeStress(actual.hoopStressPa, expected.sh)
      closeStress(actual.axialStressPa, expected.sz)
      if (expected.u !== undefined) closeDisplacement(actual.radialDisplacementM, expected.u)
      expect(Number.isFinite(actual.vonMisesPa)).toBe(true)
      expect(Number.isFinite(actual.trescaPa)).toBe(true)
    }
  })

  it('每种轴向状态绑定独立公式 ID', () => {
    expect(solveLameCylinder(input(item('P3-LM-04-OPEN'))).axialFormulaId).toBe('P3-LM-AXIAL-OPEN-1')
    expect(solveLameCylinder(input(item('P3-LM-04-CLOSED'))).axialFormulaId).toBe('P3-LM-AXIAL-CLOSED-1')
    expect(solveLameCylinder(input(item('P3-LM-04-PLANE'))).axialFormulaId).toBe('P3-LM-AXIAL-PLANE-STRAIN-1')
  })

  it('内外表面直接满足压力边界', () => {
    for (const id of ['P3-LM-01', 'P3-LM-02', 'P3-LM-03', 'P3-LM-05']) {
      const result = solveLameCylinder(input(item(id)))
      expect(Math.abs(result.innerPressureResidualPa)).toBeLessThanOrEqual(1)
      expect(Math.abs(result.outerPressureResidualPa)).toBeLessThanOrEqual(1)
    }
  })

  it('薄壁极限独立对照满足签收百分比', () => {
    const current = item('P3-LM-06')
    const result = solveLameCylinder(input(current))
    const comparison = result.thinWallComparison
    expect(comparison).not.toBeNull()
    if (!comparison || !current.expected.thin) return
    closeStress(comparison.lameHoopPa, current.expected.thin.lameHoopPa)
    closeStress(comparison.thinHoopPa, current.expected.thin.thinHoopPa)
    expect(Math.abs((comparison.hoopRelativeDifference ?? 0) - current.expected.thin.hoopDifference))
      .toBeLessThanOrEqual(1e-6)
    closeStress(comparison.lameAxialPa, current.expected.thin.lameAxialPa)
    closeStress(comparison.thinAxialPa, current.expected.thin.thinAxialPa)
    expect(Math.abs((comparison.axialRelativeDifference ?? 0) - current.expected.thin.axialDifference))
      .toBeLessThanOrEqual(1e-6)
    expect(result.warnings[0]).toContain('薄壁膜解仅作近似对照')
  })

  it.each(fixture.invalidCases)('拒绝非法几何 $id', (invalid) => {
    const base = item('P3-LM-01')
    const bad = input({ ...base, ri: invalid.ri, ro: invalid.ro, r: invalid.r })
    expect(() => solveLameCylinder(bad)).toThrow(invalid.errorIncludes)
  })

  it('边界缺失与平面应变叠加轴力均拒绝', () => {
    const base = input(item('P3-LM-01'))
    const missing: LameCylinderDraftInput = { ...base, boundary: null }
    expect(validateLameCylinderInput(missing).issues[0]?.message).toContain('必须显式选择边界条件')
    const plane = input(item('P3-LM-04-PLANE'), 10)
    expect(() => solveLameCylinder(plane)).toThrow('平面应变状态禁止叠加任意轴力')
  })

  it('开口/封闭允许叠加居中轴力', () => {
    const force = 1e6
    const open = solveLameCylinder(input(item('P3-LM-04-OPEN'), force))
    const closed = solveLameCylinder(input(item('P3-LM-04-CLOSED'), force))
    const forceStress = force / (Math.PI * (0.2 ** 2 - 0.1 ** 2))
    closeStress(open.axialStressPa, forceStress)
    closeStress(closed.axialStressPa, 33333333.333333333 + forceStress)
  })

  it('有限超大几何导致平方溢出时拒绝非有限中间量', () => {
    const huge = input({ ...item('P3-LM-01'), ri: 1e200, ro: 2e200, r: 1.5e200 })
    expect(() => solveLameCylinder(huge)).toThrow('内半径平方超出有限数范围')
  })
})
