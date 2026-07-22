import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { InfluenceLineRequest } from '../../../src/core/structural/contracts'
import InfluenceLineSchematic from '../../../src/features/structural/components/InfluenceLineSchematic.vue'

const shearRequest: InfluenceLineRequest = {
  analysis: 'influence-line',
  units: 'SI',
  beam: { topology: 'simply-supported', span: 10 },
  response: { type: 'section-shear', position: 4, retainBothLimits: true },
  samplePositions: [0, 2, 4, 7, 10],
}

describe('P2 InfluenceLineSchematic', () => {
  it('marks the fixed section separately from the moving unit-load position', () => {
    const wrapper = mount(InfluenceLineSchematic, { props: { request: shearRequest, unitPresetId: 'si' } })
    expect(wrapper.attributes('data-response-type')).toBe('section-shear')
    expect(wrapper.attributes('data-target-kind')).toBe('section')
    expect(wrapper.get('.target-marker').attributes('data-position')).toBe('4')
    expect(Number(wrapper.get('.target-marker').attributes('data-ratio'))).toBeCloseTo(0.4, 12)
    expect(wrapper.text()).toContain('单位荷载位置 z：0 → L')
    expect(wrapper.text()).toContain('a = 4 m')
    expect(wrapper.text()).toContain('L-a = 6 m')
    expect(wrapper.text()).toContain('目标截面剪力 V(a)影响线')
    expect(wrapper.text()).toContain('a⁻ · left')
    expect(wrapper.text()).toContain('a⁺ · right')
    expect(wrapper.get('svg').attributes('aria-labelledby')).toBeTruthy()
  })

  it('switches schematic dimensions with the shared unit preset', async () => {
    const wrapper = mount(InfluenceLineSchematic, { props: { request: shearRequest, unitPresetId: 'si' } })
    await wrapper.setProps({ unitPresetId: 'engineering' })
    expect(wrapper.text()).toContain('a = 4000 mm')
    expect(wrapper.text()).toContain('L-a = 6000 mm')
    expect(wrapper.text()).toContain('总跨度 L = 10000 mm')
  })

  it('marks a reaction target at its support without inventing a section cut', () => {
    const request: InfluenceLineRequest = {
      ...shearRequest,
      response: { type: 'left-reaction' },
    }
    const wrapper = mount(InfluenceLineSchematic, { props: { request } })
    expect(wrapper.attributes('data-target-kind')).toBe('support')
    expect(wrapper.get('.target-marker').attributes('data-position')).toBe('0')
    expect(wrapper.find('.target-cut').exists()).toBe(false)
    expect(wrapper.get('.target-support-ring').exists()).toBe(true)
    expect(wrapper.text()).toContain('A 支座竖向反力 Rₐ影响线')
  })
})
