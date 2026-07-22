import {
  createStructuralIssue,
  type MovingLoadRequest,
  type StructuralIssue,
} from '../contracts'
import { validateInfluenceDefinition } from '../influence'

export const MOVING_LOAD_LIMITS = { axles: 100 } as const

export function validateMovingLoadRequest(request: MovingLoadRequest): readonly StructuralIssue[] {
  const issues: StructuralIssue[] = []
  if (request.beam.topology !== 'simply-supported') {
    issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '移动载荷首版仅支持简支梁', {
      field: 'beam.topology',
    }))
  }
  issues.push(...validateInfluenceDefinition(request.beam.span, request.response))

  const { axles, adjacentSpacings, direction, dynamicFactor } = request.movingLoad
  if (axles.length === 0) {
    issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', 'movingLoad.axles 不能为空', {
      field: 'movingLoad.axles',
    }))
  } else if (axles.length > MOVING_LOAD_LIMITS.axles) {
    issues.push(createStructuralIssue('P2_MODEL_LIMIT_EXCEEDED', `车轴数超过 ${MOVING_LOAD_LIMITS.axles}`, {
      field: 'movingLoad.axles',
    }))
  }
  const seen = new Set<string>()
  for (const [index, axle] of axles.entries()) {
    if (axle.id.length === 0 || seen.has(axle.id)) {
      issues.push(createStructuralIssue('P2_DUPLICATE_ID', `车轴 ID 为空或重复：${axle.id}`, {
        field: `movingLoad.axles[${index}].id`, objectId: axle.id,
      }))
    }
    seen.add(axle.id)
    if (!Number.isFinite(axle.load)) {
      issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `轴载 ${axle.id} 非法值 ${String(axle.load)}`, {
        field: `movingLoad.axles[${index}].load`, objectId: axle.id,
      }))
    } else if (axle.load <= 0) {
      issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `轴载 ${axle.id} 非法值 ${String(axle.load)}`, {
        field: `movingLoad.axles[${index}].load`, objectId: axle.id,
      }))
    }
  }
  if (adjacentSpacings.length !== Math.max(0, axles.length - 1)) {
    issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '相邻轴距数量必须等于车轴数减一', {
      field: 'movingLoad.adjacentSpacings',
    }))
  }
  for (const [index, spacing] of adjacentSpacings.entries()) {
    if (!Number.isFinite(spacing)) {
      issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `轴距非法值 ${String(spacing)}`, {
        field: `movingLoad.adjacentSpacings[${index}]`,
      }))
    } else if (spacing < 0) {
      issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `轴距非法值 ${String(spacing)}：不得为负`, {
        field: `movingLoad.adjacentSpacings[${index}]`,
      }))
    }
  }
  if (direction !== 'left-to-right' && direction !== 'right-to-left') {
    issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', `不支持的行进方向：${String(direction)}`, {
      field: 'movingLoad.direction',
    }))
  }
  if (!Number.isFinite(dynamicFactor)) {
    issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `movingLoad.dynamicFactor 非法值 ${String(dynamicFactor)}`, {
      field: 'movingLoad.dynamicFactor',
    }))
  } else if (dynamicFactor <= 0) {
    issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `movingLoad.dynamicFactor 非法值 ${String(dynamicFactor)}`, {
      field: 'movingLoad.dynamicFactor',
    }))
  }
  if (request.search.strategy !== 'event-points-and-stationary-points') {
    issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '不得用固定步长冒充移动载荷极值', {
      field: 'search.strategy',
    }))
  }
  const tolerance = request.search.adaptivePositionTolerance
  if (!Number.isFinite(tolerance)) {
    issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `search.adaptivePositionTolerance 非法值 ${String(tolerance)}`, {
      field: 'search.adaptivePositionTolerance',
    }))
  } else if (tolerance <= 0) {
    issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `search.adaptivePositionTolerance 非法值 ${String(tolerance)}`, {
      field: 'search.adaptivePositionTolerance',
    }))
  } else if (tolerance > 1e-6) {
    issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '极值位置容差不得大于 0.001 mm', {
      field: 'search.adaptivePositionTolerance',
    }))
  }
  return issues
}
