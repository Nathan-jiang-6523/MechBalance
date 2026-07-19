import type {
  QuantityDefinition,
  QuantityId,
  UnitDefinition,
  UnitId,
  UnitPreset,
} from './types'

function linearUnit(
  id: UnitId,
  label: string,
  symbol: string,
  factorToSI: number,
): UnitDefinition {
  return {
    id,
    label,
    symbol,
    toSI: (value) => value * factorToSI,
    fromSI: (value) => value / factorToSI,
  }
}

function affineUnit(
  id: UnitId,
  label: string,
  symbol: string,
  toSI: (value: number) => number,
  fromSI: (value: number) => number,
): UnitDefinition {
  return { id, label, symbol, toSI, fromSI }
}

const lengthUnits = [
  linearUnit('mm', '毫米', 'mm', 1e-3),
  linearUnit('m', '米', 'm', 1),
  linearUnit('cm', '厘米', 'cm', 1e-2),
] as const

const areaUnits = [
  linearUnit('mm2', '平方毫米', 'mm²', 1e-6),
  linearUnit('cm2', '平方厘米', 'cm²', 1e-4),
  linearUnit('m2', '平方米', 'm²', 1),
] as const

const cubicLengthUnits = [
  linearUnit('mm3', '立方毫米', 'mm³', 1e-9),
  linearUnit('cm3', '立方厘米', 'cm³', 1e-6),
  linearUnit('m3', '立方米', 'm³', 1),
] as const

const fourthPowerLengthUnits = [
  linearUnit('mm4', '四次方毫米', 'mm⁴', 1e-12),
  linearUnit('cm4', '四次方厘米', 'cm⁴', 1e-8),
  linearUnit('m4', '四次方米', 'm⁴', 1),
] as const

const forceUnits = [
  linearUnit('N', '牛顿', 'N', 1),
  linearUnit('kN', '千牛', 'kN', 1e3),
] as const

const massUnits = [
  linearUnit('t', '质量吨', 't', 1e3),
  linearUnit('kg', '千克', 'kg', 1),
  linearUnit('g', '克', 'g', 1e-3),
] as const

const stressUnits = [
  linearUnit('MPa', '兆帕', 'MPa', 1e6),
  linearUnit('GPa', '吉帕', 'GPa', 1e9),
  linearUnit('Pa', '帕', 'Pa', 1),
  linearUnit('N_per_mm2', '牛顿每平方毫米', 'N/mm²', 1e6),
] as const

const momentUnits = [
  linearUnit('N_mm', '牛顿毫米', 'N·mm', 1e-3),
  linearUnit('N_m', '牛顿米', 'N·m', 1),
  linearUnit('kN_m', '千牛米', 'kN·m', 1e3),
] as const

const lineLoadUnits = [
  linearUnit('N_per_mm', '牛顿每毫米', 'N/mm', 1e3),
  linearUnit('kN_per_m', '千牛每米', 'kN/m', 1e3),
  linearUnit('N_per_m', '牛顿每米', 'N/m', 1),
] as const

const densityUnits = [
  linearUnit('t_per_mm3', '质量吨每立方毫米', 't/mm³', 1e12),
  linearUnit('kg_per_m3', '千克每立方米', 'kg/m³', 1),
  linearUnit('g_per_cm3', '克每立方厘米', 'g/cm³', 1e3),
] as const

const temperatureUnits = [
  affineUnit('degC', '摄氏度', '°C', (value) => value + 273.15, (value) => value - 273.15),
  affineUnit(
    'degF',
    '华氏度',
    '°F',
    (value) => ((value - 32) * 5) / 9 + 273.15,
    (value) => ((value - 273.15) * 9) / 5 + 32,
  ),
  linearUnit('K', '开尔文', 'K', 1),
] as const

const temperatureDifferenceUnits = [
  linearUnit('deltaDegC', '摄氏温差', 'Δ°C', 1),
  linearUnit('deltaDegF', '华氏温差', 'Δ°F', 5 / 9),
  linearUnit('deltaK', '开尔文温差', 'ΔK', 1),
] as const

const angleUnits = [
  linearUnit('rad', '弧度', 'rad', 1),
  linearUnit('deg', '度', '°', Math.PI / 180),
] as const

const powerUnits = [
  linearUnit('kW', '千瓦', 'kW', 1e3),
  linearUnit('W', '瓦', 'W', 1),
] as const

const rotationalSpeedUnits = [
  linearUnit('r_per_min', '转每分钟', 'r/min', 1 / 60),
  linearUnit('r_per_s', '转每秒', 'r/s', 1),
] as const

