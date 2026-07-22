import {
  createStructuralIssue,
  validateStructuralModelBoundary,
  type FrameElement2D,
  type FrameModel2D,
  type StructuralIssue,
} from '../contracts'

export interface FrameResolvedProperties {
  readonly E: number
  readonly A: number
  readonly I: number
  readonly alpha?: number
  readonly density?: number
  readonly extremeFiberY?: number
}

export function resolveFrameProperties(
  model: FrameModel2D,
  element: FrameElement2D,
): FrameResolvedProperties | undefined {
  const source = element.properties
  if (source.source === 'inline') return source
  const material = model.materials.find(({ id }) => id === source.materialId)
  const section = model.sections.find(({ id }) => id === source.sectionId)
  if (!material || !section || section.I === undefined) return undefined
  return {
    E: material.E,
    A: section.A,
    I: section.I,
    ...(material.alpha === undefined ? {} : { alpha: material.alpha }),
    ...(material.density === undefined ? {} : { density: material.density }),
    ...(section.extremeFiberY === undefined ? {} : { extremeFiberY: section.extremeFiberY }),
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

function hasEndRelease(element: FrameElement2D): readonly string[] {
  const candidate = element as unknown as Record<string, unknown>
  return [
    'releaseIMz',
    'releaseJMz',
    'internalHinge',
    'nodeIRotationReleased',
    'nodeJRotationReleased',
    'releases',
  ].filter((field) => {
    const value = candidate[field]
    return value !== undefined && value !== false
  })
}

export function validateFrameModel(model: FrameModel2D): readonly StructuralIssue[] {
  const boundaryIssues = validateStructuralModelBoundary(model).map((issue) => {
    if (issue.code !== 'P2_ZERO_LENGTH_ELEMENT' || issue.elementId === undefined) return issue
    return createStructuralIssue(
      'P2_ZERO_LENGTH_ELEMENT',
      `框架单元 ${issue.elementId} 长度为零`,
      { ...(issue.field === undefined ? {} : { field: issue.field }), elementId: issue.elementId },
    )
  })
  const issues = [...boundaryIssues]
  const nodeById = new Map(model.nodes.map((node) => [node.id, node] as const))
  const connected = new Set<string>()
  const propertiesByElement = new Map<string, FrameResolvedProperties>()

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
    for (const release of hasEndRelease(element)) {
      issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', 'P2 刚架不包含端释放或内部铰', {
        field: `elements[${index}].${release}`, elementId: element.id,
      }))
    }
    const properties = resolveFrameProperties(model, element)
    if (!properties) {
      const source = element.properties
      if (source.source === 'library') {
        const section = model.sections.find(({ id }) => id === source.sectionId)
        if (section && section.I === undefined) {
          issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `刚架单元 ${element.id} 的截面缺少 I`, {
            field: `elements[${index}].properties.sectionId`, elementId: element.id,
          }))
        }
      }
      return
    }
    propertiesByElement.set(element.id, properties)
    const values: readonly (readonly [keyof FrameResolvedProperties, number, boolean])[] = [
      ['E', properties.E, true],
      ['A', properties.A, true],
      ['I', properties.I, true],
      ...(properties.alpha === undefined ? [] : [['alpha', properties.alpha, false] as const]),
      ...(properties.density === undefined ? [] : [['density', properties.density, true] as const]),
      ...(properties.extremeFiberY === undefined
        ? [] : [['extremeFiberY', properties.extremeFiberY, true] as const]),
    ]
    values.forEach(([name, value, positive]) => {
      const issue = numericIssue(
        value,
        `elements[${index}].properties.${name}`,
        `${element.id}.${name}`,
        positive,
        element.id,
      )
      if (issue) issues.push(issue)
    })
  })

  model.nodes.forEach((node, index) => {
    if (!connected.has(node.id)) {
      issues.push(createStructuralIssue('P2_ISOLATED_NODE', `节点 ${node.id} 未连接刚架单元`, {
        field: `nodes[${index}]`, nodeId: node.id,
      }))
    }
  })

  const constraintKeys = new Set<string>()
  model.constraints.forEach((constraint, index) => {
    const key = `${constraint.nodeId}:${constraint.dof}`
    if (constraintKeys.has(key)) {
      issues.push(createStructuralIssue('P2_DUPLICATE_ID', `约束重复：${key}`, {
        field: `constraints[${index}]`, nodeId: constraint.nodeId,
      }))
    }
    constraintKeys.add(key)
    if (constraint.value !== 0 || !['u', 'v', 'theta'].includes(constraint.dof)) {
      issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', '刚架仅支持 u/v/theta 零位移约束', {
        field: `constraints[${index}]`, nodeId: constraint.nodeId,
      }))
    }
  })

  model.loads.forEach((load, index) => {
    const field = `loads[${index}]`
    if (load.type === 'frame-uniform') {
      const components = ([['qX', load.qX], ['qY', load.qY]] as const)
        .filter((entry): entry is readonly ['qX' | 'qY', number] => entry[1] !== undefined)
      if (components.length === 0) {
        issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `分布荷载 ${load.id} 必须至少提供 qX 或 qY`, {
          field, objectId: load.id,
        }))
      }
      for (const [component, value] of components) {
        if (!Number.isFinite(value)) {
          issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `分布荷载 ${load.id} 的 ${component} 必须为有限数`, {
            field: `${field}.${component}`, objectId: load.id, elementId: load.elementId,
          }))
        }
      }
    } else {
      const values = load.type === 'nodal'
        ? [load.fx, load.fy, load.mz].filter((value): value is number => value !== undefined)
        : load.type === 'uniform-temperature' ? [load.deltaT] : [load.strain]
      if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
        issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `荷载 ${load.id} 必须含有限数值`, {
          field, objectId: load.id,
        }))
      }
    }
    if (load.type === 'uniform-temperature') {
      const properties = propertiesByElement.get(load.elementId)
      if (properties && properties.alpha === undefined) {
        issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `温度荷载 ${load.id} 缺少材料 alpha`, {
          field, objectId: load.id, elementId: load.elementId,
        }))
      }
    }
    if (load.type === 'frame-uniform' && load.interval !== undefined) {
      const { a, b } = load.interval
      const element = model.elements.find(({ id }) => id === load.elementId)
      const nodeI = element ? nodeById.get(element.nodeI) : undefined
      const nodeJ = element ? nodeById.get(element.nodeJ) : undefined
      const length = nodeI && nodeJ ? Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y) : undefined
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        issues.push(createStructuralIssue('P2_NONFINITE_INPUT', `分布荷载 ${load.id} 区间必须为有限数`, {
          field: `${field}.interval`, objectId: load.id, elementId: load.elementId,
        }))
      } else if (length !== undefined && !(a >= 0 && a < b && b <= length)) {
        issues.push(createStructuralIssue('P2_FEATURE_NOT_INCLUDED', `分布荷载 ${load.id} 区间必须满足 0≤a<b≤L`, {
          field: `${field}.interval`, objectId: load.id, elementId: load.elementId,
        }))
      }
    }
  })
  return issues
}
