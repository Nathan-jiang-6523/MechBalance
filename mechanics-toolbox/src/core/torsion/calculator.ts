import type {
  CircularShaftInput,
  CircularShaftTorsionResult,
  PowerTransmissionInput,
  PowerTransmissionResult,
} from './types'
import { TorsionCalculationError } from './types'

const TWO_PI = 2 * Math.PI

function finite(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new TorsionCalculationError('NON_FINITE_INPUT', `${field}必须是有限数值`, field)
  }
  return value
}

function positive(value: number, field: string, code: 'NON_POSITIVE_LENGTH' | 'NON_POSITIVE_SHEAR_MODULUS'): number {
  finite(value, field)
  if (value <= 0) throw new TorsionCalculationError(code, `${field}必须大于 0`, field)
  return value
}

export function calculateCircularShaftTorsion(
  input: CircularShaftInput,
): CircularShaftTorsionResult {
  const lengthM = positive(input.lengthM, '轴长', 'NON_POSITIVE_LENGTH')
  const shearModulusPa = positive(
    input.shearModulusPa,
    '剪切模量',
    'NON_POSITIVE_SHEAR_MODULUS',
  )
  const torqueNm = finite(input.torqueNm, '扭矩')

  let torsionConstantM4: number
  let outerRadiusM: number

  if (input.kind === 'solid') {
    const diameterM = finite(input.diameterM, '直径')
    if (diameterM <= 0) {
      throw new TorsionCalculationError('NON_POSITIVE_DIAMETER', '直径必须大于 0', 'diameter')
    }
    torsionConstantM4 = (Math.PI * diameterM ** 4) / 32
    outerRadiusM = diameterM / 2
  } else {
    const outerDiameterM = finite(input.outerDiameterM, '外径')
    const innerDiameterM = finite(input.innerDiameterM, '内径')
    if (outerDiameterM <= 0 || innerDiameterM < 0 || innerDiameterM >= outerDiameterM) {
      throw new TorsionCalculationError(
        'INVALID_TUBE_GEOMETRY',
        '圆管必须满足外径 > 内径 ≥ 0，且外径大于 0',
        'diameters',
      )
    }
    torsionConstantM4 = (Math.PI * (outerDiameterM ** 4 - innerDiameterM ** 4)) / 32
    outerRadiusM = outerDiameterM / 2
  }

  const maximumShearStressPa = (torqueNm * outerRadiusM) / torsionConstantM4
  const twistAngleRad = (torqueNm * lengthM) / (shearModulusPa * torsionConstantM4)

  return {
    kind: input.kind,
    torsionConstantM4,
    outerRadiusM,
    maximumShearStressPa: Object.is(maximumShearStressPa, -0) ? 0 : maximumShearStressPa,
    maximumAbsoluteShearStressPa: Math.abs(maximumShearStressPa),
    twistAngleRad: Object.is(twistAngleRad, -0) ? 0 : twistAngleRad,
  }
}

function required(value: number | undefined, field: string): number {
  if (value === undefined) {
    throw new TorsionCalculationError('MISSING_KNOWN_VALUE', `缺少已知量：${field}`, field)
  }
  return finite(value, field)
}

function validKnownSpeed(value: number): number {
  finite(value, '转速')
  if (value < 0) {
    throw new TorsionCalculationError('NEGATIVE_SPEED', '转速采用非负大小，不能小于 0', 'speed')
  }
  return value
}

export function solvePowerTransmission(
  input: PowerTransmissionInput,
): PowerTransmissionResult {
  let powerW: number
  let torqueNm: number
  let rotationalSpeedRps: number

  switch (input.solveFor) {
    case 'power': {
      torqueNm = required(input.torqueNm, '扭矩')
      rotationalSpeedRps = validKnownSpeed(required(input.rotationalSpeedRps, '转速'))
      powerW = torqueNm * TWO_PI * rotationalSpeedRps
      break
    }
    case 'torque': {
      powerW = required(input.powerW, '功率')
      rotationalSpeedRps = validKnownSpeed(required(input.rotationalSpeedRps, '转速'))
      if (rotationalSpeedRps === 0) {
        throw new TorsionCalculationError(
          'ZERO_SPEED_DIVISOR',
          '转速为 0 时不能由功率反求扭矩',
          'speed',
        )
      }
      torqueNm = powerW / (TWO_PI * rotationalSpeedRps)
      break
    }
    case 'speed': {
      powerW = required(input.powerW, '功率')
      torqueNm = required(input.torqueNm, '扭矩')
      if (torqueNm === 0) {
        throw new TorsionCalculationError(
          'ZERO_TORQUE_DIVISOR',
          '扭矩为 0 时不能由功率反求转速',
          'torque',
        )
      }
      rotationalSpeedRps = powerW / (TWO_PI * torqueNm)
      if (rotationalSpeedRps < 0) {
        throw new TorsionCalculationError(
          'NEGATIVE_SOLVED_SPEED',
          '功率与扭矩符号不一致，反求得到负转速',
          'speed',
        )
      }
      break
    }
  }

  return {
    solvedFor: input.solveFor,
    powerW: Object.is(powerW, -0) ? 0 : powerW,
    torqueNm: Object.is(torqueNm, -0) ? 0 : torqueNm,
    rotationalSpeedRps: Object.is(rotationalSpeedRps, -0) ? 0 : rotationalSpeedRps,
    angularSpeedRadPerS: TWO_PI * rotationalSpeedRps,
  }
}
