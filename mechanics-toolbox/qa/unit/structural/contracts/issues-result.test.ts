import { describe, expect, it } from 'vitest'

import {
  createStructuralIssue,
  createStructuralQuantity,
  hasSafeStructuralQuantities,
  isStructuralIssue,
  isStructuralIssueCode,
  isSafeStructuralScreenResult,
  STRUCTURAL_ISSUE_SEVERITY,
  StructuralResultValueError,
  type StructuralScreenResult,
} from '../../../../src/core/structural/contracts'

describe('P2 结构 issue 与结果契约', () => {
  it('错误码固定严重度并可定位字段/节点/单元', () => {
    expect(createStructuralIssue('P2_NONFINITE_INPUT', 'E 非有限', { field: 'elements[0].E', elementId: 'e1' })).toEqual({
      code: 'P2_NONFINITE_INPUT', severity: 'error', message: 'E 非有限', field: 'elements[0].E', elementId: 'e1',
    })
    expect(createStructuralIssue('P2_MODEL_SIZE_NEAR_LIMIT', '接近上限', { objectId: 'model' }).severity).toBe('warning')
    expect(isStructuralIssueCode('P2_ZERO_LENGTH_ELEMENT')).toBe(true)
    expect(isStructuralIssueCode('P2_UNKNOWN')).toBe(false)
    expect(Object.keys(STRUCTURAL_ISSUE_SEVERITY)).toHaveLength(11)
    expect(Object.values(STRUCTURAL_ISSUE_SEVERITY).filter((severity) => severity === 'warning')).toEqual(['warning'])
    expect(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', 'P2 未纳入梁端弯矩释放/内部铰', {
      field: 'elements[0].releaseJMz',
      elementId: 'e1',
    })).toMatchObject({ code: 'P2_FEATURE_NOT_INCLUDED', severity: 'error' })
  })

  it('运行时守卫拒绝未知码、错严重度和非法定位', () => {
    expect(isStructuralIssue({ code: 'P2_DUPLICATE_ID', severity: 'error', message: '重复', nodeId: 'n1' })).toBe(true)
    expect(isStructuralIssue({ code: 'P2_DUPLICATE_ID', severity: 'warning', message: '重复' })).toBe(false)
    expect(isStructuralIssue({ code: 'P2_UNKNOWN', severity: 'error', message: 'x' })).toBe(false)
    expect(isStructuralIssue({ code: 'P2_DUPLICATE_ID', severity: 'error', message: 'x', elementId: 1 })).toBe(false)
  })

  it('结构结果组合 ScreenResult 且数值携带单位与正号语义', () => {
    const result = {
      calculatorId: 'p2-truss', status: 'success', headline: '完成', groups: [], charts: [], messages: [], balanceChecks: [],
      metadata: { requestId: 'r1', calculatedAt: '2026-07-19', formulaReferences: [] },
      structural: {
        analysis: 'truss',
        displacements: [{ nodeId: 'n1', u: { value: 0, unit: 'm', positive: 'global +x' }, v: { value: 0, unit: 'm', positive: 'global +y' } }],
        reactions: [{ nodeId: 'n1', fx: { value: 0, unit: 'N', positive: 'global +x' }, fy: { value: 50_000, unit: 'N', positive: 'global +y' } }],
        controls: [], elements: [{ elementId: 'e1', axialForce: { value: -60_000, unit: 'N', positive: 'tension' }, stress: { value: -60e6, unit: 'Pa', positive: 'tension' }, state: 'compression' }],
      },
    } satisfies StructuralScreenResult

    expect(result.structural.elements[0]!.stress).toEqual({ value: -60e6, unit: 'Pa', positive: 'tension' })
    expect(isSafeStructuralScreenResult(result)).toBe(true)
  })

  it('拒绝非有限成功值、空正号语义，并把负零归一为零', () => {
    expect(createStructuralQuantity(-1e-6, 'm/N', 'global +y displacement per downward unit load').unit).toBe('m/N')
    expect(createStructuralQuantity(-0, 'N', 'global +x').value).toBe(0)
    expect(Object.is(createStructuralQuantity(-0, 'N', 'global +x').value, -0)).toBe(false)
    expect(() => createStructuralQuantity(Number.NaN, 'N', 'global +x', 'reactions[0].fx')).toThrow(StructuralResultValueError)
    expect(() => createStructuralQuantity(Number.POSITIVE_INFINITY, 'N', 'global +x')).toThrow(StructuralResultValueError)
    expect(() => createStructuralQuantity(1, 'N', '   ')).toThrow(StructuralResultValueError)
    expect(hasSafeStructuralQuantities({ force: { value: Number.NaN, unit: 'N', positive: 'tension' } })).toBe(false)
  })

  it('错误结果禁止携带 structural、group、chart 或 balance 成功数据', () => {
    const errorResult = {
      calculatorId: 'p2-beam', status: 'error', headline: '失败', groups: [], charts: [], balanceChecks: [],
      messages: [{ code: 'P2_SINGULAR_STIFFNESS', severity: 'error', message: '机构' }],
      metadata: { requestId: 'r2', calculatedAt: '2026-07-19', formulaReferences: [] },
    } satisfies StructuralScreenResult

    expect(isSafeStructuralScreenResult(errorResult)).toBe(true)
    expect(isSafeStructuralScreenResult({ ...errorResult, structural: {} } as never)).toBe(false)
  })
})
