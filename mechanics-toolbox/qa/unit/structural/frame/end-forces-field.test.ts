import { describe, expect, it } from 'vitest'

import { frameLocalStiffness } from '../../../../src/core/structural/frame/element'
import {
  createFrameEndForceResult,
  recoverFrameElementOnNodeEndForces,
  recoverFrameResistingVector,
} from '../../../../src/core/structural/frame/end-forces'
import {
  createFrameStationResult,
  recoverFrameFiberStressAt,
  recoverFrameInternalForcesAt,
} from '../../../../src/core/structural/frame/field'
import { frameTransformationMatrix, localToGlobalVector } from '../../../../src/core/structural/frame/transform'

describe('P2 frame end-force and field recovery', () => {
  const L = 4
  const fixedEquivalentLoad = [0, -20_000, -40_000 / 3, 0, -20_000, 40_000 / 3] as const
  const fixedElementOnNode = fixedEquivalentLoad

  it('distinguishes resisting k*d-f from element-on-node f-k*d', () => {
    const stiffness = frameLocalStiffness({ E: 200e9, A: 0.01, I: 8e-5, L })
    const elementOnNode = recoverFrameElementOnNodeEndForces(
      stiffness, [0, 0, 0, 0, 0, 0], fixedEquivalentLoad,
    )
    const resisting = recoverFrameResistingVector(stiffness, [0, 0, 0, 0, 0, 0], fixedEquivalentLoad)
    expect(elementOnNode).toEqual(fixedElementOnNode)
    elementOnNode.forEach((value, index) => expect(value + resisting[index]!).toBe(0))
    expect(createFrameEndForceResult('e', elementOnNode).coordinateSystem).toBe('local')
  })

  it('labels local and global element-on-node results without changing force semantics', () => {
    const local = [100, 200, 300, -100, -200, -300] as const
    const global = localToGlobalVector(local, frameTransformationMatrix(0, 1))
    expect(global).toEqual([-200, 100, 300, 200, -100, -300])
    const localResult = createFrameEndForceResult('e', local, 'local')
    const globalResult = createFrameEndForceResult('e', global, 'global')
    expect(localResult.coordinateSystem).toBe('local')
    expect(globalResult.coordinateSystem).toBe('global')
    expect(globalResult.nodeI.fx).toMatchObject({ value: -200, unit: 'N' })
    expect(globalResult.nodeI.fx.positive).toContain('全局 +x')
    expect(JSON.parse(JSON.stringify([localResult, globalResult]))).toEqual([localResult, globalResult])
  })

  it('recovers FRAME-A02 full-span N/V/M and fiber stress', () => {
    const input = {
      elementId: 'e', L, elementOnNodeEndForces: fixedElementOnNode,
      distributedLoads: [{ qX: 0, qY: -10_000, a: 0, b: L }],
    }
    expect(recoverFrameInternalForcesAt(input, 0)).toMatchObject({ N: 0, V: 20_000, M: -40_000 / 3 })
    const middle = recoverFrameInternalForcesAt(input, 2)
    expect(middle).toMatchObject({ N: 0, V: 0 })
    expect(middle.M).toBeCloseTo(20_000 / 3, 10)
    const right = recoverFrameInternalForcesAt(input, 4)
    expect(right).toMatchObject({ N: 0, V: -20_000 })
    expect(right.M).toBeCloseTo(-40_000 / 3, 10)
    expect(recoverFrameFiberStressAt(input, 0, 0.12, 0.01, 8e-5).stress).toBeCloseTo(20e6, 6)
    expect(recoverFrameFiberStressAt(input, 2, 0.12, 0.01, 8e-5).stress).toBeCloseTo(-10e6, 6)
    const station = createFrameStationResult(input, 2, [-0.12, 0.12], 0.01, 8e-5)
    expect(station.elementId).toBe('e')
    expect(station.fiberStresses).toHaveLength(2)
  })

  it('recovers FRAME-A03 partial-span field', () => {
    const input = {
      elementId: 'e', L,
      elementOnNodeEndForces: [0, -15_000, 0, 0, -5_000, 0] as const,
      distributedLoads: [{ qX: 0, qY: -10_000, a: 0, b: 2 }],
    }
    expect(recoverFrameInternalForcesAt(input, 1.5)).toMatchObject({ V: 0, M: 11_250 })
    expect(recoverFrameInternalForcesAt(input, 2)).toMatchObject({ V: -5_000, M: 10_000 })
    expect(recoverFrameInternalForcesAt(input, 3)).toMatchObject({ V: -5_000, M: 5_000 })
    expect(recoverFrameInternalForcesAt(input, 4)).toMatchObject({ V: -5_000, M: 0 })
  })

  it('includes axial stress and rejects unbalanced end forces', () => {
    const input = {
      elementId: 'bar', L: 2,
      elementOnNodeEndForces: [1000, 0, 0, -1000, 0, 0] as const,
    }
    expect(recoverFrameFiberStressAt(input, 1, 0, 0.001, 8e-6).stress).toBe(1e6)
    expect(() => recoverFrameInternalForcesAt({
      ...input, elementOnNodeEndForces: [1000, 0, 0, -900, 0, 0],
    }, 1)).toThrow('N_j')
  })

  it('recovers full-span and partial-span axial distributed load with dN/dx=-qX', () => {
    const full = {
      elementId: 'bar-full', L: 4,
      elementOnNodeEndForces: [20_000, 0, 0, 20_000, 0, 0] as const,
      distributedLoads: [{ qX: 10_000, qY: 0, a: 0, b: 4 }],
    }
    expect(recoverFrameInternalForcesAt(full, 0).N).toBe(20_000)
    expect(recoverFrameInternalForcesAt(full, 2).N).toBe(0)
    expect(recoverFrameInternalForcesAt(full, 4).N).toBe(-20_000)

    const partial = {
      elementId: 'bar-partial', L: 4,
      elementOnNodeEndForces: [15_000, 0, 0, 5_000, 0, 0] as const,
      distributedLoads: [{ qX: 10_000, qY: 0, a: 0, b: 2 }],
    }
    expect(recoverFrameInternalForcesAt(partial, 1).N).toBe(5_000)
    expect(recoverFrameInternalForcesAt(partial, 2).N).toBe(-5_000)
    expect(recoverFrameInternalForcesAt(partial, 4).N).toBe(-5_000)
  })
})
