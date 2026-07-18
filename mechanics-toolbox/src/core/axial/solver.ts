import type {
  AxialAnalysisInput,
  AxialAnalysisResult,
  AxialCalculationResult,
  AxialSegmentInput,
  AxialSegmentResult,
  AxialValidationError,
} from './types'

function finiteError(
  errors: AxialValidationError[],
  field: string,
  label: string,
  value: number,
): void {
  if (!Number.isFinite(value)) errors.push({ field, message: `${label}必须为有限数值` })
}

function positiveError(
  errors: AxialValidationError[],
  field: string,
  label: string,
  value: number,
): void {
  if (!Number.isFinite(value)) {
    finiteError(errors, field, label, value)
  } else if (value <= 0) {
    errors.push({ field, message: `${label}必须大于 0` })
  }
}

function validateSegment(
  segment: AxialSegmentInput,
  index: number,
  errors: AxialValidationError[],
): void {
  const prefix = `segments.${index}`
  if (!segment.id.trim()) errors.push({ field: `${prefix}.id`, message: `第 ${index + 1} 段编号不能为空` })
  positiveError(errors, `${prefix}.length`, `第 ${index + 1} 段长度 L`, segment.lengthM)
  positiveError(errors, `${prefix}.area`, `第 ${index + 1} 段面积 A`, segment.areaM2)
  positiveError(errors, `${prefix}.elasticModulus`, `第 ${index + 1} 段弹性模量 E`, segment.elasticModulusPa)
  finiteError(
    errors,
    `${prefix}.thermalExpansion`,
    `第 ${index + 1} 段线膨胀系数 α`,
    segment.thermalExpansionPerK,
  )
  finiteError(
    errors,
    `${prefix}.deltaTemperature`,
    `第 ${index + 1} 段温差 ΔT`,
    segment.deltaTemperatureK,
  )
}

/**
 * 串联直杆一维线弹性解。拉为正、压为负、升温为正。
 * 完全约束模式通过 ΣΔL=0 求共同约束内力；不接受外加端力，避免边界混用。
 */
export function calculateAxialResponse(input: AxialAnalysisInput): AxialCalculationResult {
  const errors: AxialValidationError[] = []
  if (input.segments.length === 0) {
    errors.push({ field: 'segments', message: '至少需要 1 个杆段' })
  }
  input.segments.forEach((segment, index) => validateSegment(segment, index, errors))
  if (input.boundary === 'free') {
    finiteError(errors, 'axialForce', '轴向力 N', input.axialForceN)
  }
  if (errors.length > 0) return { ok: false, errors }

  const totalLengthM = input.segments.reduce((sum, segment) => sum + segment.lengthM, 0)
  const axialComplianceMPerN = input.segments.reduce(
    (sum, segment) => sum + segment.lengthM / (segment.elasticModulusPa * segment.areaM2),
    0,
  )
  const freeThermalDeformationM = input.segments.reduce(
    (sum, segment) =>
      sum + segment.thermalExpansionPerK * segment.deltaTemperatureK * segment.lengthM,
    0,
  )
  const appliedForceN = input.boundary === 'free' ? input.axialForceN : 0
  const constraintForceN = input.boundary === 'fullyRestrained'
    ? -freeThermalDeformationM / axialComplianceMPerN
    : 0
  const internalForceN = appliedForceN + constraintForceN

  const segments: AxialSegmentResult[] = input.segments.map((segment) => {
    const stressPa = internalForceN / segment.areaM2
    const mechanicalStrain = stressPa / segment.elasticModulusPa
    const thermalStrain = segment.thermalExpansionPerK * segment.deltaTemperatureK
    const mechanicalDeformationM = mechanicalStrain * segment.lengthM
    const thermalDeformationM = thermalStrain * segment.lengthM
    return {
      ...segment,
      internalForceN,
      stressPa,
      mechanicalStrain,
      thermalStrain,
      totalStrain: mechanicalStrain + thermalStrain,
      mechanicalDeformationM,
      thermalDeformationM,
      totalDeformationM: mechanicalDeformationM + thermalDeformationM,
    }
  })
  const mechanicalDeformationM = internalForceN * axialComplianceMPerN
  const totalDeformationM = mechanicalDeformationM + freeThermalDeformationM

  const derived = [
    totalLengthM,
    axialComplianceMPerN,
    freeThermalDeformationM,
    constraintForceN,
    internalForceN,
    mechanicalDeformationM,
    totalDeformationM,
    ...segments.flatMap((segment) => [
      segment.stressPa,
      segment.mechanicalStrain,
      segment.thermalStrain,
      segment.totalStrain,
      segment.totalDeformationM,
    ]),
  ]
  if (derived.some((value) => !Number.isFinite(value))) {
    return {
      ok: false,
      errors: [{ field: 'result', message: '输入量级导致计算结果溢出，请检查单位和数值' }],
    }
  }

  const value: AxialAnalysisResult = {
    boundary: input.boundary,
    totalLengthM,
    axialComplianceMPerN,
    appliedForceN,
    constraintForceN,
    internalForceN,
    mechanicalDeformationM,
    freeThermalDeformationM,
    totalDeformationM,
    segments,
  }
  return { ok: true, value, errors: [] }
}
