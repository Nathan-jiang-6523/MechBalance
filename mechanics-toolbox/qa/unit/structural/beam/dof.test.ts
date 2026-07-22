import { describe, expect, it } from 'vitest'

import { createGlobalDofMap, elementDofIndices, type GlobalDofMap } from '../../../../src/core/structural/beam'

describe('P2 beam DOF mapping', () => {
  it('freezes per-node [u,v,theta] and local i-then-j order', () => {
    const map = createGlobalDofMap(['n20', 'n3', 'n11'])
    expect([...map]).toEqual([
      ['n20', [0, 1, 2]],
      ['n3', [3, 4, 5]],
      ['n11', [6, 7, 8]],
    ])
    expect(elementDofIndices('n11', 'n20', map)).toEqual([6, 7, 8, 0, 1, 2])
  })

  it('maps the same connectivity under a different node ordering', () => {
    const first = createGlobalDofMap(['left', 'right'])
    const second = createGlobalDofMap(['right', 'left'])
    expect(elementDofIndices('left', 'right', first)).toEqual([0, 1, 2, 3, 4, 5])
    expect(elementDofIndices('left', 'right', second)).toEqual([3, 4, 5, 0, 1, 2])
  })

  it('rejects duplicate/missing/coincident/invalid mappings', () => {
    expect(() => createGlobalDofMap(['n1', 'n1'])).toThrow('duplicate node ID')
    expect(() => createGlobalDofMap(['n1'], 0)).toThrow('dofsPerNode')
    const map = createGlobalDofMap(['n1', 'n2'])
    expect(() => elementDofIndices('n1', 'missing', map)).toThrow('not found')
    expect(() => elementDofIndices('n1', 'n1', map)).toThrow('distinct')
    const duplicate = new Map([['n1', [0, 1, 2]], ['n2', [2, 3, 4]]]) as GlobalDofMap
    expect(() => elementDofIndices('n1', 'n2', duplicate)).toThrow('unique')
  })
})
