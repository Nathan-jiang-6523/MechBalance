export type ResultStatus = 'success' | 'warning' | 'error'

export type ResultMessageSeverity = 'info' | 'warning' | 'error'

export type ResultGroupKind =
  | 'section-property'
  | 'reaction'
  | 'internal-force'
  | 'stress'
  | 'rotation'
  | 'displacement'
  | 'extremum'
  | 'check'
  | 'other'

export type CurveKind = 'line' | 'step' | 'scatter'

export type PointSide = 'left' | 'at' | 'right' | 'continuous'

export interface ResultLocation {
  readonly x: number
  readonly unit: string
  readonly side?: PointSide
}

/**
 * 数值结果保留未经格式化的值；界面层只负责显示精度，不参与计算。
 */
export interface ResultValue {
  readonly id: string
  readonly label: string
  readonly symbol?: string
  readonly value: number
  readonly unit: string
  readonly formattedValue?: string
  readonly location?: ResultLocation
  readonly note?: string
}

export interface ResultGroup {
  readonly id: string
  readonly title: string
  readonly kind: ResultGroupKind
  readonly values: readonly ResultValue[]
}

export interface CurvePoint {
  readonly x: number
  readonly y: number
  readonly side?: PointSide
}

export interface CurveSeries {
  readonly id: string
  readonly name: string
  readonly kind: CurveKind
  readonly unit: string
  readonly points: readonly CurvePoint[]
}

export interface CurveChart {
  readonly id: string
  readonly title: string
  readonly xLabel: string
  readonly xUnit: string
  readonly series: readonly CurveSeries[]
}

export interface ResultMessage {
  readonly code: string
  readonly severity: ResultMessageSeverity
  readonly message: string
  readonly field?: string
}

export interface BalanceCheck {
  readonly id: string
  readonly label: string
  readonly residual: number
  readonly unit: string
  readonly tolerance: number
  readonly passed: boolean
}

export interface FormulaReference {
  readonly id: string
  readonly version: string
  readonly label: string
}

export interface CalculationMetadata {
  readonly requestId: string
  readonly calculatedAt: string
  readonly formulaReferences: readonly FormulaReference[]
  readonly elapsedMilliseconds?: number
}

/** 屏幕结果唯一出口；首版不承担打印或文档报告。 */
export interface ScreenResult {
  readonly calculatorId: string
  readonly status: ResultStatus
  readonly headline: string
  readonly summary?: string
  readonly groups: readonly ResultGroup[]
  readonly charts: readonly CurveChart[]
  readonly messages: readonly ResultMessage[]
  readonly balanceChecks: readonly BalanceCheck[]
  readonly metadata: CalculationMetadata
}
