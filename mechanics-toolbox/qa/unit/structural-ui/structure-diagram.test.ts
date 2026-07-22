import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { BeamModel2D, FrameModel2D, TrussModel2D } from '../../../src/core/structural/contracts'
import StructureDiagram from '../../../src/features/structural/components/StructureDiagram.vue'

const frame: FrameModel2D = {
  analysis: 'frame', units: 'SI', materials: [], sections: [],
  nodes: [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 3, y: 4 }],
  elements: [{
    type: 'frame', id: 'E1', nodeI: 'N1', nodeJ: 'N2',
    properties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 },
  }],
  constraints: [
    { nodeId: 'N1', dof: 'u', value: 0 },
    { nodeId: 'N1', dof: 'v', value: 0 },
    { nodeId: 'N1', dof: 'theta', value: 0 },
    { nodeId: 'N2', dof: 'v', value: 0 },
  ],
  loads: [
    { type: 'nodal', id: 'P1', nodeId: 'N2', fx: 1_000, fy: -2_000, mz: 300 },
    { type: 'frame-uniform', id: 'Q1', elementId: 'E1', qX: 500, qY: -800, interval: { a: 1, b: 4 } },
    { type: 'uniform-temperature', id: 'T1', elementId: 'E1', deltaT: 25 },
  ],
}

