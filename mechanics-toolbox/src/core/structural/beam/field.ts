import type { BeamVector6 } from './element'

export interface BeamInternalForceFieldInput {
  readonly L: number
  readonly elementOnNodeEndForces: BeamVector6
  readonly qY?: number
}

export interface BeamInternalForceAtPoint {
  readonly N: number
  readonly V: number
  readonly M: number
}

export interface BeamInternalForcePolynomials {
  /** Coefficients in ascending powers of local x. */
  readonly N: readonly number[]
  readonly V: readonly number[]
  readonly M: readonly number[]
}

function evaluate(coefficients: readonly number[], x: number): number {
  let value = 0
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    value = value * x + coefficients[index]!
  }
  return value === 0 ? 0 : value
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value
}

export function beamInternalForcePolynomials({
  L,
  elementOnNodeEndForces,
  qY = 0,
}: BeamInternalForceFieldInput): BeamInternalForcePolynomials {
  if (!Number.isFinite(L) || L <= 0) throw new RangeError('L 必须为有限正数')
  if (!Number.isFinite(qY)) throw new RangeError('qY 必须为有限数')
  if (elementOnNodeEndForces.some((value) => !Number.isFinite(value))) {
    throw new RangeError('梁端力必须全为有限数')
  }
  const axial = elementOnNodeEndForces[0]
  const shearI = -elementOnNodeEndForces[1]
  const momentI = elementOnNodeEndForces[2]
  const axialJ = -elementOnNodeEndForces[3]
  const shearJ = elementOnNodeEndForces[4]
  const momentJ = -elementOnNodeEndForces[5]
  const expectedAtJ = [axial, shearI + qY * L, momentI + shearI * L + qY * L ** 2 / 2]
  const actualAtJ = [axialJ, shearJ, momentJ]
  const labels = ['N', 'V', 'M']
  for (let index = 0; index < expectedAtJ.length; index += 1) {
    const scale = Math.max(1, Math.abs(expectedAtJ[index]!), Math.abs(actualAtJ[index]!))
    if (Math.abs(expectedAtJ[index]! - actualAtJ[index]!) > scale * 1e-9) {
      throw new RangeError(`梁端力与单元荷载不平衡：${labels[index]}_j`)
    }
  }
  return {
    N: [axial],
    V: [shearI, qY],
    M: [momentI, shearI, qY / 2],
  }
}

/** Recover N/V/M; N tension positive, M sagging positive, V=dM/dx. */
export function recoverBeamInternalForcesAt(
  input: BeamInternalForceFieldInput,
  localX: number,
): BeamInternalForceAtPoint {
  if (!Number.isFinite(localX) || localX < 0 || localX > input.L) {
    throw new RangeError(`localX 非法值 ${String(localX)}：必须位于 [0,L]`)
  }
  const polynomials = beamInternalForcePolynomials(input)
  if (localX === 0) {
    return {
      N: cleanZero(input.elementOnNodeEndForces[0]),
      V: cleanZero(-input.elementOnNodeEndForces[1]),
      M: cleanZero(input.elementOnNodeEndForces[2]),
    }
  }
  if (localX === input.L) {
    return {
      N: cleanZero(-input.elementOnNodeEndForces[3]),
      V: cleanZero(input.elementOnNodeEndForces[4]),
      M: cleanZero(-input.elementOnNodeEndForces[5]),
    }
  }
  return {
    N: evaluate(polynomials.N, localX),
    V: evaluate(polynomials.V, localX),
    M: evaluate(polynomials.M, localX),
  }
}
