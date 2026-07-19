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
    const axes = wrapper.get('[data-element-id="E1"].local-axes')
    expect(Number(axes.attributes('data-c'))).toBeCloseTo(0.6, 12)
    expect(Number(axes.attributes('data-s'))).toBeCloseTo(0.8, 12)
    expect(wrapper.get('[data-node-id="N1"].support').attributes('data-support')).toBe('fixed')
    expect(wrapper.get('[data-node-id="N2"].support').attributes('data-support')).toBe('roller-y')
  })

  it('renders nodal and distributed load directions plus exact-input legend', () => {
    const wrapper = mount(StructureDiagram, { props: { model: frame } })
    expect(wrapper.get('[data-load-id="P1"][data-load-kind="Fx"]').attributes('data-direction')).toBe('global+x')
    expect(wrapper.get('[data-load-id="P1"][data-load-kind="Fy"]').attributes('data-direction')).toBe('global-y')
    expect(wrapper.get('.nodal-moment[data-load-id="P1"]').attributes('data-direction')).toBe('positive-ccw')
    expect(wrapper.findAll('[data-load-id="Q1"][data-load-kind="qX"]')).toHaveLength(5)
    expect(wrapper.findAll('[data-load-id="Q1"][data-load-kind="qY"]')).toHaveLength(5)
    expect(wrapper.get('.legend-object[data-load-id="Q1"] .legend-item').text()).toContain('[1, 4] m')
    expect(wrapper.get('.legend-object[data-load-id="T1"] .legend-item').text()).toContain('ΔT=25 K')
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
    const wrapper = mount(StructureDiagram, { props: { model: truss } })
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
    const wrapper = mount(StructureDiagram, { props: { model: beam } })
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

  it('keeps mobile labels inside fixed safe viewBox with horizontal scrolling', () => {
    const manyLoads: FrameModel2D = {
      ...frame,
      loads: Array.from({ length: 22 }, (_, index) => ({
        type: 'nodal' as const, id: `P${index}`, nodeId: 'N2', fy: -(index + 1),
      })),
    }
    const wrapper = mount(StructureDiagram, { props: { model: manyLoads } })
    const svg = wrapper.get('svg')
    expect(wrapper.get('.structure-diagram-scroll').attributes('tabindex')).toBe('0')
    expect(svg.attributes('data-safe-left')).toBe('16')
    expect(svg.attributes('data-safe-right')).toBe('944')
    expect(svg.attributes('viewBox')).toBe('0 0 960 1152')
    expect(Number(wrapper.get('.legend-zone').attributes('data-zone-min-x'))).toBeGreaterThan(PLOT_RIGHT_FOR_TEST)
    expect(wrapper.findAll('.legend-item')).toHaveLength(22)
    expect(wrapper.findAll('.legend-object').every((item) => item.attributes('width') === '216')).toBe(true)
  })
})

const PLOT_RIGHT_FOR_TEST = 712