describe('P2 StructureDiagram', () => {
  it('renders IDs, global/local axes and support types from frame input', () => {
    const wrapper = mount(StructureDiagram, { props: { model: frame } })
    expect(wrapper.get('svg').attributes('viewBox')).toBe('0 0 960 520')
    expect(wrapper.get('title').text()).toContain('全局 x 向右、y 向上')
    expect(wrapper.findAll('.node').map((node) => node.attributes('data-node-id'))).toEqual(['N1', 'N2'])
    expect(wrapper.get('[data-element-id="E1"].element-line').attributes('data-element-type')).toBe('frame')
    expect(wrapper.get('[data-element-id="E1"].element-line').attributes('data-node-i')).toBe('N1')
    expect(wrapper.get('[data-element-id="E1"].element-line').attributes('data-node-j')).toBe('N2')
    expect(wrapper.get('.element-label').text()).toBe('E1 · N1→N2')
    const axes = wrapper.get('[data-element-id="E1"].local-axes')
    expect(Number(axes.attributes('data-c'))).toBeCloseTo(0.6, 12)
    expect(Number(axes.attributes('data-s'))).toBeCloseTo(0.8, 12)
    expect(wrapper.get('[data-node-id="N1"].support').attributes('data-support')).toBe('fixed')
    expect(wrapper.get('[data-node-id="N1"].support').attributes('data-orientation')).toBe('bottom')
    expect(wrapper.get('[data-node-id="N2"].support').attributes('data-support')).toBe('roller-y')
  })

  it('draws portal-frame column bases below the endpoints and preserves the 4→3 right-column direction', () => {
    const portal: FrameModel2D = {
      ...frame,
      nodes: [
        { id: '1', x: 0, y: 0 }, { id: '2', x: 0, y: 3 },
        { id: '3', x: 4, y: 3 }, { id: '4', x: 4, y: 0 },
      ],
      elements: [
        { ...frame.elements[0]!, id: '12', nodeI: '1', nodeJ: '2' },
        { ...frame.elements[0]!, id: '23', nodeI: '2', nodeJ: '3' },
        { ...frame.elements[0]!, id: '43', nodeI: '4', nodeJ: '3' },
      ],
      constraints: ['1', '4'].flatMap((nodeId) => (['u', 'v', 'theta'] as const)
        .map((dof) => ({ nodeId, dof, value: 0 as const }))),
      loads: [],
    }
    const wrapper = mount(StructureDiagram, { props: { model: portal } })
    for (const nodeId of ['1', '4']) {
      expect(wrapper.get(`[data-node-id="${nodeId}"].support`).attributes('data-orientation')).toBe('bottom')
    }
    const rightColumn = wrapper.get('[data-element-id="43"].element-line')
    expect(rightColumn.attributes('data-node-i')).toBe('4')
    expect(rightColumn.attributes('data-node-j')).toBe('3')
    expect(wrapper.findAll('.element-label').map((label) => label.text())).toContain('43 · 4→3')
    const node4 = wrapper.get('.node[data-node-id="4"] circle').attributes()
    expect(rightColumn.attributes('x1')).toBe(node4.cx)
    expect(rightColumn.attributes('y1')).toBe(node4.cy)
  })

  it('renders nodal and distributed load directions plus exact-input legend', () => {
    const wrapper = mount(StructureDiagram, { props: { model: frame, unitPresetId: 'si' } })
    expect(wrapper.get('[data-load-id="P1"][data-load-kind="Fx"]').attributes('data-direction')).toBe('global+x')
    expect(wrapper.get('[data-load-id="P1"][data-load-kind="Fy"]').attributes('data-direction')).toBe('global-y')
    expect(wrapper.get('.nodal-moment[data-load-id="P1"]').attributes('data-direction')).toBe('positive-ccw')
    expect(wrapper.findAll('[data-load-id="Q1"][data-load-kind="qX"]')).toHaveLength(5)
    expect(wrapper.findAll('[data-load-id="Q1"][data-load-kind="qY"]')).toHaveLength(5)
    expect(wrapper.get('.legend-object[data-load-id="Q1"] .legend-item').text()).toContain('[1, 4] m')
    expect(wrapper.get('.legend-object[data-load-id="T1"] .legend-item').text()).toContain('ΔT=25 ΔK')
  })

  it('switches every legend quantity atomically to the shared engineering units', async () => {
    const model: FrameModel2D = {
      ...frame,
      loads: [
        ...frame.loads,
        { type: 'initial-strain', id: 'IS1', elementId: 'E1', strain: 500e-6 },
      ],
    }
    const wrapper = mount(StructureDiagram, { props: { model, unitPresetId: 'engineering' } })
    expect(wrapper.text()).toContain('输入载荷（工程单位）')
    expect(wrapper.get('.legend-object[data-load-id="P1"] .legend-item').text()).toContain('Fx=1000 N')
    expect(wrapper.get('.legend-object[data-load-id="P1"] .legend-item').text()).toContain('Mz=300000 N·mm')
    expect(wrapper.get('.legend-object[data-load-id="Q1"] .legend-item').text()).toContain('qx=0.5 N/mm')
    expect(wrapper.get('.legend-object[data-load-id="Q1"] .legend-item').text()).toContain('[1000, 4000] mm')
    expect(wrapper.get('.legend-object[data-load-id="IS1"] .legend-item').text()).toContain('ε₀=500 με')
    await wrapper.setProps({ unitPresetId: 'si' })
    expect(wrapper.text()).toContain('输入载荷（SI）')
    expect(wrapper.get('.legend-object[data-load-id="P1"] .legend-item').text()).toContain('Mz=300 N·m')
    expect(wrapper.get('.legend-object[data-load-id="Q1"] .legend-item').text()).toContain('qx=500 N/m')
    expect(wrapper.get('.legend-object[data-load-id="IS1"] .legend-item').text()).toContain('ε₀=0.0005 1')
  })

  it('renders truss pin/roller, self-weight direction and omits mechanical computation', () => {
    const truss: TrussModel2D = {
      analysis: 'truss', units: 'SI', materials: [], sections: [],
      nodes: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 2, y: 0 }],
      elements: [{
        type: 'truss', id: 'AB', nodeI: 'A', nodeJ: 'B',
        properties: { source: 'inline', E: 200e9, A: 0.001, density: 7850 },
      }],
      constraints: [
        { nodeId: 'A', dof: 'u', value: 0 }, { nodeId: 'A', dof: 'v', value: 0 },
        { nodeId: 'B', dof: 'v', value: 0 },
      ],
      loads: [{ type: 'truss-self-weight', id: 'SW', elementId: 'AB', gravity: 9.81 }],
    }
    const wrapper = mount(StructureDiagram, { props: { model: truss, unitPresetId: 'si' } })
    expect(wrapper.get('[data-node-id="A"].support').attributes('data-support')).toBe('pin')
    expect(wrapper.get('[data-node-id="B"].support').attributes('data-support')).toBe('roller-y')
    expect(wrapper.get('[data-load-id="SW"][data-load-kind="self-weight"]').attributes('data-direction')).toBe('global-y')
    expect(wrapper.text()).toContain('g=9.81 m/s²')
    expect(wrapper.text()).not.toContain('反力')
  })

  it('renders beam IDs, local axes and local distributed-load direction', () => {
    const beam: BeamModel2D = {
      analysis: 'beam', topology: 'single-span', propertyPolicy: 'uniform', units: 'SI',
      materials: [], sections: [],
      uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 },
      nodes: [{ id: 'I', x: 0, y: 0 }, { id: 'J', x: 4, y: 0 }],
      elements: [{ type: 'beam', id: 'BIJ', nodeI: 'I', nodeJ: 'J' }],
      constraints: [
        { nodeId: 'I', dof: 'u', value: 0 }, { nodeId: 'I', dof: 'v', value: 0 },
        { nodeId: 'J', dof: 'v', value: 0 },
      ],
      loads: [{ type: 'beam-uniform', id: 'BQ', elementId: 'BIJ', qY: -10_000 }],
    }
    const wrapper = mount(StructureDiagram, { props: { model: beam, unitPresetId: 'si' } })
    expect(wrapper.get('[data-element-id="BIJ"].local-axes').attributes('data-c')).toBe('1')
    expect(wrapper.get('[data-load-id="BQ"][data-load-kind="qY"]').attributes('data-direction')).toBe('qY-')
    expect(wrapper.get('.legend-object[data-load-id="BQ"] .legend-item').text()).toContain('qy=-10000 N/m（局部）')
  })

  it('marks optional deformation as non-true scale', () => {
    const wrapper = mount(StructureDiagram, {
      props: {
        model: frame,
        deformation: {
          scale: 100,
          nodeDisplacements: [{ nodeId: 'N1', u: 0, v: 0 }, { nodeId: 'N2', u: 0.01, v: -0.02 }],
        },
      },
    })
    expect(wrapper.findAll('.deformed-element')).toHaveLength(1)
    expect(wrapper.get('.deformation-warning').text()).toContain('非真实比例')
    expect(wrapper.get('.deformation-warning').text()).toContain('×100')
  })

  it('toggles labels, axes, supports, loads and result layers independently', async () => {
    const wrapper = mount(StructureDiagram, {
      props: {
        model: frame,
        deformation: {
          scale: 100,
          nodeDisplacements: [{ nodeId: 'N1', u: 0, v: 0 }, { nodeId: 'N2', u: 0.01, v: -0.02 }],
        },
      },
    })
    const layerSelectors = {
      nodeLabels: '.node-label',
      elementLabels: '.element-label',
      localAxes: '.local-axes',
      supports: '.support',
      loads: '.load-arrow, .nodal-moment',
      results: '.deformed-element',
    } as const
    for (const [layer, selector] of Object.entries(layerSelectors)) {
      expect(wrapper.findAll(selector).length, `${layer} initially visible`).toBeGreaterThan(0)
      await wrapper.setProps({ layers: { [layer]: false } })
      expect(wrapper.findAll(selector), `${layer} hidden`).toHaveLength(0)
      if (layer === 'loads') expect(wrapper.findAll('.legend-zone')).toHaveLength(0)
      await wrapper.setProps({ layers: { [layer]: true } })
      expect(wrapper.findAll(selector).length, `${layer} restored`).toBeGreaterThan(0)
    }
  })

  it('keeps mobile labels inside a scalable safe viewBox without forcing horizontal scrolling', () => {
    const manyLoads: FrameModel2D = {
      ...frame,
      loads: Array.from({ length: 22 }, (_, index) => ({
        type: 'nodal' as const, id: `P${index}`, nodeId: 'N2', fy: -(index + 1),
      })),
    }
    const wrapper = mount(StructureDiagram, { props: { model: manyLoads } })
    const svg = wrapper.get('svg')
    expect(wrapper.get('.structure-diagram-scroll').attributes('aria-label')).not.toContain('横向滚动')
    expect(svg.attributes('data-safe-left')).toBe('16')
    expect(svg.attributes('data-safe-right')).toBe('944')
    expect(svg.attributes('viewBox')).toBe('0 0 960 1152')
    expect(Number(wrapper.get('.legend-zone').attributes('data-zone-min-x'))).toBeGreaterThan(PLOT_RIGHT_FOR_TEST)
    expect(wrapper.findAll('.legend-item')).toHaveLength(22)
    expect(wrapper.findAll('.legend-object').every((item) => item.attributes('width') === '216')).toBe(true)
  })
})

const PLOT_RIGHT_FOR_TEST = 712
