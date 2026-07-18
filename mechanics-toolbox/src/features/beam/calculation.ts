import {
  findBeamExtrema,
  recoverBeamShearStressPa,
  recoverBendingStressPa,
  sampleBeamSolution,
  solveBeam,
  type BeamExtrema,
  type BeamSamplePoint,
  type BeamSolution,
} from '../../core/beam'
import type { BuiltBeamModel } from './input/adapter'
import type { BeamStressSummary } from './results'

export interface BeamCalculationBundle {
  builtModel: BuiltBeamModel
  solution: BeamSolution
  extrema: BeamExtrema
  samples: BeamSamplePoint[]
  stressSummary: BeamStressSummary
}

export type BeamCalculationResult =
  | { ok: true; value: BeamCalculationBundle }
  | { ok: false; errors: string[] }

function controllingCandidate(extrema: BeamExtrema) {
  const { minimum, maximum } = extrema.momentNm
  return Math.abs(maximum.value) >= Math.abs(minimum.value) ? maximum : minimum
}

function controllingShearN(extrema: BeamExtrema): number {
  const { minimum, maximum } = extrema.shearN
  return Math.abs(maximum.value) >= Math.abs(minimum.value)
    ? maximum.value
    : minimum.value
}

function buildStressSummary(
  model: BuiltBeamModel,
  extrema: BeamExtrema,
): BeamStressSummary {
  const moment = controllingCandidate(extrema)
  const edgeM = model.sectionHeightM / 2
  const topBendingStressPa = recoverBendingStressPa(
    moment.value,
    edgeM,
    model.sectionProperties.ixM4,
  )
  const bottomBendingStressPa = recoverBendingStressPa(
    moment.value,
    -edgeM,
    model.sectionProperties.ixM4,
  )
  const shear = recoverBeamShearStressPa({
    sectionKind: model.sectionKind,
    shearForceN: controllingShearN(extrema),
    areaM2: model.sectionProperties.areaM2,
    heightM: model.sectionHeightM,
    yFromCentroidM: 0,
  })

  return {
    controllingMomentPositionM: moment.xM,
    topBendingStressPa,
    bottomBendingStressPa,
    maximumAbsoluteBendingStressPa: Math.max(
      Math.abs(topBendingStressPa),
      Math.abs(bottomBendingStressPa),
    ),
    shear: shear.ok
      ? { supported: true, maximumShearStressPa: Math.abs(shear.shearStressPa) }
      : { supported: false, message: shear.message },
  }
}

export function runBeamCalculation(model: BuiltBeamModel): BeamCalculationResult {
  try {
    const solved = solveBeam(model)
    if (!solved.ok) return { ok: false, errors: solved.errors.map(({ message }) => message) }
    const extrema = findBeamExtrema(solved.value)
    const samples = sampleBeamSolution(solved.value, extrema)
    return {
      ok: true,
      value: {
        builtModel: model,
        solution: solved.value,
        extrema,
        samples,
        stressSummary: buildStressSummary(model, extrema),
      },
    }
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : '梁综合计算失败'],
    }
  }
}
