import { evaluateCircularShellLength, evaluateCircularShellThinness, summarizeApplicability } from '../applicability'
import { BucklingInputError, type ShellBucklingDraftInput, type ShellBucklingInput, type ShellBucklingResult } from './types'
import { IDEAL_BUCKLING_WARNING } from './warnings'

function positive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new BucklingInputError(`${label}必须为正有限数`)
}

export function validateShellBucklingInput(input: ShellBucklingDraftInput): void {
  if (input.boundary !== 'simply-supported-axial') throw new BucklingInputError('必须显式选择简支圆柱壳均匀轴压边界')
  positive('长度 L', input.lengthM)
  positive('平均半径 r', input.meanRadiusM)
  positive('厚度 t', input.thicknessM)
  positive('弹性模量 E', input.material.elasticModulusPa)
  positive('施加压缩膜力 Nx', input.appliedCompressionNPerM)
  if (!Number.isFinite(input.material.poissonRatio) || input.material.poissonRatio <= -1 || input.material.poissonRatio >= .5) throw new BucklingInputError('泊松比必须满足 -1<ν<0.5')
  if (!Number.isInteger(input.maximumAxialHalfWaves) || input.maximumAxialHalfWaves < 1 || input.maximumAxialHalfWaves > 200) throw new BucklingInputError('轴向半波数上限必须是 1～200 的整数')
  if (!Number.isInteger(input.maximumCircumferentialWaves) || input.maximumCircumferentialWaves < 0 || input.maximumCircumferentialWaves > 200) throw new BucklingInputError('环向波数上限必须是 0～200 的整数')
  const thinness = evaluateCircularShellThinness(input.thicknessM, input.meanRadiusM)
  if (!thinness || thinness.level === 'blocked') throw new BucklingInputError(thinness.message)
}

interface ShellMode { readonly m: number; readonly n: number; readonly lineLoadNPerM: number }

function searchMode(input: ShellBucklingInput, rigidityNm: number, z: number): ShellMode {
  let best: ShellMode = { m: 1, n: 0, lineLoadNPerM: Number.POSITIVE_INFINITY }
  for (let m = 1; m <= input.maximumAxialHalfWaves; m += 1) {
    for (let n = 0; n <= input.maximumCircumferentialWaves; n += 1) {
      const beta = n * input.lengthM / (m * Math.PI * input.meanRadiusM)
      const common = m ** 2 * (1 + beta ** 2) ** 2
      const kx = common + 12 * z ** 2 / (Math.PI ** 4 * common)
      const lineLoadNPerM = kx * Math.PI ** 2 * rigidityNm / input.lengthM ** 2
      if (lineLoadNPerM < best.lineLoadNPerM) best = { m, n, lineLoadNPerM }
    }
  }
  return best
}

export function solveShellBuckling(input: ShellBucklingInput): ShellBucklingResult {
  validateShellBucklingInput(input)
  const { elasticModulusPa: e, poissonRatio: nu } = input.material
  const rigidityNm = e * input.thicknessM ** 3 / (12 * (1 - nu ** 2))
  const curvatureParameterZ = input.lengthM ** 2 * Math.sqrt(1 - nu ** 2) / (input.meanRadiusM * input.thicknessM)
  const mode = searchMode(input, rigidityNm, curvatureParameterZ)
  const criticalStressPa = e * (input.thicknessM / input.meanRadiusM) / Math.sqrt(3 * (1 - nu ** 2))
  const classicalLineLoadNPerM = criticalStressPa * input.thicknessM
  const applicability = summarizeApplicability([
    evaluateCircularShellThinness(input.thicknessM, input.meanRadiusM),
    evaluateCircularShellLength(input.lengthM, input.meanRadiusM),
  ])
  return {
    formulaId: 'P3-BK-SHELL-NASA-SP8007-AXIAL-1', solutionNature: 'ideal-elastic-estimate', rigidityNm,
    curvatureParameterZ, axialHalfWaves: mode.m, circumferentialWaves: mode.n,
    searchLineLoadNPerM: mode.lineLoadNPerM, classicalLineLoadNPerM,
    criticalLineLoadNPerM: classicalLineLoadNPerM, criticalStressPa,
    criticalTotalForceN: classicalLineLoadNPerM * 2 * Math.PI * input.meanRadiusM,
    appliedCompressionNPerM: input.appliedCompressionNPerM,
    utilization: input.appliedCompressionNPerM / classicalLineLoadNPerM,
    applicability, warnings: [IDEAL_BUCKLING_WARNING, ...applicability.checks.filter((check) => check.level !== 'within').map((check) => check.message)],
  }
}
