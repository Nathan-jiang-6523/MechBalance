import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TorsionCalculator from '../../../src/features/torsion/TorsionCalculator.vue'

describe('TorsionCalculator', () => {
  it('calculates default solid shaft and displays engineering conclusions', async () => {
    const wrapper = mount(TorsionCalculator)
    await wrapper.findAll('button.calculate')[0]!.trigger('click')
    const results = wrapper.get('[data-testid="shaft-results"]')
    expect(results.text()).toContain('τmax')
    expect(results.text()).toContain('40.744')
    expect(results.text()).toContain('1.167')
  })

  it('enforces mutually exclusive power solve fields', async () => {
    const wrapper = mount(TorsionCalculator)
    expect(wrapper.get('input[aria-label="传动扭矩"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[aria-label="功率"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('input[value="power"]').setValue(true)
    expect(wrapper.get('input[aria-label="功率"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[aria-label="传动扭矩"]').attributes('disabled')).toBeUndefined()
  })

  it('calculates default power relation', async () => {
    const wrapper = mount(TorsionCalculator)
    await wrapper.findAll('button.calculate')[1]!.trigger('click')
    const results = wrapper.get('[data-testid="power-results"]')
    expect(results.text()).toContain('63661.977')
    expect(results.text()).toContain('1500')
  })

  it('shows explicit error for zero speed when solving torque', async () => {
    const wrapper = mount(TorsionCalculator)
    await wrapper.get('input[aria-label="转速"]').setValue('0')
    await wrapper.findAll('button.calculate')[1]!.trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('转速为 0')
    expect(wrapper.find('[data-testid="power-results"]').exists()).toBe(false)
  })
})
