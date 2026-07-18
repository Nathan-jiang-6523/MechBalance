import type {
  BeamExtrema,
  BeamExtremumCandidate,
  BeamFieldKey,
  BeamReactions,
  BeamSamplePoint,
} from '../../../core/beam'
import {
  formatEngineeringValue,
  formatExtremaPosition,
} from '../../../core/numeric'
import { convertFromSI } from '../../../core/units'
import type {
  BeamChartField,
  BeamChartPoint,
  BeamResultRow,
  BeamWarningItem,
} from './types'

interface FieldPresentation {
  readonly label: string
  readonly shortLabel: string
  readonly unit: string
  readonly convert: (value: number) => number
}

const identity = (value: number): number => value

export const BEAM_FIELD_PRESENTATION: Readonly<Record<BeamChartField, FieldPresentation>> = {
  shearN: { label: '剪力', shortLabel: 'V', unit: 'N', convert: identity },
  momentNm: {
    label: '弯矩',
    shortLabel: 'M',
    unit: 'N·mm',
    convert: (value) => convertFromSI(value, 'moment', 'N_mm'),
  },
  rotationRad: { label: '转角', shortLabel: 'θ', unit: 'rad', convert: identity },
  deflectionM: {
    label: '挠度',
    shortLabel: 'v',
    unit: 'mm',
    convert: (value) => convertFromSI(value, 'length', 'mm'),
  },
}

export const BEAM_CHART_FIELDS = Object.freeze(
  (Object.keys(BEAM_FIELD_PRESENTATION) as BeamChartField[]).map((field) => ({
    field,
    ...BEAM_FIELD_PRESENTATION[field],
  })),
)

function sampleValue(sample: BeamSamplePoint, field: BeamFieldKey): number {
  return sample[field]
}

export function buildBeamChartData(
  samples: readonly BeamSamplePoint[],
  field: BeamChartField,
): BeamChartPoint[] {
  const presentation = BEAM_FIELD_PRESENTATION[field]
  return [...samples]
    .sort(
      (left, right) =>
        left.xM - right.xM ||
        (left.side === right.side ? 0 : left.side === 'left' ? -1 : 1),
    )
    .map((sample) => [
      convertFromSI(sample.xM, 'length', 'mm'),
      presentation.convert(sampleValue(sample, field)),
    ])
}

export function convertExtremum(
  candidate: BeamExtremumCandidate,
  field: BeamChartField,
): BeamChartPoint {
  return [
    convertFromSI(candidate.xM, 'length', 'mm'),
    BEAM_FIELD_PRESENTATION[field].convert(candidate.value),
  ]
}

function formatPosition(candidate: BeamExtremumCandidate): string {
  const positionMm = convertFromSI(candidate.xM, 'length', 'mm')
  return `x = ${formatExtremaPosition(positionMm)} mm`
}

function sideLabel(candidate: BeamExtremumCandidate): string {
  return candidate.side === 'left' ? 'left（左侧）' : 'right（右侧）'
}

export function buildExtremaRows(extrema: BeamExtrema): BeamResultRow[] {
  return BEAM_CHART_FIELDS.flatMap(({ field, label, shortLabel, unit, convert }) => {
    const values = extrema[field]
    return [
      {
        key: `${field}-maximum`,
        label: `${label}最大值`,
        value: `${shortLabel} = ${formatEngineeringValue(convert(values.maximum.value))}`,
        unit,
        position: formatPosition(values.maximum),
        side: sideLabel(values.maximum),
      },
      {
        key: `${field}-minimum`,
        label: `${label}最小值`,
        value: `${shortLabel} = ${formatEngineeringValue(convert(values.minimum.value))}`,
        unit,
        position: formatPosition(values.minimum),
        side: sideLabel(values.minimum),
      },
    ]
  })
}

export function buildReactionRows(reactions: BeamReactions): BeamResultRow[] {
  return [
    {
      key: 'left-force',
      label: '左端竖向反力',
      value: formatEngineeringValue(reactions.leftForceN),
      unit: 'N',
    },
    {
      key: 'right-force',
      label: '右端竖向反力',
      value: formatEngineeringValue(reactions.rightForceN),
      unit: 'N',
    },
    {
      key: 'left-moment',
      label: '左端反力矩',
      value: formatEngineeringValue(convertFromSI(reactions.leftMomentNm, 'moment', 'N_mm')),
      unit: 'N·mm',
    },
    {
      key: 'right-moment',
      label: '右端反力矩',
      value: formatEngineeringValue(convertFromSI(reactions.rightMomentNm, 'moment', 'N_mm')),
      unit: 'N·mm',
    },
  ]
}

export function maximumAbsoluteDeflectionM(extrema: BeamExtrema): number {
  return Math.max(
    Math.abs(extrema.deflectionM.minimum.value),
    Math.abs(extrema.deflectionM.maximum.value),
  )
}

export function buildBeamWarnings(
  spanLengthM: number,
  sectionHeightM: number,
  maximumDeflectionM: number,
  externalWarnings: readonly string[] = [],
): BeamWarningItem[] {
  const result: BeamWarningItem[] = []
  if (
    Number.isFinite(spanLengthM) &&
    Number.isFinite(sectionHeightM) &&
    spanLengthM > 0 &&
    sectionHeightM > 0
  ) {
    const slenderness = spanLengthM / sectionHeightM
    if (slenderness < 10) {
      result.push({
        code: 'slenderness',
        severity: 'strong',
        message: `L/h = ${formatEngineeringValue(slenderness)} < 10；Euler–Bernoulli 梁假设可能不适用，结果仅供初算。`,
      })
    }
  }

  if (
    Number.isFinite(spanLengthM) &&
    Number.isFinite(maximumDeflectionM) &&
    spanLengthM > 0 &&
    maximumDeflectionM / spanLengthM > 0.01
  ) {
    const percentage = (maximumDeflectionM / spanLengthM) * 100
    result.push({
      code: 'large-deflection',
      severity: 'strong',
      message: `|v|max/L = ${formatEngineeringValue(percentage)}% > 1%；小变形假设可能不适用，结果仅供初算。`,
    })
  }

  const uniqueExternalWarnings = [...new Set(externalWarnings.map((item) => item.trim()).filter(Boolean))]
  for (const message of uniqueExternalWarnings) {
    result.push({ code: 'external', severity: 'notice', message })
  }
  return result
}
