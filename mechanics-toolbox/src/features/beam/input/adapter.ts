import type { BeamLoad, BeamModel } from '../../../core/beam'
import { evaluateNumericExpression } from '../../../core/numeric'
import {
  calculateSectionProperties,
  type SectionInput,
  type SectionKind,
  type SectionProperties,
} from '../../../core/sections'
import { normalizeToSI, QUANTITY_CATALOG, type QuantityId, type UnitId } from '../../../core/units'
import type {
  BeamInputDraft,
  BeamInputError,
  BeamLoadDraft,
  BeamSectionDraft,
  SectionDimensionKey,
  UnitValueDraft,
} from './input-types'

export interface BuiltBeamModel extends BeamModel {
  sectionHeightM: number
  sectionKind: SectionKind
  sectionProperties: SectionProperties
  sectionInput: SectionInput
}

export type BuildBeamModelResult =
  | { ok: true; value: BuiltBeamModel; errors: [] }
  | { ok: false; errors: BeamInputError[] }

function parseUnitValue(
  draft: UnitValueDraft | undefined,
  quantity: QuantityId,
  field: string,
  label: string,
  errors: BeamInputError[],
): number | null {
  if (!draft) {
    errors.push({ field, message: `${label}不能为空` })
    return null
  }
  let value: number
  try {
    value = evaluateNumericExpression(draft.value)
  } catch (error) {
    errors.push({ field, message: `${label}：${error instanceof Error ? error.message : '请输入数值或算式'}` })
    return null
  }
  try {
    return normalizeToSI(value, quantity, draft.unit)
  } catch {
    errors.push({ field, message: `${label}单位不兼容` })
    return null
  }
}

function positive(
  value: number | null,
  field: string,
  label: string,
  errors: BeamInputError[],
): value is number {
  if (value !== null && value > 0) return true
  if (value !== null) errors.push({ field, message: `${label}必须大于 0` })
  return false
}

function dimension(
  section: BeamSectionDraft,
  key: SectionDimensionKey,
  symbol: string,
  errors: BeamInputError[],
): number | null {
  return parseUnitValue(
    section.dimensions[key],
    'length',
    `section.${key}`,
    `截面尺寸 ${symbol}`,
    errors,
  )
}

function buildSection(
  section: BeamSectionDraft,
  errors: BeamInputError[],
): { input: SectionInput; heightM: number } | null {
  switch (section.kind) {
    case 'rectangle': {
      const widthM = dimension(section, 'width', 'b', errors)
      const heightM = dimension(section, 'height', 'h', errors)
      if (widthM === null || heightM === null) return null
      return { input: { kind: section.kind, widthM, heightM }, heightM }
    }
    case 'hollowRectangle': {
      const outerWidthM = dimension(section, 'outerWidth', 'B', errors)
      const outerHeightM = dimension(section, 'outerHeight', 'H', errors)
      const innerWidthM = dimension(section, 'innerWidth', 'b', errors)
      const innerHeightM = dimension(section, 'innerHeight', 'h', errors)
      if ([outerWidthM, outerHeightM, innerWidthM, innerHeightM].some((value) => value === null)) {
        return null
      }
      return {
        input: {
          kind: section.kind,
          outerWidthM: outerWidthM as number,
          outerHeightM: outerHeightM as number,
          innerWidthM: innerWidthM as number,
          innerHeightM: innerHeightM as number,
        },
        heightM: outerHeightM as number,
      }
    }
    case 'solidCircle': {
      const diameterM = dimension(section, 'diameter', 'd', errors)
      if (diameterM === null) return null
      return { input: { kind: section.kind, diameterM }, heightM: diameterM }
    }
    case 'circularTube': {
      const outerDiameterM = dimension(section, 'outerDiameter', 'D', errors)
      const innerDiameterM = dimension(section, 'innerDiameter', 'd', errors)
      if (outerDiameterM === null || innerDiameterM === null) return null
      return {
        input: { kind: section.kind, outerDiameterM, innerDiameterM },
        heightM: outerDiameterM,
      }
    }
  }
}

function signedMagnitude(
  draft: BeamInputDraft,
  load: BeamLoadDraft,
  quantity: QuantityId,
  field: string,
  label: string,
  errors: BeamInputError[],
): number | null {
  const value = parseUnitValue(load.magnitude, quantity, field, label, errors)
  if (value === null) return null
  if (draft.directionMode === 'signed') return value
  if (value < 0) {
    errors.push({ field, message: `${label}在“幅值＋方向”模式下不得为负数` })
    return null
  }
  if (load.type === 'pointMoment') {
    return load.direction === 'counterClockwise' ? value : -value
  }
  return load.direction === 'up' ? value : -value
}

