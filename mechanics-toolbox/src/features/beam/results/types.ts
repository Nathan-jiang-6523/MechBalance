import type { BeamFieldKey } from '../../../core/beam'

export type BeamChartField = BeamFieldKey

export type BeamShearStressSummary =
  | { readonly supported: true; readonly maximumShearStressPa: number }
  | { readonly supported: false; readonly message: string }

export interface BeamStressSummary {
  readonly controllingMomentPositionM: number
  readonly topBendingStressPa: number
  readonly bottomBendingStressPa: number
  readonly maximumAbsoluteBendingStressPa: number
  readonly shear: BeamShearStressSummary
}

export interface BeamWarningItem {
  readonly code: 'slenderness' | 'large-deflection' | 'external'
  readonly severity: 'strong' | 'notice'
  readonly message: string
}

export interface BeamResultRow {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly unit: string
  readonly position?: string
  readonly side?: string
}

export type BeamChartPoint = readonly [xMillimetres: number, value: number]
