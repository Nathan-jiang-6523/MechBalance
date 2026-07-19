import type { TrussElementResult } from '../contracts'
import { createStructuralQuantity } from '../contracts'

export function createTrussElementResult(
  elementId: string,
  axialForce: number,
  area: number,
  zeroTolerance = 1e-6,
): TrussElementResult {
  if (!Number.isFinite(area) || area <= 0) throw new RangeError('桁架截面积必须大于零')
  if (!Number.isFinite(zeroTolerance) || zeroTolerance < 0) throw new RangeError('零力容差无效')
  const state = Math.abs(axialForce) <= zeroTolerance
    ? 'zero'
    : axialForce > 0 ? 'tension' : 'compression'
  return {
    elementId,
    axialForce: createStructuralQuantity(axialForce, 'N', '正值表示拉力', `elements.${elementId}.axialForce`),
    stress: createStructuralQuantity(axialForce / area, 'Pa', '正值表示拉应力', `elements.${elementId}.stress`),
    state,
  }
}
