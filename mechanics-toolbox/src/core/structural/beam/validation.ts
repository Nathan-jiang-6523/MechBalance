import {
  createStructuralIssue,
  type BeamElement2D,
  type BeamModel2D,
  type StructuralIssue,
} from '../contracts'

type RuntimeBeamElement = BeamElement2D & Readonly<Record<string, unknown>>

function excludedElementProperty(
  element: RuntimeBeamElement,
  index: number,
): StructuralIssue | undefined {
  for (const release of ['releaseIMz', 'releaseJMz'] as const) {
    if (element[release] === true) {
      return createStructuralIssue(
        'P2_FEATURE_NOT_INCLUDED',
        'P2 未纳入梁端弯矩释放/内部铰',
        { field: `elements[${index}].${release}`, elementId: element.id },
      )
    }
  }
  if (
    Object.hasOwn(element, 'properties')
    || Object.hasOwn(element, 'E')
    || Object.hasOwn(element, 'A')
    || Object.hasOwn(element, 'I')
  ) {
    return createStructuralIssue(
      'P2_FEATURE_NOT_INCLUDED',
      'P2 未纳入分段变 E/A/I 梁',
      { field: `elements[${index}]`, elementId: element.id },
    )
  }
  return undefined
}

/** Gate P2-2 scope checks beyond shared ID/reference validation. */
export function validateBeamScope(model: BeamModel2D): readonly StructuralIssue[] {
  const issues: StructuralIssue[] = []
  if (model.topology !== 'single-span') {
    issues.push(createStructuralIssue(
      'P2_FEATURE_NOT_INCLUDED',
      'P2 未纳入连续多跨梁',
      { field: 'topology' },
    ))
  }
  if (model.propertyPolicy !== 'uniform') {
    issues.push(createStructuralIssue(
      'P2_FEATURE_NOT_INCLUDED',
      'P2 未纳入分段变 E/A/I 梁',
      { field: 'propertyPolicy' },
    ))
  }

  const connectedNodeIds = new Set<string>()
  for (const [index, rawElement] of model.elements.entries()) {
    const element = rawElement as RuntimeBeamElement
    connectedNodeIds.add(element.nodeI)
    connectedNodeIds.add(element.nodeJ)
    const excluded = excludedElementProperty(element, index)
    if (excluded) issues.push(excluded)
  }
  for (const [index, node] of model.nodes.entries()) {
    if (!connectedNodeIds.has(node.id)) {
      issues.push(createStructuralIssue(
        'P2_ISOLATED_NODE',
        `节点 ${node.id} 未连接梁单元`,
        { field: `nodes[${index}]`, nodeId: node.id },
      ))
    }
  }
  return issues
}
