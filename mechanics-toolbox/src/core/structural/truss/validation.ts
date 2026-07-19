import {
  createStructuralIssue,
  validateStructuralModelBoundary,
  type StructuralIssue,
  type TrussElement2D,
  type TrussModel2D,
} from '../contracts'

export interface TrussResolvedProperties {
  readonly E: number
  readonly A: number
  readonly alpha?: number
  readonly density?: number
}

export function resolveTrussProperties(
  model: TrussModel2D,
  element: TrussElement2D,
): TrussResolvedProperties | undefined {
  const source = element.properties
  if (source.source === 'inline') return source
  const material = model.materials.find(({ id }) => id === source.materialId)
  const section = model.sections.find(({ id }) => id === source.sectionId)
  if (!material || !section) return undefined
  return {
    E: material.E,
    A: section.A,
    ...(material.alpha === undefined ? {} : { alpha: material.alpha }),
    ...(material.density === undefined ? {} : { density: material.density }),
  }
}

function numericIssue(
  value: number,
  field: string,
  label: string,
  positive: boolean,
  elementId?: string,
): StructuralIssue | undefined {
  const location = elementId === undefined ? { field } : { field, elementId }
  if (!Number.isFinite(value)) {
    return createStructuralIssue('P2_NONFINITE_INPUT', `${label} 必须为有限数`, location)
  }
  if (positive && value <= 0) {
    return createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `${label} 必须大于零`, location)
  }
  return undefined
}

export function validateTrussModel(model: TrussModel2D): readonly StructuralIssue[] {
  const issues = [...validateStructuralModelBoundary(model)]
  const connected = new Set<string>()
  const propertiesByElement = new Map<string, TrussResolvedProperties>()

  model.nodes.forEach((node, index) => {
    if (![node.x, node.y].every(Number.isFinite)) {
      issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `节点 ${node.id} 坐标必须为有限数`, {
        field: `nodes[${index}]`, nodeId: node.id,
      }))
    }
  })

  model.elements.forEach((element, index) => {
    connected.add(element.nodeI)
    connected.add(element.nodeJ)
    const properties = resolveTrussProperties(model, element)
    if (!properties) return
    propertiesByElement.set(element.id, properties)
    const values: readonly (readonly [keyof TrussResolvedProperties, number, boolean])[] = [
      ['E', properties.E, true],
      ['A', properties.A, true],
      ...(properties.alpha === undefined ? [] : [['alpha', properties.alpha, false] as const]),
      ...(properties.density === undefined ? [] : [['density', properties.density, true] as const]),
    ]
    values.forEach(([name, value, positive]) => {
      const issue = numericIssue(value, `elements[${index}].properties.${name}`, `${element.id}.${name}`, positive, element.id)
      if (issue) issues.push(issue)
    })
  })

  model.nodes.forEach((node, index) => {
    if (!connected.has(node.id)) {
      issues.push(createStructuralIssue('P2_ISOLATED_NODE', `节点 ${node.id} 未连接桁架单元`, {
        field: `nodes[${index}]`, nodeId: node.id,
      }))
    }
  })

  model.constraints.forEach((constraint, index) => {
    if (constraint.value !== 0 || (constraint.dof !== 'u' && constraint.dof !== 'v')) {
      issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '桁架首版只支持 u/v 零位移约束', {
        field: `constraints[${index}]`, nodeId: constraint.nodeId,
      }))
    }
  })

  model.loads.forEach((load, index) => {
    let values: readonly number[]
    if (load.type === 'nodal') values = [load.fx, load.fy].filter((value): value is number => value !== undefined)
    else if (load.type === 'uniform-temperature') values = [load.deltaT]
    else if (load.type === 'initial-strain') values = [load.strain]
    else values = [load.gravity]
    if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
      issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `荷载 ${load.id} 必须含有限数值`, {
        field: `loads[${index}]`, objectId: load.id,
      }))
    }
    if (load.type === 'truss-self-weight' && Number.isFinite(load.gravity) && load.gravity <= 0) {
      issues.push(createStructuralIssue('P2_NONPOSITIVE_PROPERTY', `荷载 ${load.id} 的 g 必须大于零`, {
        field: `loads[${index}].gravity`, objectId: load.id,
      }))
    }
    if (load.type === 'uniform-temperature') {
      const properties = propertiesByElement.get(load.elementId)
      if (properties && properties.alpha === undefined) {
        issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `温度荷载 ${load.id} 缺少材料 alpha`, {
          field: `loads[${index}]`, objectId: load.id, elementId: load.elementId,
        }))
      }
    }
    if (load.type === 'truss-self-weight') {
      const properties = propertiesByElement.get(load.elementId)
      if (properties && properties.density === undefined) {
        issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `自重荷载 ${load.id} 缺少材料 density`, {
          field: `loads[${index}]`, objectId: load.id, elementId: load.elementId,
        }))
      }
    }
  })
  return issues
}
