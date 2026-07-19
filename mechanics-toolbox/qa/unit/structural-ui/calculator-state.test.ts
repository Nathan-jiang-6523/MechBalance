import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { StructuralModel2D } from '../../../src/core/structural'
import StructuralCalculator from '../../../src/features/structural/StructuralCalculator.vue'
import { getStructuralExample } from '../../../src/features/structural/examples'

const stubs = {
  StructuralWorkspace: {
    name: 'StructuralWorkspace',
    emits: ['module-change'],
    template: '<div data-testid="workspace-stub"><slot name="workspace" /></div>',
  },
  StructuralModelEditor: {
    name: 'StructuralModelEditor',
    props: ['modelValue', 'unitPresetId', 'issues'],
    emits: ['update:modelValue'],
    template: '<div data-testid="editor-stub" />',
  },
  StructureDiagram: { name: 'StructureDiagram', template: '<div data-testid="diagram-stub" />' },
  MovingLoadSchematic: {
    name: 'MovingLoadSchematic',
    props: ['request', 'result', 'unitPresetId'],
    template: '<div data-testid="moving-load-schematic-stub">{{ request.movingLoad.direction }}:{{ unitPresetId }}</div>',
  },
  StructuralResults: {
    name: 'StructuralResults',
    props: ['result', 'unitPresetId'],
    template: '<div data-testid="results-stub">{{ result.status }}:{{ unitPresetId }}</div>',
  },
}

afterEach(() => vi.useRealTimers())

describe('P2 structural calculator state machine', () => {
  it('requires a first explicit calculation and preserves results during atomic unit switches', async () => {
    const wrapper = mount(StructuralCalculator, { global: { stubs } })
    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('等待首次计算')

    await wrapper.get('.calculate-button').trigger('click')
    expect(wrapper.get('[data-testid="results-stub"]').text()).toBe('success:engineering')

    await wrapper.get('[data-unit-preset="si"]').trigger('click')
    expect(wrapper.get('[data-testid="results-stub"]').text()).toBe('success:si')
    expect(wrapper.text()).not.toContain('等待首次计算')
  })

  it('clears stale success immediately and recalculates valid edits after 300 ms', async () => {
    vi.useFakeTimers()
    const wrapper = mount(StructuralCalculator, { global: { stubs } })
    await wrapper.get('.calculate-button').trigger('click')
    const editor = wrapper.getComponent({ name: 'StructuralModelEditor' })
    const valid = getStructuralExample('BEAM-A01') as StructuralModel2D
    editor.vm.$emit('update:modelValue', structuredClone(valid))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('旧结果已清除')

    await vi.advanceTimersByTimeAsync(299)
    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="results-stub"]').text()).toContain('success')
  })

  it('marks nonfinite edits invalid immediately and does not retain old result DOM', async () => {
    vi.useFakeTimers()
    const wrapper = mount(StructuralCalculator, { global: { stubs } })
    await wrapper.get('.calculate-button').trigger('click')
    const invalid = getStructuralExample('BEAM-A01') as StructuralModel2D
    if (invalid.analysis !== 'beam') throw new Error('beam expected')
    const edited = {
      ...invalid,
      uniformProperties: { source: 'inline' as const, E: Number.NaN, A: 0.01, I: 8e-6 },
    }
    wrapper.getComponent({ name: 'StructuralModelEditor' }).vm.$emit('update:modelValue', edited)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-state="dirty-invalid"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('当前含非法数值')
    await vi.advanceTimersByTimeAsync(300)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="results-stub"]').exists()).toBe(false)
    expect(wrapper.find('[data-state="dirty-invalid"]').exists()).toBe(true)
  })

  it('loads the matching frozen example when the workspace module changes', async () => {
    const wrapper = mount(StructuralCalculator, { global: { stubs } })
    wrapper.getComponent({ name: 'StructuralWorkspace' }).vm.$emit('module-change', 'truss')
    await wrapper.vm.$nextTick()
    const model = wrapper.getComponent({ name: 'StructuralModelEditor' }).props('modelValue') as StructuralModel2D
    expect(model.analysis).toBe('truss')
    expect(wrapper.text()).toContain('TRUSS-A01')
    await wrapper.findAll('select')[0]!.setValue('TRUSS-T01')
    expect(wrapper.get('#p2-calculator-title').text()).toBe('桁架均匀温升自由伸长')
  })

  it('shows where the influence-line response is read on the beam', async () => {
    const wrapper = mount(StructuralCalculator, { global: { stubs } })
    wrapper.getComponent({ name: 'StructuralWorkspace' }).vm.$emit('module-change', 'influence-line')
    await wrapper.vm.$nextTick()
    const schematic = wrapper.get('[data-testid="influence-line-schematic"]')
    expect(schematic.attributes('data-response-type')).toBe('section-shear')
    expect(schematic.text()).toContain('单位荷载位置 z：0 → L')
    expect(schematic.text()).toContain('a = 4000 mm')
    expect(schematic.text()).toContain('目标截面剪力 V(a)影响线')
  })

  it('mounts the dedicated moving-load schematic with the active direction and units', async () => {
    const wrapper = mount(StructuralCalculator, { global: { stubs } })
    wrapper.getComponent({ name: 'StructuralWorkspace' }).vm.$emit('module-change', 'moving-load')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="moving-load-schematic-stub"]').text()).toBe('left-to-right:engineering')
  })
})
