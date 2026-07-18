import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StressCalculator from '../../../src/features/stress/StressCalculator.vue'

describe('StressCalculator', () => {
  it('renders plane stress results and labelled Mohr circle', async () => {
    const wrapper = mount(StressCalculator)
    await wrapper.get('button.calculate').trigger('click')
    expect(wrapper.text()).toContain('σ1 = 100.000 MPa')
    expect(wrapper.text()).toContain('von Mises 等效应力')
    expect(wrapper.text()).toContain('A(σx, τxy)')
    expect(wrapper.text()).toContain('物理逆时针 θ → 圆上顺时针 2θ')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('switches to bending-torsion and reports selected-fibre recovery', async () => {
    const wrapper = mount(StressCalculator)
    await wrapper.get('.mode-tabs button:nth-child(2)').trigger('click')
    await wrapper.get('button.calculate').trigger('click')
    expect(wrapper.text()).toContain('选定外缘弯曲正应力')
    expect(wrapper.text()).toContain('选定外缘扭转剪应力')
    expect(wrapper.text()).toContain('圆截面采用')
  })

  it('shows arbitrary direction without NaN for degenerate state', async () => {
    const wrapper = mount(StressCalculator)
    const inputs = wrapper.findAll('.field-grid input')
    await inputs[0]!.setValue('80')
    await inputs[1]!.setValue('80')
    await inputs[2]!.setValue('0')
    await wrapper.get('button.calculate').trigger('click')
    expect(wrapper.text()).toContain('θp = 任意')
    expect(wrapper.text()).toContain('A = B（σx = σy，τxy = 0）')
    expect(wrapper.text()).toContain('σ1 = σ2 = 80.000 MPa')
    expect(wrapper.text()).not.toContain('A(σx, τxy)')
    expect(wrapper.text()).not.toContain('NaN')
  })

  it('shows strength overload and clears results on illegal geometry', async () => {
    const wrapper = mount(StressCalculator)
    await wrapper.get('.mode-tabs button:nth-child(2)').trigger('click')
    await wrapper.get('.strength-field input').setValue('10')
    await wrapper.get('button.calculate').trigger('click')
    expect(wrapper.text()).toContain('超出输入强度')

    const diameterInput = wrapper.findAll('.input-panel .field-grid input')[2]!
    await diameterInput.setValue('0')
    await wrapper.get('button.calculate').trigger('click')
    expect(wrapper.text()).toContain('直径必须是大于 0')
    expect(wrapper.find('.result-grid').exists()).toBe(false)
  })

  it('clears values on unit change and preserves the physical result after re-entry', async () => {
    const wrapper = mount(StressCalculator)
    await wrapper.get('[aria-label="平面应力输入单位"]').setValue('GPa')
    const inputs = wrapper.findAll('.field-grid input')
    expect(inputs[0]!.element.value).toBe('')
    await inputs[0]!.setValue('0.1')
    await inputs[1]!.setValue('0')
    await inputs[2]!.setValue('0')
    await wrapper.get('button.calculate').trigger('click')
    expect(wrapper.text()).toContain('σ1 = 100.000 MPa')
  })
})
