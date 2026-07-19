import { describe, expect, it } from 'vitest'

import fixture from '../fixtures/p3-thin-cylinder.json'
import {
  solveThinCylinder,
  thinCylinderFormulaFor,
  validateThinCylinderInput,
  type ThinCylinderDraftInput,
  type ThinCylinderEndCondition,
  type ThinCylinderInput,
} from '../../src/core/plate-shell'

interface FixtureInput {
  boundary: ThinCylinderEndCondition
  meanRadiusM: number
  thicknessM: number
  internalPressurePa: number
  externalPressurePa: number
  axialForceN: number
  torqueNm: number
}

function input(values: FixtureInput): ThinCylinderInput {
  return {
    calculatorId: 'thin-cylinder',
    boundary: values.boundary,
    geometry: {
      kind: 'thin-cylinder',
      meanRadiusM: values.meanRadiusM,
      thicknessM: values.thicknessM,
    },
    material: fixture.commonMaterial,
    load: {
      internalPressurePa: values.internalPressurePa,
      externalPressurePa: values.externalPressurePa,
      axialForceN: values.axialForceN,
      torqueNm: values.torqueNm,
    },
  }
}

function caseById(id: string) {
  const item = fixture.cases.find((candidate) => candidate.id === id)
  if (!item) throw new Error(`缺少 fixture：${id}`)
  return item
}

function expectStress(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    Math.max(1, Math.abs(expected) * 1e-6),
  )
}

describe('薄壁圆筒膜应力', () => {
  it.each(['P3-TW-01', 'P3-TW-02', 'P3-TW-03', 'P3-TW-04', 'P3-TW-05A'])(
    '满足签收真值 %s',
    (id) => {
      const item = caseById(id)
      const result = solveThinCylinder(input(item.input as FixtureInput))
      if (item.expected.hoopPa !== undefined) {
        expectStress(result.stresses.hoopPa, item.expected.hoopPa)
      }
      if (item.expected.axialPa !== undefined) {
        expectStress(result.stresses.axialTotalPa, item.expected.axialPa)
      }
      if (item.expected.shearPa !== undefined) {
        expectStress(result.stresses.shearPa, item.expected.shearPa)
      }
      if (item.expected.vonMisesPa !== undefined) {
        expectStress(result.planeStress.vonMisesPa, item.expected.vonMisesPa)
      }
      if (item.expected.trescaPa !== undefined) {
        expectStress(result.planeStress.trescaPa, item.expected.trescaPa)
      }
      expect(result.warnings.map(({ code }) => code)).toEqual(item.expected.warningCodes)
    },
  )

  it('按开口/封闭状态登记独立压力公式 ID', () => {
    expect(thinCylinderFormulaFor('open').id).toBe('P3-TW-PRESSURE-OPEN-1')
    expect(thinCylinderFormulaFor('closed').id).toBe('P3-TW-PRESSURE-CLOSED-1')
  })

  it('开口端不静默加入压力轴向应力', () => {
    const closed = solveThinCylinder(input(caseById('P3-TW-01').input as FixtureInput))
    const opened = solveThinCylinder(input(caseById('P3-TW-02').input as FixtureInput))
    expect(closed.stresses.axialPressurePa).toBe(100e6)
    expect(opened.stresses.axialPressurePa).toBe(0)
  })

  it('超出 t/r 上限时阻断，不返回膜结果', () => {
    const item = caseById('P3-TW-05B')
    expect(() => solveThinCylinder(input(item.input as FixtureInput)))
      .toThrow(item.expected.errorIncludes)
  })

  it('零载荷退化为全零结果', () => {
    const zero = input({
      boundary: 'closed',
      meanRadiusM: 1,
      thicknessM: 0.01,
      internalPressurePa: 0,
      externalPressurePa: 0,
      axialForceN: 0,
      torqueNm: 0,
    })
    const result = solveThinCylinder(zero)
    expect(result.netPressurePa).toBe(0)
    expect(Object.values(result.stresses).every((value) => value === 0)).toBe(true)
    expect(result.planeStress.vonMisesPa).toBe(0)
  })

  it('压力差反向使膜正应力反号，等效应力保持非负', () => {
    const internal = solveThinCylinder(input(caseById('P3-TW-01').input as FixtureInput))
    const external = solveThinCylinder(input(caseById('P3-TW-03').input as FixtureInput))
    expect(external.stresses.hoopPa).toBe(-internal.stresses.hoopPa)
    expect(external.stresses.axialTotalPa).toBe(-internal.stresses.axialTotalPa)
    expect(external.planeStress.vonMisesPa).toBe(internal.planeStress.vonMisesPa)
  })

  it.each([
    ['厚度必须大于 0', { meanRadiusM: 1, thicknessM: 0 }],
    ['中面半径必须大于 0', { meanRadiusM: 0, thicknessM: 0.01 }],
    ['厚度输入必须为有限数', { meanRadiusM: 1, thicknessM: Number.NaN }],
  ])('拒绝非法几何：%s', (message, geometry) => {
    const draft: ThinCylinderDraftInput = {
      ...input(caseById('P3-TW-01').input as FixtureInput),
      geometry: { kind: 'thin-cylinder', ...geometry },
    }
    const checked = validateThinCylinderInput(draft)
    expect(checked.validation.valid).toBe(false)
    expect(checked.validation.issues.some((issue) => issue.message === message)).toBe(true)
  })

  it('边界缺失时禁止计算', () => {
    const draft: ThinCylinderDraftInput = {
      ...input(caseById('P3-TW-01').input as FixtureInput),
      boundary: null,
    }
    const checked = validateThinCylinderInput(draft)
    expect(checked.validation.valid).toBe(false)
    expect(checked.validation.issues[0]?.message).toContain('必须显式选择边界条件')
  })

  it('有限输入导致中间结果溢出时拒绝非有限输出', () => {
    const huge = input({
      boundary: 'closed',
      meanRadiusM: 1e200,
      thicknessM: 1e198,
      internalPressurePa: Number.MAX_VALUE,
      externalPressurePa: 0,
      axialForceN: 0,
      torqueNm: 0,
    })
    expect(() => solveThinCylinder(huge)).toThrow('环向膜内力超出有限数范围')
  })
})
