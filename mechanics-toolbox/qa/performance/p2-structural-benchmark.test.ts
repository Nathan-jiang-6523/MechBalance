import { performance } from 'node:perf_hooks'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { solveFrameFiniteElement, type FrameModel2D } from '../../src/core/structural'
import { runStructuralCalculation } from '../../src/features/structural/calculation'
import StructuralResults from '../../src/features/structural/components/StructuralResults.vue'

function maximumFrameModel(): FrameModel2D {
  const nodes = Array.from({ length: 100 }, (_, index) => ({
    id: `N${index}`,
    x: index % 10,
    y: Math.floor(index / 10),
  }))
  const pairs: Array<readonly [number, number]> = []
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const index = row * 10 + column
      if (column < 9) pairs.push([index, index + 1])
      if (row < 9) pairs.push([index, index + 10])
    }
  }
  return {
    analysis: 'frame',
    units: 'SI',
    nodes,
    materials: [],
    sections: [],
    elements: pairs.map(([nodeI, nodeJ], index) => ({
      type: 'frame',
      id: `E${index}`,
      nodeI: nodes[nodeI]!.id,
      nodeJ: nodes[nodeJ]!.id,
      properties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 },
    })),
    constraints: [
      { nodeId: 'N0', dof: 'u', value: 0 },
      { nodeId: 'N0', dof: 'v', value: 0 },
      { nodeId: 'N0', dof: 'theta', value: 0 },
    ],
    loads: [{ type: 'nodal', id: 'P', nodeId: 'N99', fy: -1_000 }],
  }
}

function measure(action: () => unknown, repetitions: number): readonly number[] {
  return Array.from({ length: repetitions }, () => {
    const started = performance.now()
    action()
    return performance.now() - started
  })
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]!
}

describe('P2 confirmed-size performance record', () => {
  it('measures 100 nodes / 180 elements / 297 free DOFs without changing solver behavior', () => {
    const model = maximumFrameModel()
    const warmup = solveFrameFiniteElement(model)
    expect(warmup.ok).toBe(true)

    const solveMilliseconds = measure(() => solveFrameFiniteElement(model), 5)
    const presentationMilliseconds = measure(() => runStructuralCalculation(model), 5)
    const record = {
      runtime: `${process.platform} ${process.arch}; Node ${process.version}`,
      model: { nodes: 100, elements: 180, freeDofs: 297 },
      repetitions: 5,
      solveMilliseconds,
      solveMedianMilliseconds: median(solveMilliseconds),
      solveMaximumMilliseconds: Math.max(...solveMilliseconds),
      solveAndPresentationMilliseconds: presentationMilliseconds,
      solveAndPresentationMedianMilliseconds: median(presentationMilliseconds),
      solveAndPresentationMaximumMilliseconds: Math.max(...presentationMilliseconds),
    }
    console.info(`P2_PERFORMANCE_RECORD=${JSON.stringify(record)}`)
    const screenResult = runStructuralCalculation(model)
    expect(screenResult.status).toBe('success')
    const renderStarted = performance.now()
    const wrapper = mount(StructuralResults, {
      props: { result: screenResult },
      global: { stubs: { StructuralChart: { template: '<div data-testid="chart-stub" />' } } },
    })
    const renderMilliseconds = performance.now() - renderStarted
    console.info(`P2_UI_RENDER_RECORD=${JSON.stringify({
      environment: 'Vue Test Utils + jsdom; StructuralChart stubbed',
      tableRows: wrapper.findAll('tbody tr').length,
      renderMilliseconds,
    })}`)
    wrapper.unmount()
  }, 30_000)
})
