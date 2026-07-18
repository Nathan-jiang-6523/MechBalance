import type { ScreenResult } from './result'

export type CalculatorStatus = 'available' | 'beta' | 'planned'

export interface CalculatorDescriptor {
  readonly id: string
  readonly title: string
  readonly shortTitle: string
  readonly summary: string
  readonly phase: 'P1' | 'P2' | 'P3' | 'P4'
  readonly category: string
  readonly status: CalculatorStatus
  readonly order: number
}

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  readonly code: string
  readonly severity: ValidationSeverity
  readonly message: string
  readonly field?: string
}

export interface ValidationResult {
  readonly valid: boolean
  readonly issues: readonly ValidationIssue[]
}

export interface CalculationContext {
  readonly requestId: string
  readonly signal?: AbortSignal
}

/**
 * 每个计算器用纯数据输入/输出接入，禁止把 Vue 状态带入求解内核。
 */
export interface CalculatorDefinition<TInput, TResult extends ScreenResult = ScreenResult> {
  readonly descriptor: CalculatorDescriptor
  createDefaultInput(): TInput
  validate(input: TInput): ValidationResult
  calculate(input: TInput, context: CalculationContext): TResult | Promise<TResult>
}

export type RegisteredCalculator = CalculatorDefinition<unknown, ScreenResult>

export interface CalculatorRegistryReader {
  get(id: string): RegisteredCalculator | undefined
  list(): readonly CalculatorDescriptor[]
}

export class CalculatorRegistry implements CalculatorRegistryReader {
  readonly #calculators = new Map<string, RegisteredCalculator>()

  register<TInput>(calculator: CalculatorDefinition<TInput>): void {
    const { id } = calculator.descriptor
    if (this.#calculators.has(id)) {
      throw new Error(`计算器 ID 重复：${id}`)
    }

    this.#calculators.set(id, calculator as RegisteredCalculator)
  }

  get(id: string): RegisteredCalculator | undefined {
    return this.#calculators.get(id)
  }

  list(): readonly CalculatorDescriptor[] {
    return [...this.#calculators.values()]
      .map(({ descriptor }) => descriptor)
      .sort((left, right) => left.order - right.order)
  }
}
