export { ThinCylinderCalculator } from './thin-cylinder'
export { LameCylinderCalculator } from './lame-cylinder'
export { CircularPlateCalculator } from './circular-plate'
export { RectangularPlateCalculator } from './rectangular-plate'
export { BucklingCalculator } from './buckling'

export interface P3ModuleRegistration {
  readonly id: string
  readonly label: string
  readonly version: '1.0.0'
  readonly formulaIds: readonly string[]
  readonly status: 'accepted'
}

export const P3_MODULES: readonly P3ModuleRegistration[] = [
  { id: 'thin-cylinder', label: '薄壁圆筒', version: '1.0.0', formulaIds: ['P3-TW-PRESSURE-OPEN-1', 'P3-TW-PRESSURE-CLOSED-1'], status: 'accepted' },
  { id: 'lame-cylinder', label: '厚壁圆筒 Lamé 解', version: '1.0.0', formulaIds: ['P3-LM-STRESS-1', 'P3-LM-DISPLACEMENT-1'], status: 'accepted' },
  { id: 'circular-plate', label: '圆板轴对称弯曲', version: '1.0.0', formulaIds: ['P3-CP-CLAMPED-UNIFORM-1', 'P3-CP-SIMPLE-UNIFORM-1'], status: 'accepted' },
  { id: 'rectangular-plate', label: '矩形薄板弯曲', version: '1.0.0', formulaIds: ['P3-RP-SSSS-UNIFORM-1', 'P3-RP-CCCC-RITZ-1'], status: 'accepted' },
  { id: 'plate-shell-buckling', label: '板与圆柱壳屈曲', version: '1.0.0', formulaIds: ['P3-BK-PLATE-SSSS-UNIAXIAL-1', 'P3-BK-SHELL-NASA-SP8007-AXIAL-1'], status: 'accepted' },
]
