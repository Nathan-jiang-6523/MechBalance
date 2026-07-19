import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StructuralWorkspace from '../../../src/features/structural/StructuralWorkspace.vue'

describe('P2 StructuralWorkspace', () => {
  it('shows explicit status vocabulary and disables every planned module', () => {
    const wrapper = mount(StructuralWorkspace)
    expect(wrapper.findAll('.status-legend [data-status]')).toHaveLength(3)
    expect(wrapper.text()).toContain('available · 可用')
    expect(wrapper.text()).toContain('beta · 试用')
    expect(wrapper.text()).toContain('planned · 计划中')

    const available = wrapper.findAll('button[data-status="available"]')
    const planned = wrapper.findAll('button[data-status="planned"]')
    expect(available).toHaveLength(5)
    expect(available.every((button) => !button.attributes('disabled'))).toBe(true)
    expect(planned).toHaveLength(2)
    expect(planned.every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('starts on beam and switches only to selectable modules', async () => {
    const wrapper = mount(StructuralWorkspace)
    expect(wrapper.get('[data-testid="structural-module-stage"]').text()).toContain('1D 梁')
    expect(wrapper.get('[data-formula-id="P2-EB-001"]').exists()).toBe(true)

    await wrapper.get('button[data-module-id="truss"]').trigger('click')
    expect(wrapper.get('[data-testid="structural-module-stage"]').text()).toContain('平面桁架')
    expect(wrapper.get('[data-formula-id="P2-TRUSS-001"]').exists()).toBe(true)
    expect(wrapper.emitted('module-change')).toEqual([['truss']])

    await wrapper.get('button[data-module-id="advanced-beam"]').trigger('click')
    expect(wrapper.get('[data-testid="structural-module-stage"]').text()).toContain('平面桁架')
    expect(wrapper.emitted('module-change')).toEqual([['truss']])
  })
})
