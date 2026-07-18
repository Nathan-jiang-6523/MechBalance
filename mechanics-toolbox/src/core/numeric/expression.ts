const MAX_EXPRESSION_LENGTH = 256
const MAX_PARENTHESES_DEPTH = 32

export class NumericExpressionError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message)
    this.name = 'NumericExpressionError'
  }
}

function normalizeExpression(source: string): string {
  return source
    .normalize('NFKC')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
}

class ExpressionParser {
  private readonly source: string
  private position = 0
  private depth = 0

  constructor(source: string) {
    this.source = normalizeExpression(source)
  }

  parse(): number {
    if (this.source.trim() === '') this.fail('请输入数值或算式')
    if (this.source.length > MAX_EXPRESSION_LENGTH) this.fail('算式过长')
    const result = this.additive()
    this.skipWhitespace()
    if (this.position < this.source.length) {
      this.fail(`算式包含无法识别的内容“${this.source[this.position]}”`)
    }
    return this.finite(result)
  }

  private additive(): number {
    let value = this.multiplicative()
    while (true) {
      if (this.consume('+')) value = this.finite(value + this.multiplicative())
      else if (this.consume('-')) value = this.finite(value - this.multiplicative())
      else return value
    }
  }

  private multiplicative(): number {
    let value = this.unary()
    while (true) {
      if (this.consume('*')) value = this.finite(value * this.unary())
      else if (this.consume('/')) {
        const divisor = this.unary()
        if (divisor === 0) this.fail('算式不能除以 0')
        value = this.finite(value / divisor)
      } else return value
    }
  }

  private unary(): number {
    if (this.consume('+')) return this.unary()
    if (this.consume('-')) return this.finite(-this.unary())
    return this.power()
  }

  private power(): number {
    const base = this.postfix()
    if (!this.consume('^')) return base
    return this.finite(base ** this.unary())
  }

  private postfix(): number {
    let value = this.primary()
    while (this.consume('%')) value = this.finite(value / 100)
    return value
  }

  private primary(): number {
    this.skipWhitespace()
    if (this.consume('(')) {
      this.depth += 1
      if (this.depth > MAX_PARENTHESES_DEPTH) this.fail('算式括号嵌套过深')
      const value = this.additive()
      if (!this.consume(')')) this.fail('算式缺少右括号“)”')
      this.depth -= 1
      return value
    }

    const remaining = this.source.slice(this.position)
    const match = remaining.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)
    if (!match) this.fail('此处应输入数字或左括号“(”')
    this.position += match[0].length
    return this.finite(Number(match[0]))
  }

  private consume(expected: string): boolean {
    this.skipWhitespace()
    if (this.source[this.position] !== expected) return false
    this.position += 1
    return true
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.position] ?? '')) this.position += 1
  }

  private finite(value: number): number {
    if (!Number.isFinite(value)) this.fail('算式结果必须是有限数值')
    return Object.is(value, -0) ? 0 : value
  }

  private fail(message: string): never {
    throw new NumericExpressionError(message, this.position)
  }
}

/** Safely evaluates a unitless arithmetic expression without eval/Function. */
export function evaluateNumericExpression(source: string): number {
  return new ExpressionParser(source).parse()
}

export function tryEvaluateNumericExpression(source: string): number | null {
  try {
    return evaluateNumericExpression(source)
  } catch {
    return null
  }
}
