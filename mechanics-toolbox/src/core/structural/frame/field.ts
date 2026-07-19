import type { ElementStationResult } from '../contracts'
import { createStructuralQuantity } from '../contracts'
import type { FrameVector6 } from './element'

interface FrameDistributedLoadSegmentBase {
  readonly a: number
  readonly b: number
}

/** Solver output populates both numbers; qY-only callers remain backward compatible. */
export type FrameDistributedLoadSegment = FrameDistributedLoadSegmentBase & (
  | Readonly<{ qX: number; qY?: number }>
  | Readonly<{ qX?: number; qY: number }>
)

export interface FrameInternalForceFieldInput {
  readonly elementId: string
  readonly L: number
  readonly elementOnNodeEndForces: FrameVector6
  readonly distributedLoads?: readonly FrameDistributedLoadSegment[]
}

export interface FrameInternalForceAtPoint {
  readonly elementId: string
  readonly localX: number
  readonly N: number
  readonly V: number
  readonly M: number
  readonly units: Readonly<{ N: 'N'; V: 'N'; M: 'N*m'; localX: 'm' }>
  readonly positive: Readonly<{
    N: 'tension'
    V: 'dM/dx'
    M: 'sagging'
  }>
}

export interface FrameFiberStressAtPoint extends FrameInternalForceAtPoint {
  readonly y: number
  readonly stress: number
  readonly stressUnit: 'Pa'
  readonly stressPositive: 'tension'
}

function cleanZero(value: number): number {
  return Object.is(value, -0) || value === 0 ? 0 : value
}

function validateInput(input: FrameInternalForceFieldInput): void {
  if (!Number.isFinite(input.L) || input.L <= 0) throw new RangeError('L 必须为有限正数')
  if (input.elementId.trim() === '') throw new RangeError('elementId 不能为空')
  if (input.elementOnNodeEndForces.some((value) => !Number.isFinite(value))) {
    throw new RangeError('刚架端力必须全为有限数')
  }
  for (const [index, load] of (input.distributedLoads ?? []).entries()) {
    if (![load.qX ?? 0, load.qY ?? 0, load.a, load.b].every(Number.isFinite)) {
      throw new RangeError(`distributedLoads[${index}] 必须全为有限数`)
    }
    if (!(load.a >= 0 && load.a < load.b && load.b <= input.L)) {
      throw new RangeError(`distributedLoads[${index}] 必须满足 0≤a<b≤L`)
    }
  }
}

function fieldWithoutEndCheck(input: FrameInternalForceFieldInput, localX: number): readonly [number, number, number] {
  const endForces = input.elementOnNodeEndForces
  let N = endForces[0]
  let V = -endForces[1]
  let M = endForces[2] + V * localX
  for (const load of input.distributedLoads ?? []) {
    const z = Math.max(0, Math.min(localX, load.b) - load.a)
    if (z <= 0) continue
    N -= (load.qX ?? 0) * z
    V += (load.qY ?? 0) * z
    M += (load.qY ?? 0) * ((localX - load.a) * z - z * z / 2)
  }
  return [cleanZero(N), cleanZero(V), cleanZero(M)]
}

function assertEndEquilibrium(input: FrameInternalForceFieldInput): void {
  const [N, V, M] = fieldWithoutEndCheck(input, input.L)
  const expected = [-input.elementOnNodeEndForces[3], input.elementOnNodeEndForces[4], -input.elementOnNodeEndForces[5]]
  const actual = [N, V, M]
  const labels = ['N', 'V', 'M']
  actual.forEach((value, index) => {
    const scale = Math.max(1, Math.abs(value), Math.abs(expected[index]!))
    if (Math.abs(value - expected[index]!) > scale * 1e-9) {
      throw new RangeError(`刚架端力与单元荷载不平衡：${labels[index]}_j`)
    }
  })
}

/** N tension positive; M sagging positive; V=dM/dx. */
export function recoverFrameInternalForcesAt(
  input: FrameInternalForceFieldInput,
  localX: number,
): FrameInternalForceAtPoint {
  validateInput(input)
  if (!Number.isFinite(localX) || localX < 0 || localX > input.L) {
    throw new RangeError(`localX 非法值 ${String(localX)}：必须位于 [0,L]`)
  }
  assertEndEquilibrium(input)
  const [N, V, M] = fieldWithoutEndCheck(input, localX)
  return {
    elementId: input.elementId,
    localX,
    N,
    V,
    M,
    units: { N: 'N', V: 'N', M: 'N*m', localX: 'm' },
    positive: { N: 'tension', V: 'dM/dx', M: 'sagging' },
  }
}

/** sigma_x=N/A-M*y/I; y positive along local +y, stress tension positive. */
export function recoverFrameFiberStressAt(
  input: FrameInternalForceFieldInput,
  localX: number,
  y: number,
  A: number,
  I: number,
): FrameFiberStressAtPoint {
  if (![y, A, I].every(Number.isFinite) || A <= 0 || I <= 0) {
    throw new RangeError('y 必须有限，A/I 必须为有限正数')
  }
  const force = recoverFrameInternalForcesAt(input, localX)
  return {
    ...force,
    y,
    stress: cleanZero(force.N / A - force.M * y / I),
    stressUnit: 'Pa',
    stressPositive: 'tension',
  }
}

export function createFrameStationResult(
  input: FrameInternalForceFieldInput,
  localX: number,
  fiberY: readonly number[] = [],
  A?: number,
  I?: number,
): ElementStationResult {
  const force = recoverFrameInternalForcesAt(input, localX)
  if (fiberY.length > 0 && (A === undefined || I === undefined)) {
    throw new RangeError('输出纤维应力时必须提供 A/I')
  }
  return {
    elementId: input.elementId,
    x: createStructuralQuantity(localX, 'm', '从单元 i 端沿局部 +x', `elements.${input.elementId}.x`),
    side: 'continuous',
    axialForce: createStructuralQuantity(force.N, 'N', '正值表示拉力', `elements.${input.elementId}.N`),
    shearForce: createStructuralQuantity(force.V, 'N', '正值满足 V=dM/dx', `elements.${input.elementId}.V`),
    bendingMoment: createStructuralQuantity(force.M, 'N*m', '正值表示下缘受拉的正弯矩', `elements.${input.elementId}.M`),
    ...(fiberY.length === 0 ? {} : {
      fiberStresses: fiberY.map((y) => {
        const result = recoverFrameFiberStressAt(input, localX, y, A!, I!)
        return {
          y: createStructuralQuantity(y, 'm', '局部 +y', `elements.${input.elementId}.fiber.y`),
          stress: createStructuralQuantity(
            result.stress,
            'Pa',
            '正值表示拉应力；sigma=N/A-M*y/I',
            `elements.${input.elementId}.fiber.stress`,
          ),
        }
      }),
    }),
  }
}
