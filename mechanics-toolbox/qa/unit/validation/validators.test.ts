import { describe, expect, it } from 'vitest'

import {
  combineValidationResults,
  issuesByField,
  validateBeamInteriorPosition,
  validateLessThan,
  validateNumberField,
} from '../../../src/core/validation'

describe('统一输入校验', () => {
  it('必填错误定位到字段', () => {
    const validation = validateNumberField('length', '', { required: true, positive: true })
    expect(validation.valid).toBe(false)
    expect(validation.issues).toEqual([
      { field: 'length', code: 'REQUIRED', message: '此字段为必填项' },
    ])
  })

  it('拒绝非数值、非有限值及非正几何尺寸', () => {
    expect(validateNumberField('width', '100', { positive: true }).issues[0]?.code).toBe(
      'NOT_A_NUMBER',
    )
    expect(validateNumberField('width', Number.NaN, { positive: true }).issues[0]?.code).toBe(
      'NOT_FINITE',
    )
    expect(validateNumberField('width', 0, { positive: true }).issues[0]?.code).toBe(
      'MUST_BE_POSITIVE',
    )
  })

  it('支持开闭区间', () => {
    expect(validateNumberField('ratio', 0, { min: 0, max: 1 }).valid).toBe(true)
    expect(
      validateNumberField('ratio', 0, { min: 0, minInclusive: false }).valid,
    ).toBe(false)
    expect(validateNumberField('ratio', 1, { max: 1, maxInclusive: false }).valid).toBe(false)
  })

  it('校验内尺寸严格小于外尺寸', () => {
    expect(validateLessThan('innerDiameter', 40, 'outerDiameter', 50).valid).toBe(true)
    const invalid = validateLessThan('innerDiameter', 50, 'outerDiameter', 50)
    expect(invalid.valid).toBe(false)
    expect(invalid.issues[0]).toMatchObject({
      field: 'innerDiameter',
      code: 'INVALID_RELATION',
    })
  })

  it('简支梁载荷位置只允许 0 < a < L', () => {
    expect(validateBeamInteriorPosition('a', 500, 1000).valid).toBe(true)
    expect(validateBeamInteriorPosition('a', 0, 1000).valid).toBe(false)
    expect(validateBeamInteriorPosition('a', 1000, 1000).valid).toBe(false)
  })

  it('合并问题并按字段分组', () => {
    const combined = combineValidationResults(
      validateNumberField('width', 0, { positive: true }),
      validateNumberField('height', null, { required: true }),
    )
    expect(combined.valid).toBe(false)
    expect(Object.keys(issuesByField(combined))).toEqual(['width', 'height'])
  })
})
