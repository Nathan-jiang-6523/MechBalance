export type ColumnEndCondition =
  | 'pinnedPinned'
  | 'fixedFree'
  | 'fixedFixed'
  | 'fixedPinned'

export interface ColumnEndConditionDefinition {
  readonly id: ColumnEndCondition
  readonly label: string
  readonly effectiveLengthFactor: number
}

export const COLUMN_END_CONDITIONS: readonly ColumnEndConditionDefinition[] = [
  { id: 'pinnedPinned', label: '两端铰支', effectiveLengthFactor: 1 },
  { id: 'fixedFree', label: '一端固定、一端自由', effectiveLengthFactor: 2 },
  { id: 'fixedFixed', label: '两端固定', effectiveLengthFactor: 0.5 },
  { id: 'fixedPinned', label: '一端固定、一端铰支', effectiveLengthFactor: 0.699 },
]

export interface EulerBucklingInput {
  readonly elasticModulusPa: number
  readonly lengthM: number
  readonly areaM2: number
  readonly ixM4: number
  readonly iyM4: number
  readonly endCondition: ColumnEndCondition
  /** Project/code-specific screening limit. Omit when no criterion is confirmed. */
  readonly slendernessLimit?: number
}

export interface EulerBucklingResult {
  readonly effectiveLengthFactor: number
  readonly effectiveLengthM: number
  readonly radiusXMetres: number
  readonly radiusYMetres: number
  readonly slendernessX: number
  readonly slendernessY: number
  readonly controllingAxis: 'x' | 'y'
  readonly controllingSecondMomentM4: number
  readonly controllingRadiusM: number
  readonly controllingSlenderness: number
  readonly criticalLoadN: number
  readonly criticalStressPa: number
  readonly assessment:
    | { readonly status: 'notAssessed'; readonly message: string }
    | { readonly status: 'meetsLimit'; readonly limit: number; readonly message: string }
    | { readonly status: 'belowLimit'; readonly limit: number; readonly message: string }
}

export type EulerBucklingCalculation =
  | { readonly ok: true; readonly value: EulerBucklingResult }
  | { readonly ok: false; readonly errors: readonly string[] }

function positiveFinite(value: number, label: string, errors: string[]): void {
  if (!Number.isFinite(value) || value <= 0) errors.push(`${label}必须为大于 0 的有限数值`)
}

export function calculateEulerBuckling(input: EulerBucklingInput): EulerBucklingCalculation {
  const errors: string[] = []
  positiveFinite(input.elasticModulusPa, '弹性模量 E', errors)
  positiveFinite(input.lengthM, '杆件长度 L', errors)
  positiveFinite(input.areaM2, '截面面积 A', errors)
  positiveFinite(input.ixM4, '截面二次矩 Ix', errors)
  positiveFinite(input.iyM4, '截面二次矩 Iy', errors)

  const condition = COLUMN_END_CONDITIONS.find(({ id }) => id === input.endCondition)
  if (!condition) errors.push('必须显式选择有效的端部约束')
  if (
    input.slendernessLimit !== undefined &&
    (!Number.isFinite(input.slendernessLimit) || input.slendernessLimit <= 0)
  ) {
    errors.push('长细比判定阈值必须为大于 0 的有限数值')
  }
  if (errors.length || !condition) return { ok: false, errors }

  const radiusXMetres = Math.sqrt(input.ixM4 / input.areaM2)
  const radiusYMetres = Math.sqrt(input.iyM4 / input.areaM2)
  const effectiveLengthM = condition.effectiveLengthFactor * input.lengthM
  const slendernessX = effectiveLengthM / radiusXMetres
  const slendernessY = effectiveLengthM / radiusYMetres
  const controllingAxis = slendernessX >= slendernessY ? 'x' : 'y'
  const controllingSecondMomentM4 = controllingAxis === 'x' ? input.ixM4 : input.iyM4
  const controllingRadiusM = controllingAxis === 'x' ? radiusXMetres : radiusYMetres
  const controllingSlenderness = controllingAxis === 'x' ? slendernessX : slendernessY
  const criticalLoadN =
    (Math.PI ** 2 * input.elasticModulusPa * controllingSecondMomentM4) /
    effectiveLengthM ** 2
  const criticalStressPa = criticalLoadN / input.areaM2

  const assessment: EulerBucklingResult['assessment'] = input.slendernessLimit === undefined
    ? {
        status: 'notAssessed',
        message: '未配置项目/规范长细比阈值，仅输出 λ 与欧拉临界值，不静默判定“长杆”。',
      }
    : controllingSlenderness >= input.slendernessLimit
      ? {
          status: 'meetsLimit',
          limit: input.slendernessLimit,
          message: `控制长细比 λ ≥ 自定义阈值 ${input.slendernessLimit}。`,
        }
      : {
          status: 'belowLimit',
          limit: input.slendernessLimit,
          message: `控制长细比 λ < 自定义阈值 ${input.slendernessLimit}；欧拉公式适用性不足。`,
        }

  return {
    ok: true,
    value: {
      effectiveLengthFactor: condition.effectiveLengthFactor,
      effectiveLengthM,
      radiusXMetres,
      radiusYMetres,
      slendernessX,
      slendernessY,
      controllingAxis,
      controllingSecondMomentM4,
      controllingRadiusM,
      controllingSlenderness,
      criticalLoadN,
      criticalStressPa,
      assessment,
    },
  }
}
