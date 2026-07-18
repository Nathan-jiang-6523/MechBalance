import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BeamInputPanel from '../../../src/features/beam/input/BeamInputPanel.vue'
import LoadEditor from '../../../src/features/beam/input/LoadEditor.vue'
import {
  createDefaultBeamInputDraft,
  type BeamInputDraft,
} from '../../../src/features/beam/input/input-types'

describe('BeamInputPanel', () => {
  it('renders the default case and emits calculate only for valid input', async () => {
    const draft = createDefaultBeamInputDraft()
    const wrapper = mount(BeamInputPanel, { props: { modelValue: draft } })
    expect(wrapper.text()).toContain('简支梁')
    expect(wrapper.text()).toContain('截面几何')
    expect(wrapper.findAllComponents(LoadEditor)).toHaveLength(1)
    await wrapper.get('button.calculate-button').trigger('click')
    expect(wrapper.emitted('calculate')?.[0]?.[0]).toEqual(draft)
  })

  it('clears a field instead of silently converting when its unit changes', async () => {
    const wrapper = mount(BeamInputPanel, {
      props: { modelValue: createDefaultBeamInputDraft() },
    })
    await wrapper.get('select[aria-label="梁长单位"]').setValue('m')
    const emitted = wrapper.emitted('update:modelValue')
    const next = emitted?.at(-1)?.[0] as BeamInputDraft
    expect(next.length).toEqual({ value: '', unit: 'm' })
  })

  it('switches to signed mode and hides every direction selector', async () => {
    const wrapper = mount(BeamInputPanel, {
      props: { modelValue: createDefaultBeamInputDraft() },
    })
    expect(wrapper.find('select[aria-label="载荷方向"]').exists()).toBe(true)
    const mode = wrapper.findAll('select').find((select) => select.element.value === 'magnitudeDirection')
    expect(mode).toBeDefined()
    await mode?.setValue('signed')
    const next = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as BeamInputDraft
    await wrapper.setProps({ modelValue: next })
    expect(wrapper.find('select[aria-label="载荷方向"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('带符号数值')
    expect(next.loads[0]?.magnitude.value).toBe('-10000')
  })

  it('clears section dimensions on unit changes', async () => {
    const wrapper = mount(BeamInputPanel, {
      props: { modelValue: createDefaultBeamInputDraft() },
    })
    await wrapper.get('select[aria-label="宽度单位"]').setValue('cm')
    const next = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as BeamInputDraft
    expect(next.section.dimensions.width).toEqual({ value: '', unit: 'cm' })
  })

  it('shows an explicit simple-support endpoint error and blocks calculation', async () => {
    const draft = createDefaultBeamInputDraft()
    const first = draft.loads[0]
    if (!first || first.type !== 'pointForce') throw new Error('fixture type')
    const invalid: BeamInputDraft = {
      ...draft,
      loads: [{ ...first, position: { value: '0', unit: 'mm' } }],
    }
    const wrapper = mount(BeamInputPanel, { props: { modelValue: invalid } })
    expect(wrapper.text()).toContain('简支梁集中力位置必须满足 0 < a < L')
    await wrapper.get('button.calculate-button').trigger('click')
    expect(wrapper.emitted('calculate')).toBeUndefined()
  })
})
