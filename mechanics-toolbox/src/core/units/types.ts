export type QuantityId =
  | 'length'
  | 'area'
  | 'volume'
  | 'sectionModulus'
  | 'secondMomentOfArea'
  | 'force'
  | 'mass'
  | 'stress'
  | 'pressure'
  | 'elasticModulus'
  | 'moment'
  | 'torque'
  | 'lineLoad'
  | 'density'
  | 'temperature'
  | 'temperatureDifference'
  | 'angle'
  | 'power'
  | 'rotationalSpeed'
  | 'acceleration'
  | 'strain'
  | 'thermalExpansionCoefficient'
  | 'dimensionless'
  | 'flexibility'

export type UnitId =
  | 'mm'
  | 'cm'
  | 'm'
  | 'mm2'
  | 'cm2'
  | 'm2'
  | 'mm3'
  | 'cm3'
  | 'm3'
  | 'mm4'
  | 'cm4'
  | 'm4'
  | 'N'
  | 'kN'
  | 'g'
  | 'kg'
  | 't'
  | 'Pa'
  | 'MPa'
  | 'GPa'
  | 'N_per_mm2'
  | 'N_mm'
  | 'N_m'
  | 'kN_m'
  | 'N_per_mm'
  | 'N_per_m'
  | 'kN_per_m'
  | 't_per_mm3'
  | 'kg_per_m3'
  | 'g_per_cm3'
  | 'K'
  | 'degC'
  | 'degF'
  | 'deltaK'
  | 'deltaDegC'
  | 'deltaDegF'
  | 'rad'
  | 'deg'
  | 'W'
  | 'kW'
  | 'r_per_s'
  | 'r_per_min'
  | 'mm_per_s2'
  | 'm_per_s2'
  | 'microstrain'
  | 'one'
  | 'per_degC'
  | 'per_K'
  | 'mm_per_N'
  | 'm_per_N'

export interface UnitDefinition {
  readonly id: UnitId
  readonly label: string
  readonly symbol: string
  readonly toSI: (value: number) => number
  readonly fromSI: (value: number) => number
}

export interface QuantityDefinition {
  readonly id: QuantityId
  readonly label: string
  readonly siUnit: UnitId
  readonly units: readonly UnitDefinition[]
}

export type UnitPresetId = 'engineering' | 'si'

export interface UnitPreset {
  readonly id: UnitPresetId
  readonly label: string
  readonly units: Readonly<Record<QuantityId, UnitId>>
}

export interface ConversionResult {
  readonly quantity: QuantityId
  readonly inputValue: number
  readonly fromUnit: UnitId
  readonly siValue: number
  readonly outputValue: number
  readonly toUnit: UnitId
}