function buildLoad(
  draft: BeamInputDraft,
  load: BeamLoadDraft,
  index: number,
  lengthM: number,
  errors: BeamInputError[],
): BeamLoad | null {
  const prefix = `loads.${index}`
  if (load.type === 'pointForce') {
    const positionM = parseUnitValue(load.position, 'length', `${prefix}.position`, '集中力位置', errors)
    const forceN = signedMagnitude(draft, load, 'force', `${prefix}.magnitude`, '集中力', errors)
    if (positionM !== null) {
      const valid = draft.support === 'simplySupported'
        ? positionM > 0 && positionM < lengthM
        : positionM >= 0 && positionM <= lengthM
      if (!valid) {
        errors.push({
          field: `${prefix}.position`,
          message: draft.support === 'simplySupported'
            ? '简支梁集中力位置必须满足 0 < a < L'
            : '悬臂梁集中力位置必须满足 0 ≤ a ≤ L',
        })
      }
    }
    return positionM === null || forceN === null ? null : { type: load.type, positionM, forceN }
  }
  if (load.type === 'pointMoment') {
    const positionM = parseUnitValue(load.position, 'length', `${prefix}.position`, '集中力矩位置', errors)
    const momentNm = signedMagnitude(draft, load, 'moment', `${prefix}.magnitude`, '集中力矩', errors)
    if (positionM !== null && (positionM < 0 || positionM > lengthM)) {
      errors.push({ field: `${prefix}.position`, message: '集中力矩位置必须满足 0 ≤ a ≤ L' })
    }
    return positionM === null || momentNm === null ? null : { type: load.type, positionM, momentNm }
  }
  const startM = parseUnitValue(load.start, 'length', `${prefix}.start`, '均布载荷起点', errors)
  const endM = parseUnitValue(load.end, 'length', `${prefix}.end`, '均布载荷终点', errors)
  const intensityNPerM = signedMagnitude(draft, load, 'lineLoad', `${prefix}.magnitude`, '均布载荷', errors)
  if (
    startM !== null &&
    endM !== null &&
    !(startM >= 0 && startM < endM && endM <= lengthM)
  ) {
    errors.push({ field: `${prefix}.interval`, message: '均布载荷区间必须满足 0 ≤ a < b ≤ L' })
  }
  return startM === null || endM === null || intensityNPerM === null
    ? null
    : { type: load.type, startM, endM, intensityNPerM }
}

function mergeLoads(loads: BeamLoad[]): BeamLoad[] {
  const merged: BeamLoad[] = []
  const indexes = new Map<string, number>()
  for (const load of loads) {
    const key = load.type === 'uniformLoad'
      ? `${load.type}:${load.startM}:${load.endM}`
      : `${load.type}:${load.positionM}`
    const existingIndex = indexes.get(key)
    if (existingIndex === undefined) {
      indexes.set(key, merged.length)
      merged.push({ ...load })
      continue
    }
    const existing = merged[existingIndex]
    if (!existing || existing.type !== load.type) continue
    if (existing.type === 'pointForce' && load.type === 'pointForce') existing.forceN += load.forceN
    if (existing.type === 'pointMoment' && load.type === 'pointMoment') existing.momentNm += load.momentNm
    if (existing.type === 'uniformLoad' && load.type === 'uniformLoad') {
      existing.intensityNPerM += load.intensityNPerM
    }
  }
  return merged
}

function mapSectionErrorField(kind: SectionKind, field: string): string {
  if (field === 'geometry') return 'section.geometry'
  const aliases: Partial<Record<SectionKind, Partial<Record<string, SectionDimensionKey>>>> = {
    rectangle: { b: 'width', h: 'height' },
    hollowRectangle: { B: 'outerWidth', H: 'outerHeight', b: 'innerWidth', h: 'innerHeight' },
    solidCircle: { d: 'diameter' },
    circularTube: { D: 'outerDiameter', d: 'innerDiameter' },
  }
  const key = aliases[kind]?.[field]
  return key ? `section.${key}` : 'section.geometry'
}

export function buildBeamModel(draft: BeamInputDraft): BuildBeamModelResult {
  const errors: BeamInputError[] = []
  const lengthM = parseUnitValue(draft.length, 'length', 'length', '梁长 L', errors)
  const elasticModulusPa = parseUnitValue(
    draft.elasticModulus,
    'elasticModulus',
    'elasticModulus',
    '弹性模量 E',
    errors,
  )
  positive(lengthM, 'length', '梁长 L', errors)
  positive(elasticModulusPa, 'elasticModulus', '弹性模量 E', errors)

  const builtSection = buildSection(draft.section, errors)
  let sectionProperties: SectionProperties | null = null
  if (builtSection) {
    const result = calculateSectionProperties(builtSection.input)
    if (result.ok) sectionProperties = result.value
    else {
      result.errors.forEach((error) => {
        errors.push({ field: mapSectionErrorField(draft.section.kind, error.field), message: error.message })
      })
    }
  }

  if (draft.loads.length > 10) {
    errors.push({ field: 'loads', message: '原始载荷合计最多 10 项（后台合并前计数）' })
  }
  const loads = lengthM !== null
    ? draft.loads
        .map((load, index) => buildLoad(draft, load, index, lengthM, errors))
        .filter((load): load is BeamLoad => load !== null)
    : []

  if (
    errors.length > 0 ||
    lengthM === null ||
    elasticModulusPa === null ||
    !builtSection ||
    !sectionProperties
  ) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    errors: [],
    value: {
      lengthM,
      elasticModulusPa,
      secondMomentM4: sectionProperties.ixM4,
      support: draft.support,
      loads: mergeLoads(loads),
      sectionHeightM: builtSection.heightM,
      sectionKind: draft.section.kind,
      sectionProperties,
      sectionInput: builtSection.input,
    },
  }
}

export function compatibleUnits(quantity: QuantityId): ReadonlyArray<{ id: UnitId; symbol: string }> {
  return QUANTITY_CATALOG[quantity].units.map(({ id, symbol }) => ({ id, symbol }))
}
