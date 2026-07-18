import { describe, expect, it } from 'vitest'
import {
  evaluateNumericExpression,
  NumericExpressionError,
  tryEvaluateNumericExpression,
} from '../../../src/core/numeric'

describe('safe numeric expression evaluator', () => {
  it.each([
    ['0.6*100', 60],
    ['100*(1-5%)', 95],
    ['2^3^2', 512],
    ['-2^2', -4],
    ['2^-2', 0.25],
    ['1.2e3 / 4', 300],
    ['（2＋3）×4÷2', 10],
  ])('evaluates %s', (source, expected) => {
    expect(evaluateNumericExpression(source)).toBeCloseTo(expected, 12)
  })

  it.each(['', '2/0', '2+abc', '(2+3', '2(3)', '1e999'])('rejects %s', (source) => {
    expect(() => evaluateNumericExpression(source)).toThrow(NumericExpressionError)
    expect(tryEvaluateNumericExpression(source)).toBeNull()
  })

  it('does not execute JavaScript syntax', () => {
    expect(() => evaluateNumericExpression('globalThis.alert(1)')).toThrow()
  })
})
