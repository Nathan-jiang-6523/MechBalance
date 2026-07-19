export type GlobalDofMap<NodeId extends string = string> = ReadonlyMap<NodeId, readonly number[]>

function requireNodeId(nodeId: string): void {
  if (nodeId.length === 0) throw new RangeError('node ID must not be empty')
}

/** Assign contiguous global DOFs in caller-supplied node order. */
export function createGlobalDofMap<NodeId extends string>(
  nodeIds: readonly NodeId[],
  dofsPerNode = 3,
): GlobalDofMap<NodeId> {
  if (!Number.isSafeInteger(dofsPerNode) || dofsPerNode <= 0) {
    throw new RangeError('dofsPerNode must be a positive safe integer')
  }
  const result = new Map<NodeId, readonly number[]>()
  for (const [nodeIndex, nodeId] of nodeIds.entries()) {
    requireNodeId(nodeId)
    if (result.has(nodeId)) throw new RangeError(`duplicate node ID: ${nodeId}`)
    result.set(nodeId, Array.from(
      { length: dofsPerNode }, (_, dofIndex) => nodeIndex * dofsPerNode + dofIndex,
    ))
  }
  return result
}

/** Resolve element DOFs as all node-i DOFs followed by all node-j DOFs. */
export function elementDofIndices<NodeId extends string>(
  nodeI: NodeId,
  nodeJ: NodeId,
  globalDofs: GlobalDofMap<NodeId>,
): readonly number[] {
  if (nodeI === nodeJ) throw new RangeError('element end nodes must be distinct')
  const dofsI = globalDofs.get(nodeI)
  const dofsJ = globalDofs.get(nodeJ)
  if (dofsI === undefined) throw new RangeError(`node ID not found in DOF map: ${nodeI}`)
  if (dofsJ === undefined) throw new RangeError(`node ID not found in DOF map: ${nodeJ}`)
  if (dofsI.length === 0 || dofsI.length !== dofsJ.length) {
    throw new RangeError('element end nodes must have equal nonzero DOF counts')
  }
  const indices = [...dofsI, ...dofsJ]
  if (indices.some((index) => !Number.isSafeInteger(index) || index < 0)) {
    throw new RangeError('global DOF indices must be nonnegative safe integers')
  }
  if (new Set(indices).size !== indices.length) {
    throw new RangeError('element global DOF indices must be unique')
  }
  return indices
}
