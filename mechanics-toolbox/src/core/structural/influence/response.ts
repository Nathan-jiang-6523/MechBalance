import {
  createStructuralIssue,
  type InfluenceLineResponse,
  type StructuralIssue,
} from '../contracts'

export type InfluencePointSide = 'left' | 'at' | 'right' | 'continuous'
export type InfluenceOrdinateUnit = '1' | 'm' | 'm/N'

export function influenceResponseId(response: InfluenceLineResponse): string {
  return 'position' in response ? `${response.type}@${response.position}` : response.type
}

export function influenceOrdinateUnit(response: InfluenceLineResponse): InfluenceOrdinateUnit {
  if (response.type === 'section-moment') return 'm'
  if (response.type === 'displacement') return 'm/N'
  return '1'
}

export function validateInfluenceDefinition(
  span: number,
  response: InfluenceLineResponse,
): readonly StructuralIssue[] {
  const issues: StructuralIssue[] = []
  if (!Number.isFinite(span)) {
    issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `beam.span 非法值 ${String(span)}`, {
      field: 'beam.span',
    }))
  } else if (span <= 0) {
    issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `beam.span 非法值 ${String(span)}`, {
      field: 'beam.span',
    }))
  }
  if ('position' in response) {
    if (!Number.isFinite(response.position)) {
      issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `response.position 非法值 ${String(response.position)}`, {
        field: 'response.position',
      }))
    } else if (Number.isFinite(span) && (response.position < 0 || response.position > span)) {
      issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '响应位置必须位于简支梁跨度内', {
        field: 'response.position',
      }))
    }
  }
  if (response.type === 'section-shear' && response.retainBothLimits !== true) {
    issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '截面剪力必须保留左右极限', {
      field: 'response.retainBothLimits',
    }))
  }
  if (response.type === 'displacement') {
    for (const [field, value] of [['E', response.E], ['I', response.I]] as const) {
      if (!Number.isFinite(value)) {
        issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `response.${field} 非法值 ${String(value)}`, {
          field: `response.${field}`,
        }))
      } else if (value <= 0) {
        issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `response.${field} 非法值 ${String(value)}`, {
          field: `response.${field}`,
        }))
      }
    }
  }
  return issues
}

function requireDefinition(span: number, response: InfluenceLineResponse): void {
  const issues = validateInfluenceDefinition(span, response)
  if (issues.length > 0) throw new RangeError(issues[0]!.message)
}

/** Unit downward moving-load response on a simply supported beam. */
export function evaluateInfluenceOrdinate(
  span: number,
  response: InfluenceLineResponse,
  loadPosition: number,
  side: InfluencePointSide = 'at',
): number {
  requireDefinition(span, response)
  if (!Number.isFinite(loadPosition)) throw new RangeError('loadPosition 必须为有限数')
  if (loadPosition < 0 || loadPosition > span) return 0
  if (response.type === 'left-reaction') return cleanZero(1 - loadPosition / span)
  if (response.type === 'right-reaction') return cleanZero(loadPosition / span)
  if (!('position' in response)) throw new RangeError('未知影响线响应')

  const section = response.position
  if (response.type === 'section-moment') {
    return cleanZero(loadPosition <= section
      ? loadPosition * (span - section) / span
      : section * (span - loadPosition) / span)
  }
  if (response.type === 'section-shear') {
    if (loadPosition === 0 || loadPosition === span) return 0
    if (loadPosition < section || (loadPosition === section && side === 'left')) {
      return cleanZero(-loadPosition / span)
    }
    return cleanZero((span - loadPosition) / span)
  }

  if (response.type !== 'displacement') throw new RangeError('未知影响线响应')
  const observation = section
  const left = Math.min(observation, loadPosition)
  const right = Math.max(observation, loadPosition)
  const value = -left * (span - right)
    * (span ** 2 - left ** 2 - (span - right) ** 2)
    / (6 * span * response.E * response.I)
  return cleanZero(value)
}

/** Derivative with respect to moving-load position inside one response segment. */
export function evaluateInfluenceDerivative(
  span: number,
  response: InfluenceLineResponse,
  loadPosition: number,
  side: InfluencePointSide = 'at',
): number {
  requireDefinition(span, response)
  if (!Number.isFinite(loadPosition)) throw new RangeError('loadPosition 必须为有限数')
  if (loadPosition < 0 || loadPosition > span) return 0
  if (response.type === 'left-reaction') return -1 / span
  if (response.type === 'right-reaction') return 1 / span
  if (!('position' in response)) throw new RangeError('未知影响线响应')
  const section = response.position
  if (response.type === 'section-moment') {
    return loadPosition < section || (loadPosition === section && side === 'left')
      ? (span - section) / span
      : -section / span
  }
  if (response.type === 'section-shear') return -1 / span

  if (response.type !== 'displacement') throw new RangeError('未知影响线响应')
  if (loadPosition <= section) {
    const factor = -(span - section) / (6 * span * response.E * response.I)
    const base = span ** 2 - (span - section) ** 2
    return factor * (base - 3 * loadPosition ** 2)
  }
  const distanceFromRight = span - loadPosition
  const factor = section / (6 * span * response.E * response.I)
  const base = span ** 2 - section ** 2
  return factor * (base - 3 * distanceFromRight ** 2)
}

export function influenceBreakpoints(
  span: number,
  response: InfluenceLineResponse,
): readonly number[] {
  requireDefinition(span, response)
  return 'position' in response ? [0, response.position, span] : [0, span]
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value
}
