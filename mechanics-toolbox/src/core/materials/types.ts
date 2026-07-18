export interface MaterialSource {
  title: string
  url: string
  accessedOn: string
  supports: 'designation' | 'elastic-modulus' | 'density'
}

export interface MaterialPreset {
  id: 'al-6061-t6' | 'spcc'
  name: string
  condition: string
  /** SI internal unit: Pa. */
  elasticModulusPa: number
  /** SI internal unit: kg/m3. */
  densityKgM3: number
  editable: true
  nominalOnly: true
  warning: string
  sources: MaterialSource[]
}
