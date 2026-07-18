import type { BeamSupport } from '../../../core/beam'
import type { SectionKind } from '../../../core/sections'
import type { UnitId } from '../../../core/units'

export type BeamDirectionMode = 'magnitudeDirection' | 'signed'
export type ForceDirection = 'up' | 'down'
export type MomentDirection = 'counterClockwise' | 'clockwise'
export type BeamLoadDraftType = 'pointForce' | 'pointMoment' | 'uniformLoad'

export interface UnitValueDraft {
  value: string
  unit: UnitId
}

export type SectionDimensionKey =
  | 'width'
  | 'height'
  | 'outerWidth'
  | 'outerHeight'
  | 'innerWidth'
  | 'innerHeight'
  | 'diameter'
  | 'outerDiameter'
  | 'innerDiameter'

export interface BeamSectionDraft {
  kind: SectionKind
  dimensions: Partial<Record<SectionDimensionKey, UnitValueDraft>>
}

interface BeamLoadDraftBase {
  id: string
  type: BeamLoadDraftType
}

export interface PointForceDraft extends BeamLoadDraftBase {
  type: 'pointForce'
  position: UnitValueDraft
  magnitude: UnitValueDraft
  direction: ForceDirection
}

export interface PointMomentDraft extends BeamLoadDraftBase {
  type: 'pointMoment'
  position: UnitValueDraft
  magnitude: UnitValueDraft
  direction: MomentDirection
}

export interface UniformLoadDraft extends BeamLoadDraftBase {
  type: 'uniformLoad'
  start: UnitValueDraft
  end: UnitValueDraft
  magnitude: UnitValueDraft
  direction: ForceDirection
}

export type BeamLoadDraft = PointForceDraft | PointMomentDraft | UniformLoadDraft

export interface BeamInputDraft {
  support: BeamSupport
  directionMode: BeamDirectionMode
  length: UnitValueDraft
  elasticModulus: UnitValueDraft
  section: BeamSectionDraft
  loads: BeamLoadDraft[]
}

export interface BeamInputError {
  field: string
  message: string
}

export const BEAM_SUPPORT_OPTIONS = [
  { value: 'simplySupported', label: '简支梁' },
  { value: 'cantileverLeft', label: '左端固支悬臂梁' },
  { value: 'cantileverRight', label: '右端固支悬臂梁' },
] as const satisfies ReadonlyArray<{ value: BeamSupport; label: string }>

export const SECTION_OPTIONS = [
  { value: 'rectangle', label: '矩形' },
  { value: 'hollowRectangle', label: '空心矩形' },
  { value: 'solidCircle', label: '实心圆' },
  { value: 'circularTube', label: '圆管' },
] as const satisfies ReadonlyArray<{ value: SectionKind; label: string }>

const unitValue = (value: string, unit: UnitId): UnitValueDraft => ({ value, unit })

export function createSectionDraft(kind: SectionKind): BeamSectionDraft {
  switch (kind) {
    case 'rectangle':
      return {
        kind,
        dimensions: {
          width: unitValue('96', 'mm'),
          height: unitValue('100', 'mm'),
        },
      }
    case 'hollowRectangle':
      return {
        kind,
        dimensions: {
          outerWidth: unitValue('100', 'mm'),
          outerHeight: unitValue('120', 'mm'),
          innerWidth: unitValue('80', 'mm'),
          innerHeight: unitValue('100', 'mm'),
        },
      }
    case 'solidCircle':
      return { kind, dimensions: { diameter: unitValue('100', 'mm') } }
    case 'circularTube':
      return {
        kind,
        dimensions: {
          outerDiameter: unitValue('100', 'mm'),
          innerDiameter: unitValue('80', 'mm'),
        },
      }
  }
}

export function createEmptyLoad(id: string, type: BeamLoadDraftType): BeamLoadDraft {
  if (type === 'pointForce') {
    return {
      id,
      type,
      position: unitValue('', 'mm'),
      magnitude: unitValue('', 'N'),
      direction: 'down',
    }
  }
  if (type === 'pointMoment') {
    return {
      id,
      type,
      position: unitValue('', 'mm'),
      magnitude: unitValue('', 'N_mm'),
      direction: 'counterClockwise',
    }
  }
  return {
    id,
    type,
    start: unitValue('', 'mm'),
    end: unitValue('', 'mm'),
    magnitude: unitValue('', 'N_per_mm'),
    direction: 'down',
  }
}

export function createDefaultBeamInputDraft(): BeamInputDraft {
  return {
    support: 'simplySupported',
    directionMode: 'magnitudeDirection',
    length: unitValue('1000', 'mm'),
    elasticModulus: unitValue('200000', 'MPa'),
    section: createSectionDraft('rectangle'),
    loads: [
      {
        id: 'load-1',
        type: 'pointForce',
        position: unitValue('400', 'mm'),
        magnitude: unitValue('10000', 'N'),
        direction: 'down',
      },
    ],
  }
}

export function changeDirectionMode(
  draft: BeamInputDraft,
  directionMode: BeamDirectionMode,
): BeamInputDraft {
  if (draft.directionMode === directionMode) return draft
  const loads = draft.loads.map((load): BeamLoadDraft => {
    const parsed = Number(load.magnitude.value)
    if (!Number.isFinite(parsed) || load.magnitude.value.trim() === '') return { ...load }
    if (directionMode === 'signed') {
      const sign = load.type === 'pointMoment'
        ? load.direction === 'counterClockwise' ? 1 : -1
        : load.direction === 'up' ? 1 : -1
      return { ...load, magnitude: { ...load.magnitude, value: String(Math.abs(parsed) * sign) } }
    }
    const magnitude = { ...load.magnitude, value: String(Math.abs(parsed)) }
    if (load.type === 'pointMoment') {
      return { ...load, magnitude, direction: parsed >= 0 ? 'counterClockwise' : 'clockwise' }
    }
    return { ...load, magnitude, direction: parsed >= 0 ? 'up' : 'down' }
  })
  return { ...draft, directionMode, loads }
}
