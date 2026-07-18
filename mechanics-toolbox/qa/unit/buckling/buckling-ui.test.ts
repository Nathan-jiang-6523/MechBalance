import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BucklingCalculator from '../../../src/features/buckling/BucklingCalculator.vue'

describe('BucklingCalculator', () => {
  it('requires an explicit calculation and shows the controlling weak axis', async () => {
    const wrapper = mount(BucklingCalculator)
    expect(wrapper.text()).toContain('不内置通用阈值')
    expect(wrapper.text()).not.toContain('欧拉临界载荷 Pcr')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('控制弱轴')
    expect(wrapper.text()).toContain('y 轴')
    expect(wrapper.text()).toContain('未配置项目/规范长细比阈值')
  })

  it('updates the effective length factor when the boundary changes', async () => {
    const wrapper = mount(BucklingCalculator)
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('fixedFree')
    expect(wrapper.text()).toContain('K = 2')
  })

  it('clears changed units and reproduces the engineering-unit result in SI-sized inputs', async () => {
    const wrapper = mount(BucklingCalculator)
    const selects = wrapper.findAll('select')
    await selects[1]!.setValue('m')
    await selects[2]!.setValue('GPa')
    await selects[4]!.setValue('cm')
    const inputs = wrapper.findAll('.input-panel input')
    expect(inputs[0]!.element.value).toBe('')
    expect(inputs[2]!.element.value).toBe('')
    await inputs[0]!.setValue('2')
    await inputs[1]!.setValue('200')
    await inputs[2]!.setValue('3')
    await inputs[3]!.setValue('6')
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('66.620 kN')
  })
})
