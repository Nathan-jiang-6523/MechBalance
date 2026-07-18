import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BeamDiagram from '../../../src/features/beam/diagram/BeamDiagram.vue'
import type { BeamLoad, BeamSupport } from '../../../src/core/beam/types'

function mountDiagram(support: BeamSupport, loads: BeamLoad[] = []) {
  return mount(BeamDiagram, {
    props: { lengthM: 2, support, loads },
  })
}

describe('BeamDiagram', () => {
  it.each([
    ['simplySupported', '简支梁：左铰右滚'],
    ['cantileverLeft', '左端固定悬臂梁'],
    ['cantileverRight', '右端固定悬臂梁'],
  ] as const)('renders %s support', (support, accessibleName) => {
    const wrapper = mountDiagram(support)
    const supportGroup = wrapper.get(`[data-support="${support}"]`)

    expect(supportGroup.attributes('aria-label')).toBe(accessibleName)
    expect(wrapper.get('title').text()).toContain('x 轴向右')
  })

  it('renders all load types with positive directions', () => {
    const wrapper = mountDiagram('simplySupported', [
      { type: 'pointForce', positionM: 0.5, forceN: 2_000 },
      { type: 'pointMoment', positionM: 1, momentNm: 300 },
      { type: 'uniformLoad', startM: 0.25, endM: 1.75, intensityNPerM: 1_500 },
    ])

    expect(wrapper.get('[data-load-type="pointForce"]').attributes('data-direction')).toBe('positive-up')
    expect(wrapper.get('[data-load-type="pointMoment"]').attributes('data-direction')).toBe('positive-ccw')
    expect(wrapper.get('[data-load-type="uniformLoad"]').attributes('data-direction')).toBe('positive-up')
    expect(wrapper.text()).toContain('F=+2 kN，x=0.5 m')
    expect(wrapper.text()).toContain('M=+300 N·m，x=1 m')
    expect(wrapper.text()).toContain('q=+1.5 kN/m，0.25 m～1.75 m')
  })

  it('renders negative force, moment and uniform-load directions', () => {
    const wrapper = mountDiagram('cantileverLeft', [
      { type: 'pointForce', positionM: 2, forceN: -4_000 },
      { type: 'pointMoment', positionM: 2, momentNm: -250 },
      { type: 'uniformLoad', startM: 0, endM: 2, intensityNPerM: -800 },
    ])

    expect(wrapper.get('[data-load-type="pointForce"]').attributes('data-direction')).toBe('negative-down')
    expect(wrapper.get('[data-load-type="pointMoment"]').attributes('data-direction')).toBe('negative-cw')
    expect(wrapper.get('[data-load-type="uniformLoad"]').attributes('data-direction')).toBe('negative-down')
  })

  it('slightly staggers coincident point loads and keeps exact positions in the legend', () => {
    const wrapper = mountDiagram('cantileverRight', [
      { type: 'pointForce', positionM: 1, forceN: -1_000 },
      { type: 'pointForce', positionM: 1, forceN: 2_000 },
      { type: 'pointMoment', positionM: 1, momentNm: 50 },
    ])
    const forceLines = wrapper.findAll('.point-force-line')

    expect(forceLines).toHaveLength(2)
    expect(forceLines[0]?.attributes('x1')).not.toBe(forceLines[1]?.attributes('x1'))
    expect(wrapper.findAll('.legend-item').map((item) => item.text()).every((text) => text.includes('x=1 m'))).toBe(true)
  })

  it('isolates long load labels from axes and dimension labels', () => {
    const wrapper = mountDiagram('simplySupported', [
      { type: 'pointForce', positionM: 0.1234, forceN: -123_456 },
    ])
    const diagramZone = wrapper.get('[data-label-zone="diagram"]')
    const legendZone = wrapper.get('[data-label-zone="legend"]')

    expect(Number(diagramZone.attributes('data-zone-max-x'))).toBeLessThan(
      Number(legendZone.attributes('data-zone-min-x')),
    )
    expect(wrapper.get('.legend-item').attributes('x')).toBe('668')
    expect(wrapper.get('.dimension-label').attributes('y')).toBe('266')
    expect(wrapper.get('.axis-x-label').attributes('y')).toBe('232')
    expect(wrapper.get('.beam-diagram').attributes('viewBox')).toBe('0 0 860 300')
  })
})
