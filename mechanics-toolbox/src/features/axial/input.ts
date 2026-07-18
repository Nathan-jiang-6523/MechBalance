import { calculateAxialResponse, type AxialAnalysisResult } from '../../core/axial'
import { normalizeToSI, QUANTITY_CATALOG, type QuantityId, type UnitId } from '../../core/units'

export interface AxialValueDraft {
  value: string
  unit: UnitId
}

export interface AxialSegmentDraft {
  id: string
  length: AxialValueDraft
  area: AxialValueDraft
  elasticModulus: AxialValueDraft
  /** UI 数值单位固定为 10⁻⁶/K。 */
  thermalExpansionMicroPerK: string
  deltaTemperature: AxialValueDraft
}

export interface AxialInputDraft {
  boundary: 'free' | 'fullyRestrained'
  axialForce: AxialValueDraft
  segments: AxialSegmentDraft[]
}

export interface AxialInputError {
  readonly field: string
  readonly message: string
}

export type BuildAxialInputResult =
  | { readonly ok: true; readonly value: AxialAnalysisResult; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly AxialInputError[] }

export function createAxialSegmentDraft(id: string, index = 0): AxialSegmentDraft {
  return {
    id,
    length: { value: index === 0 ? '1000' : '500', unit: 'mm' },
    area: { value: '1000', unit: 'mm2' },
    elasticModulus: { value: '200000', unit: 'MPa' },
    thermalExpansionMicroPerK: '12',
    deltaTemperature: { value: '50', unit: 'deltaDegC' },
  }
}

export function createDefaultAxialInputDraft(): AxialInputDraft {
  return {
    boundary: 'free',
    axialForce: { value: '10000', unit: 'N' },
    segments: [createAxialSegmentDraft('segment-1')],
  }
}

function parseValue(
  draft: AxialValueDraft,
  quantity: QuantityId,
  field: string,
  label: string,
  errors: AxialInputError[],
): number | null {
  if (draft.value.trim() === '') {
    errors.push({ field, message: `${label}不能为空` })
    return null
  }
  const value = Number(draft.value)
  if (!Number.isFinite(value)) {
    errors.push({ field, message: `${label}必须为有限数值` })
    return null
  }
  try {
    return normalizeToSI(value, quantity, draft.unit)
  } catch {
    errors.push({ field, message: `${label}单位不兼容` })
    return null
  }
}

function parseAlpha(
  value: string,
  field: string,
  label: string,
  errors: AxialInputError[],
): number | null {
  if (value.trim() === '') {
    errors.push({ field, message: `${label}不能为空` })
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    errors.push({ field, message: `${label}必须为有限数值` })
    return null
  }
  return parsed * 1e-6
}

export function calculateAxialDraft(draft: AxialInputDraft): BuildAxialInputResult {
  const errors: AxialInputError[] = []
  const segments = draft.segments.map((segment, index) => {
    const prefix = `segments.${index}`
    const lengthM = parseValue(segment.length, 'length', `${prefix}.length`, `第 ${index + 1} 段长度 L`, errors)
    const areaM2 = parseValue(segment.area, 'area', `${prefix}.area`, `第 ${index + 1} 段面积 A`, errors)
    const elasticModulusPa = parseValue(
      segment.elasticModulus,
      'elasticModulus',
      `${prefix}.elasticModulus`,
      `第 ${index + 1} 段弹性模量 E`,
      errors,
    )
    const thermalExpansionPerK = parseAlpha(
      segment.thermalExpansionMicroPerK,
      `${prefix}.thermalExpansion`,
      `第 ${index + 1} 段线膨胀系数 α`,
      errors,
    )
    const deltaTemperatureK = parseValue(
      segment.deltaTemperature,
      'temperatureDifference',
      `${prefix}.deltaTemperature`,
      `第 ${index + 1} 段温差 ΔT`,
      errors,
    )
    return {
      id: segment.id,
      lengthM,
      areaM2,
      elasticModulusPa,
      thermalExpansionPerK,
      deltaTemperatureK,
    }
  })

  const axialForceN = draft.boundary === 'free'
    ? parseValue(draft.axialForce, 'force', 'axialForce', '轴向力 N', errors)
    : null
  if (errors.length > 0) return { ok: false, errors }

  const normalizedSegments = segments.map((segment) => ({
    id: segment.id,
    lengthM: segment.lengthM as number,
    areaM2: segment.areaM2 as number,
    elasticModulusPa: segment.elasticModulusPa as number,
    thermalExpansionPerK: segment.thermalExpansionPerK as number,
    deltaTemperatureK: segment.deltaTemperatureK as number,
  }))
  const result = draft.boundary === 'free'
    ? calculateAxialResponse({
        boundary: 'free',
        axialForceN: axialForceN as number,
        segments: normalizedSegments,
      })
    : calculateAxialResponse({ boundary: 'fullyRestrained', segments: normalizedSegments })

  return result.ok ? result : { ok: false, errors: result.errors }
}

export function axialCompatibleUnits(
  quantity: QuantityId,
): ReadonlyArray<{ id: UnitId; symbol: string }> {
  return QUANTITY_CATALOG[quantity].units.map(({ id, symbol }) => ({ id, symbol }))
}
