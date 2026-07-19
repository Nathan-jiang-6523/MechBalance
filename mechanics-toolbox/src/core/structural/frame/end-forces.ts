import type { ElementEndForceResult } from '../contracts'
import { createStructuralQuantity } from '../contracts'
import { FRAME_LOCAL_DOF_COUNT, type FrameMatrix6, type FrameVector6 } from './element'

const ZERO_LOAD: FrameVector6 = [0, 0, 0, 0, 0, 0]

function requireFiniteVector(name: string, vector: FrameVector6): void {
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`${name} must contain only finite values`)
  }
}

/** Local resisting actions k*d-f in [N_i,V_i,M_i,N_j,V_j,M_j] DOF order. */
export function recoverFrameResistingVector(
  stiffness: FrameMatrix6,
  localDisplacements: FrameVector6,
  consistentLoad: FrameVector6 = ZERO_LOAD,
): FrameVector6 {
  requireFiniteVector('localDisplacements', localDisplacements)
  requireFiniteVector('consistentLoad', consistentLoad)
  if (stiffness.some((row) => row.length !== FRAME_LOCAL_DOF_COUNT
    || row.some((value) => !Number.isFinite(value)))) {
    throw new RangeError('stiffness must be a finite 6x6 matrix')
  }
  return stiffness.map((row, rowIndex) => row.reduce(
    (sum, coefficient, columnIndex) => sum + coefficient * localDisplacements[columnIndex]!,
    0,
  ) - consistentLoad[rowIndex]!) as unknown as FrameVector6
}

/** Actions exerted by element on end nodes: f-k*d, local axes i -> j. */
export function recoverFrameElementOnNodeEndForces(
  stiffness: FrameMatrix6,
  localDisplacements: FrameVector6,
  consistentLoad: FrameVector6 = ZERO_LOAD,
): FrameVector6 {
  return recoverFrameResistingVector(stiffness, localDisplacements, consistentLoad).map(
    (value) => value === 0 ? 0 : -value,
  ) as unknown as FrameVector6
}

export function createFrameEndForceResult(
  elementId: string,
  elementOnNodeEndForces: FrameVector6,
  coordinateSystem: 'local' | 'global' = 'local',
): ElementEndForceResult {
  requireFiniteVector('elementOnNodeEndForces', elementOnNodeEndForces)
  const axis = coordinateSystem === 'local' ? '局部' : '全局'
  const component = <Unit extends 'N' | 'N*m'>(value: number, unit: Unit, positive: string, field: string) =>
    createStructuralQuantity(value, unit, positive, `elements.${elementId}.${field}`)
  return {
    elementId,
    coordinateSystem,
    nodeI: {
      fx: component(elementOnNodeEndForces[0], 'N', `${axis} +x；正值表示单元对 i 节点沿 +x 作用`, 'nodeI.fx'),
      fy: component(elementOnNodeEndForces[1], 'N', `${axis} +y；正值表示单元对 i 节点沿 +y 作用`, 'nodeI.fy'),
      mz: component(elementOnNodeEndForces[2], 'N*m', `${axis} +z 逆时针`, 'nodeI.mz'),
    },
    nodeJ: {
      fx: component(elementOnNodeEndForces[3], 'N', `${axis} +x；正值表示单元对 j 节点沿 +x 作用`, 'nodeJ.fx'),
      fy: component(elementOnNodeEndForces[4], 'N', `${axis} +y；正值表示单元对 j 节点沿 +y 作用`, 'nodeJ.fy'),
      mz: component(elementOnNodeEndForces[5], 'N*m', `${axis} +z 逆时针`, 'nodeJ.mz'),
    },
  }
}
