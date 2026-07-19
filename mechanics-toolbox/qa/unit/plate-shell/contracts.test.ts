import { describe, expect, it } from 'vitest'

import {
  evaluateCircularShellLength,
  evaluateCircularShellThinness,
  evaluateThinPlateRatio,
  evaluateThinWallRatio,
  summarizeApplicability,
  validateEvaluationRadius,
  validateExplicitBoundary,
  validateIsotropicMaterial,
  validateLameCylinderGeometry,
  validatePositiveGeometry,
  type PlateShellResultValue,
} from '../../../src/core/plate-shell'

describe('P3 公共契约', () => {
  it('边界条件必须显式选择且与公式匹配', () => {
    expect(validateExplicitBoundary('boundary', null, ['ssss', 'cccc']).issues[0]).toMatchObject({
      code: 'REQUIRED',
      field: 'boundary',
    })
    expect(validateExplicitBoundary('boundary', 'free', ['ssss', 'cccc']).issues[0]).toMatchObject({
      code: 'OUT_OF_RANGE',
    })
    expect(validateExplicitBoundary('boundary', 'ssss', ['ssss', 'cccc']).valid).toBe(true)
  })

  it('拒绝非法板壳几何和非有限数', () => {
    expect(validatePositiveGeometry({ radiusM: 1, thicknessM: 0 }).valid).toBe(false)
    expect(validatePositiveGeometry({ radiusM: Number.POSITIVE_INFINITY, thicknessM: 0.01 }).valid)
      .toBe(false)
  })

  it('校验各向同性材料数学域', () => {
    expect(validateIsotropicMaterial({ elasticModulusPa: 200e9, poissonRatio: 0.3 }).valid)
      .toBe(true)
    expect(validateIsotropicMaterial({ elasticModulusPa: 0, poissonRatio: 0.3 }).valid).toBe(false)
    expect(validateIsotropicMaterial({ elasticModulusPa: 200e9, poissonRatio: 0.5 }).valid)
      .toBe(false)
    expect(validateIsotropicMaterial({ elasticModulusPa: 200e9, poissonRatio: -1 }).valid)
      .toBe(false)
  })

  it('校验 Lamé 半径关系与求值闭区间', () => {
    expect(validateLameCylinderGeometry({ kind: 'lame-cylinder', innerRadiusM: 0.5, outerRadiusM: 1 }).valid)
      .toBe(true)
    expect(validateLameCylinderGeometry({ kind: 'lame-cylinder', innerRadiusM: 1, outerRadiusM: 1 }).valid)
      .toBe(false)
    expect(validateEvaluationRadius(0.5, 0.5, 1).valid).toBe(true)
    expect(validateEvaluationRadius(1.01, 0.5, 1).valid).toBe(false)
  })

  it('薄壁圆筒在 0.05 边界提醒，超限阻断', () => {
    expect(evaluateThinWallRatio(0.05, 1).level).toBe('at-limit')
    expect(evaluateThinWallRatio(50, 1_000).level).toBe('at-limit')
    expect(evaluateThinWallRatio(0.05005, 1).level).toBe('blocked')
  })

  it('薄板超 0.1 强警告但仍允许理论计算', () => {
    const check = evaluateThinPlateRatio(0.1001, 1)
    expect(check.level).toBe('warning')
    expect(summarizeApplicability([check]).canCalculate).toBe(true)
  })

  it('圆柱壳厚度超限阻断，长径比超限只警告', () => {
    const thinness = evaluateCircularShellThinness(0.0501, 1)
    const length = evaluateCircularShellLength(5.01, 1)
    expect(thinness.level).toBe('blocked')
    expect(length.level).toBe('warning')
    expect(summarizeApplicability([thinness, length])).toMatchObject({
      canCalculate: false,
      level: 'blocked',
    })
  })

  it('结果值强制记录控制位置、方向、表面、公式和解法性质', () => {
    const value: PlateShellResultValue = {
      id: 'sigma-hoop-inner',
      label: '内表面环向应力',
      value: 100e6,
      unit: 'Pa',
      control: {
        label: '内表面',
        coordinates: { radiusM: 0.5 },
        surface: 'negative',
        direction: 'hoop',
      },
      formulaId: 'P3-LM-STRESS-001',
      solutionNature: 'exact-closed-form',
    }
    expect(value.control.direction).toBe('hoop')
    expect(value.formulaId).toBe('P3-LM-STRESS-001')
  })
})
