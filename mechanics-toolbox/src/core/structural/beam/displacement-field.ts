import type { BeamVector6 } from './element'

export interface BeamDisplacementFieldInput {
  readonly E: number
  readonly I: number
  readonly L: number
  readonly localDisplacements: BeamVector6
  readonly qY?: number
}

export interface BeamDisplacementAtPoint {
  readonly u: number
  readonly v: number
  readonly theta: number
}

export interface BeamDisplacementPolynomials {
  /** Coefficients in ascending powers of local x. */
  readonly u: readonly number[]
  readonly v: readonly number[]
  readonly theta: readonly number[]
}

function requireFinitePositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} 必须为有限正数`)
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

export function beamDisplacementPolynomials({
  E,
  I,
  L,
  localDisplacements,
  qY = 0,
}: BeamDisplacementFieldInput): BeamDisplacementPolynomials {
  requireFinitePositive('E', E)
  requireFinitePositive('I', I)
  requireFinitePositive('L', L)
  if (!Number.isFinite(qY)) throw new RangeError('qY 必须为有限数')
  if (localDisplacements.some((value) => !Number.isFinite(value))) {
    throw new RangeError('局部位移必须全为有限数')
  }
  const [uI, vI, thetaI, uJ, vJ, thetaJ] = localDisplacements
  const loadBubble = qY / (24 * E * I)
  const v2 = (3 * (vJ - vI)) / L ** 2 - (2 * thetaI + thetaJ) / L + loadBubble * L ** 2
  const v3 = (2 * (vI - vJ)) / L ** 3 + (thetaI + thetaJ) / L ** 2 - 2 * loadBubble * L
  const v4 = loadBubble
  const v = [vI, thetaI, v2, v3, v4]
  return {
    u: [uI, (uJ - uI) / L],
    v,
    theta: [thetaI, 2 * v2, 3 * v3, 4 * v4],
  }
}

/** Recover [u,v,theta] from linear/Hermite interpolation plus UDL bubble. */
export function recoverBeamDisplacementAt(
  input: BeamDisplacementFieldInput,
  localX: number,
): BeamDisplacementAtPoint {
  if (!Number.isFinite(localX) || localX < 0 || localX > input.L) {
    throw new RangeError(`localX 非法值 ${String(localX)}：必须位于 [0,L]`)
  }
  const polynomials = beamDisplacementPolynomials(input)
  if (localX === 0) {
    return {
      u: cleanZero(input.localDisplacements[0]),
      v: cleanZero(input.localDisplacements[1]),
      theta: cleanZero(input.localDisplacements[2]),
    }
  }
  if (localX === input.L) {
    return {
      u: cleanZero(input.localDisplacements[3]),
      v: cleanZero(input.localDisplacements[4]),
      theta: cleanZero(input.localDisplacements[5]),
    }
  }
  return {
    u: evaluate(polynomials.u, localX),
    v: evaluate(polynomials.v, localX),
    theta: evaluate(polynomials.theta, localX),
  }
}
