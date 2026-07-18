import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AxialCalculator from '../../../src/features/axial/AxialCalculator.vue'

describe('AxialCalculator', () => {
  it('calculates default free axial and thermal deformation', async () => {
    const wrapper = mount(AxialCalculator)
    expect(wrapper.text()).toContain('默认输入：mm · N · MPa')
    expect(wrapper.text()).toContain('等待首次计算')

    await wrapper.get('button.calculate-button').trigger('click')

    expect(wrapper.get('[data-testid="total-deformation"]').text()).toBe('0.65 mm')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('受拉')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
  })

  it('makes free and fully restrained boundary inputs mutually exclusive', async () => {
    const wrapper = mount(AxialCalculator)
    expect(wrapper.find('input[aria-label="轴向力"]').exists()).toBe(true)

    await wrapper.get('select[aria-label="端部边界"]').setValue('fullyRestrained')
    expect(wrapper.find('input[aria-label="轴向力"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('外加轴力输入已停用')
    await wrapper.get('button.calculate-button').trigger('click')

    expect(wrapper.get('[data-testid="constraint-force"]').text()).toBe('-120000 N')
    expect(wrapper.get('[data-testid="total-deformation"]').text()).toBe('0 mm')
    expect(wrapper.text()).toContain('受压')
  })

  it('adds and removes serial segments', async () => {
    const wrapper = mount(AxialCalculator)
    const addButton = wrapper.findAll('button').find((button) => button.text().includes('添加杆段'))
    expect(addButton).toBeDefined()
    await addButton?.trigger('click')
    expect(wrapper.text()).toContain('2 个串联杆段')
    expect(wrapper.find('input[aria-label="杆段 2 长度"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="删除杆段 2"]').trigger('click')
    expect(wrapper.text()).toContain('1 个串联杆段')
  })

  it('clears changed-unit values and rejects nonpositive geometry', async () => {
    const wrapper = mount(AxialCalculator)
    await wrapper.get('select[aria-label="杆段 1 长度单位"]').setValue('m')
    expect((wrapper.get('input[aria-label="杆段 1 长度"]').element as HTMLInputElement).value).toBe('')

    await wrapper.get('button.calculate-button').trigger('click')
    expect(wrapper.text()).toContain('第 1 段长度 L不能为空')
    expect(wrapper.find('[data-testid="total-deformation"]').exists()).toBe(false)

    await wrapper.get('input[aria-label="杆段 1 长度"]').setValue('-1')
    await wrapper.get('button.calculate-button').trigger('click')
    expect(wrapper.text()).toContain('第 1 段长度 L必须大于 0')
  })
})