const accelerationUnits = [
  linearUnit('mm_per_s2', '毫米每二次方秒', 'mm/s²', 1e-3),
  linearUnit('m_per_s2', '米每二次方秒', 'm/s²', 1),
] as const

const strainUnits = [
  linearUnit('microstrain', '微应变', 'με', 1e-6),
  linearUnit('one', '无量纲应变', '1', 1),
] as const

const thermalExpansionCoefficientUnits = [
  linearUnit('per_degC', '每摄氏度', '1/°C', 1),
  linearUnit('per_K', '每开尔文', '1/K', 1),
] as const

const dimensionlessUnits = [
  linearUnit('one', '无量纲', '1', 1),
] as const

const flexibilityUnits = [
  linearUnit('mm_per_N', '毫米每牛顿', 'mm/N', 1e-3),
  linearUnit('m_per_N', '米每牛顿', 'm/N', 1),
] as const

function quantity(
  id: QuantityId,
  label: string,
  siUnit: UnitId,
  units: readonly UnitDefinition[],
): QuantityDefinition {
  return { id, label, siUnit, units }
}

export const QUANTITY_CATALOG: Readonly<Record<QuantityId, QuantityDefinition>> = {
  length: quantity('length', '长度', 'm', lengthUnits),
  area: quantity('area', '面积', 'm2', areaUnits),
  volume: quantity('volume', '体积', 'm3', cubicLengthUnits),
  sectionModulus: quantity('sectionModulus', '截面模量', 'm3', cubicLengthUnits),
  secondMomentOfArea: quantity(
    'secondMomentOfArea',
    '截面二次矩',
    'm4',
    fourthPowerLengthUnits,
  ),
  force: quantity('force', '力', 'N', forceUnits),
  mass: quantity('mass', '质量', 'kg', massUnits),
  stress: quantity('stress', '应力', 'Pa', stressUnits),
  pressure: quantity('pressure', '压力', 'Pa', stressUnits),
  elasticModulus: quantity('elasticModulus', '弹性模量', 'Pa', stressUnits),
  moment: quantity('moment', '力矩', 'N_m', momentUnits),
  torque: quantity('torque', '转矩', 'N_m', momentUnits),
  lineLoad: quantity('lineLoad', '线载荷', 'N_per_m', lineLoadUnits),
  density: quantity('density', '密度', 'kg_per_m3', densityUnits),
  temperature: quantity('temperature', '温度', 'K', temperatureUnits),
  temperatureDifference: quantity(
    'temperatureDifference',
    '温差',
    'deltaK',
    temperatureDifferenceUnits,
  ),
  angle: quantity('angle', '角度', 'rad', angleUnits),
  power: quantity('power', '功率', 'W', powerUnits),
  rotationalSpeed: quantity('rotationalSpeed', '转速', 'r_per_s', rotationalSpeedUnits),
  acceleration: quantity('acceleration', '加速度', 'm_per_s2', accelerationUnits),
  strain: quantity('strain', '应变', 'one', strainUnits),
  thermalExpansionCoefficient: quantity(
    'thermalExpansionCoefficient',
    '线膨胀系数',
    'per_K',
    thermalExpansionCoefficientUnits,
  ),
  dimensionless: quantity('dimensionless', '无量纲', 'one', dimensionlessUnits),
  flexibility: quantity('flexibility', '柔度', 'm_per_N', flexibilityUnits),
}

const engineeringUnits: Readonly<Record<QuantityId, UnitId>> = {
  length: 'mm',
  area: 'mm2',
  volume: 'mm3',
  sectionModulus: 'mm3',
  secondMomentOfArea: 'mm4',
  force: 'N',
  mass: 't',
  stress: 'MPa',
  pressure: 'MPa',
  elasticModulus: 'MPa',
  moment: 'N_mm',
  torque: 'N_mm',
  lineLoad: 'N_per_mm',
  density: 't_per_mm3',
  temperature: 'degC',
  temperatureDifference: 'deltaDegC',
  angle: 'rad',
  power: 'kW',
  rotationalSpeed: 'r_per_min',
  acceleration: 'mm_per_s2',
  strain: 'microstrain',
  thermalExpansionCoefficient: 'per_degC',
  dimensionless: 'one',
  flexibility: 'mm_per_N',
}

const siUnits = Object.fromEntries(
  Object.values(QUANTITY_CATALOG).map((definition) => [definition.id, definition.siUnit]),
) as Record<QuantityId, UnitId>

export const UNIT_PRESETS: readonly UnitPreset[] = [
  { id: 'engineering', label: '工程单位（t–mm–s–N–MPa）', units: engineeringUnits },
  { id: 'si', label: 'SI 单位', units: siUnits },
]
