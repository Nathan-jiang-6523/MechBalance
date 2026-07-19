import { createStructuralIssue, type StructuralIssue } from './issues'
import {
  STRUCTURAL_MODEL_LIMITS,
  type BeamModel2D,
  type LibraryPropertySource,
  type StructuralModel2D,
} from './model'

function duplicateIds(items: readonly Readonly<{ id: string }>[], field: string): StructuralIssue[] {
  const seen = new Set<string>()
  const issues: StructuralIssue[] = []
  for (const item of items) {
    if (seen.has(item.id)) {
      issues.push(createStructuralIssue('P2_DUPLICATE_ID', `${field} 存在重复 ID：${item.id}`, {
        field,
        objectId: item.id,
      }))
    }
    seen.add(item.id)
  }
  return issues
}

function validateLibraryReference(
  properties: LibraryPropertySource,
  materialIds: ReadonlySet<string>,
  sectionIds: ReadonlySet<string>,
  field: string,
): StructuralIssue[] {
  const issues: StructuralIssue[] = []
  if (!materialIds.has(properties.materialId)) {
    issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `材料不存在：${properties.materialId}`, {
      field: `${field}.materialId`,
      objectId: properties.materialId,
    }))
  }
  if (!sectionIds.has(properties.sectionId)) {
    issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `截面不存在：${properties.sectionId}`, {
      field: `${field}.sectionId`,
      objectId: properties.sectionId,
    }))
  }
  return issues
}

function validateSingleSpan(model: BeamModel2D): StructuralIssue[] {
  if (model.elements.length === 0) return []
  const degree = new Map<string, number>()
  for (const element of model.elements) {
    degree.set(element.nodeI, (degree.get(element.nodeI) ?? 0) + 1)
    degree.set(element.nodeJ, (degree.get(element.nodeJ) ?? 0) + 1)
  }
  const endpoints = new Set([...degree].filter(([, value]) => value === 1).map(([id]) => id))
  const isChain = endpoints.size === 2
    && [...degree.values()].every((value) => value === 1 || value === 2)
    && model.elements.length === degree.size - 1
  const hasInternalSupport = model.constraints.some(({ nodeId }) => degree.has(nodeId) && !endpoints.has(nodeId))

  if (isChain && !hasInternalSupport) return []
  return [createStructuralIssue(
    'P2_FEATURE_NOT_INCLUDED',
    'P2 梁首版仅支持无内部支点的等属性单跨链式网格',
    { field: hasInternalSupport ? 'constraints' : 'elements' },
  )]
}

/**
 * Gate P2-0 boundary validation only: IDs/references, zero length, hard limits,
 * and the frozen single-span beam scope. Numeric property validation belongs to
 * the later solver gate.
 */
export function validateStructuralModelBoundary(model: StructuralModel2D): readonly StructuralIssue[] {
  const issues: StructuralIssue[] = []
  const dofsPerNode = model.analysis === 'truss' ? 2 : 3
  const constrainedDofs = new Set(model.constraints.map(({ nodeId, dof }) => `${nodeId}:${dof}`)).size
  const freeDofs = model.nodes.length * dofsPerNode - constrainedDofs

  if (
    model.nodes.length > STRUCTURAL_MODEL_LIMITS.nodes
    || model.elements.length > STRUCTURAL_MODEL_LIMITS.elements
    || freeDofs > STRUCTURAL_MODEL_LIMITS.freeDofs
  ) {
    issues.push(createStructuralIssue('P2_MODEL_LIMIT_EXCEEDED', '模型超过 P2 首版规模上限', { field: 'model' }))
  }

  issues.push(...duplicateIds(model.nodes, 'nodes'))
  issues.push(...duplicateIds(model.elements, 'elements'))
  issues.push(...duplicateIds(model.materials, 'materials'))
  issues.push(...duplicateIds(model.sections, 'sections'))
  issues.push(...duplicateIds(model.loads, 'loads'))

  const nodeById = new Map(model.nodes.map((node) => [node.id, node] as const))
  const elementIds = new Set(model.elements.map(({ id }) => id))
  const materialIds = new Set(model.materials.map(({ id }) => id))
  const sectionIds = new Set(model.sections.map(({ id }) => id))

  for (const [index, element] of model.elements.entries()) {
    const nodeI = nodeById.get(element.nodeI)
    const nodeJ = nodeById.get(element.nodeJ)
    if (!nodeI || !nodeJ) {
      issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `单元 ${element.id} 引用不存在的节点`, {
        field: `elements[${index}]`,
        elementId: element.id,
      }))
    } else if (nodeI.x === nodeJ.x && nodeI.y === nodeJ.y) {
      issues.push(createStructuralIssue('P2_ZERO_LENGTH_ELEMENT', `单元 ${element.id} 长度为零`, {
        field: `elements[${index}].nodeJ`,
        elementId: element.id,
      }))
    }
    if ('properties' in element && element.properties.source === 'library') {
      issues.push(...validateLibraryReference(element.properties, materialIds, sectionIds, `elements[${index}].properties`))
    }
  }

  if (model.analysis === 'beam') {
    if (model.uniformProperties.source === 'library') {
      issues.push(...validateLibraryReference(model.uniformProperties, materialIds, sectionIds, 'uniformProperties'))
    }
    issues.push(...validateSingleSpan(model))
  }

  for (const [index, constraint] of model.constraints.entries()) {
    if (!nodeById.has(constraint.nodeId)) {
      issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `约束引用不存在的节点：${constraint.nodeId}`, {
        field: `constraints[${index}].nodeId`,
        nodeId: constraint.nodeId,
      }))
    }
  }
  for (const [index, load] of model.loads.entries()) {
    const referenceExists = 'nodeId' in load
      ? nodeById.has(load.nodeId)
      : elementIds.has(load.elementId)
    if (!referenceExists) {
      issues.push(createStructuralIssue('P2_REFERENCE_NOT_FOUND', `荷载 ${load.id} 的对象引用不存在`, {
        field: `loads[${index}]`,
        objectId: load.id,
      }))
    }
  }
  return issues
}
