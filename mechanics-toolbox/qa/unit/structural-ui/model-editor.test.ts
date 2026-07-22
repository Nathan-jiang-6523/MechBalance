import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type {
  FrameUniformLoad,
  FrameModel2D,
  StructuralIssue,
  StructuralModel2D,
  TrussModel2D,
} from '../../../src/core/structural/contracts'
import StructuralModelEditor from '../../../src/features/structural/components/StructuralModelEditor.vue'

const frame: FrameModel2D = {
  analysis: 'frame', units: 'SI',
  nodes: [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 3, y: 4 }],
  materials: [{ id: 'steel', E: 200e9, alpha: 12e-6, density: 7850 }],
  sections: [{ id: 'sec', A: 0.01, I: 8e-5, extremeFiberY: 0.12 }],
  elements: [{
    type: 'frame', id: 'E1', nodeI: 'N1', nodeJ: 'N2',
    properties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 },
  }],
  constraints: [{ nodeId: 'N1', dof: 'u', value: 0 }],
  loads: [{
    type: 'frame-uniform', id: 'Q1', elementId: 'E1',
    qX: 1_000, qY: -10_000, interval: { a: 1, b: 4 },
  }],
}

function emittedModel(wrapper: ReturnType<typeof mount>, emissionIndex = -1): StructuralModel2D {
  const values = wrapper.emitted('update:modelValue')!
  const selected = values[emissionIndex < 0 ? values.length - 1 : emissionIndex]!
  return selected[0] as StructuralModel2D
}

describe('P2 StructuralModelEditor', () => {
  it('switches engineering/SI display atomically without changing canonical model', async () => {
    const wrapper = mount(StructuralModelEditor, {
      props: { modelValue: frame, unitPresetId: 'engineering', issues: [] },
    })
    const x = () => wrapper.get('input[data-field="nodes[1].x"]')
    expect((x().element as HTMLInputElement).value).toBe('3000')
    expect(x().element.parentElement?.textContent).toContain('mm')
    expect((wrapper.get('input[data-field="materials[0].E"]').element as HTMLInputElement).value).toBe('200000')

    await wrapper.setProps({ unitPresetId: 'si' })
    expect((x().element as HTMLInputElement).value).toBe('3')
    expect(x().element.parentElement?.textContent).toContain('m')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(frame.nodes[1]!.x).toBe(3)

    await wrapper.setProps({ unitPresetId: 'engineering' })
    await x().setValue('2500')
    expect(emittedModel(wrapper).nodes[1]!.x).toBe(2.5)
  })

  it('links each issue field exactly and marks its numeric control invalid', () => {
    const issues: readonly StructuralIssue[] = [{
      code: 'P2_NONFINITE_INPUT', severity: 'error', message: '节点 N1 x 非法',
      field: 'nodes[0].x', nodeId: 'N1',
    }]
    const wrapper = mount(StructuralModelEditor, {
      props: { modelValue: frame, unitPresetId: 'si', issues },
    })
    const input = wrapper.get('input[data-field="nodes[0].x"]')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-issue-field="nodes[0].x"] a').attributes('href'))
      .toBe(`#${input.attributes('id')}`)
    expect(wrapper.get('[data-issue-field="nodes[0].x"]').text()).toContain('节点 N1 x 非法')
  })

  it('adds, edits and removes rows without mutating input model', async () => {
    const wrapper = mount(StructuralModelEditor, {
      props: { modelValue: frame, unitPresetId: 'si', issues: [] },
    })
    await wrapper.get('[data-add="nodes"]').trigger('click')
    const withNode = emittedModel(wrapper)
    expect(withNode.nodes).toHaveLength(3)
    expect(frame.nodes).toHaveLength(2)

    await wrapper.setProps({ modelValue: withNode })
    await wrapper.get('input[data-field="nodes[2].id"]').setValue('TOP')
    const renamed = emittedModel(wrapper)
    expect(renamed.nodes[2]!.id).toBe('TOP')

    await wrapper.setProps({ modelValue: renamed })
    await wrapper.get('[data-remove="nodes[2]"]').trigger('click')
    expect(emittedModel(wrapper).nodes).toHaveLength(2)
    for (const table of ['materials', 'sections', 'elements', 'constraints']) {
      expect(wrapper.find(`[data-add="${table}"]`).exists()).toBe(true)
    }

    await wrapper.setProps({ modelValue: frame })
    await wrapper.get('[data-add-load="frame-uniform"]').trigger('click')
    const withLoad = emittedModel(wrapper)
    expect(withLoad.loads).toHaveLength(2)
    await wrapper.setProps({ modelValue: withLoad })
    await wrapper.get('[data-remove="loads[1]"]').trigger('click')
    expect(emittedModel(wrapper).loads).toHaveLength(1)
  })

  it('edits truss temperature, initial strain and self-weight through shared units', async () => {
    const truss: TrussModel2D = {
      analysis: 'truss', units: 'SI', materials: [], sections: [],
      nodes: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 2, y: 0 }],
      elements: [{
        type: 'truss', id: 'AB', nodeI: 'A', nodeJ: 'B',
        properties: { source: 'inline', E: 200e9, A: 0.001, alpha: 12e-6, density: 7850 },
      }],
      constraints: [],
      loads: [
        { type: 'uniform-temperature', id: 'T', elementId: 'AB', deltaT: 50 },
        { type: 'initial-strain', id: 'IS', elementId: 'AB', strain: 0.0006 },
        { type: 'truss-self-weight', id: 'SW', elementId: 'AB', gravity: 9.81 },
      ],
    }
    const wrapper = mount(StructuralModelEditor, {
      props: { modelValue: truss, unitPresetId: 'engineering', issues: [] },
    })
    expect((wrapper.get('input[data-field="loads[0].deltaT"]').element as HTMLInputElement).value).toBe('50')
    expect((wrapper.get('input[data-field="loads[1].strain"]').element as HTMLInputElement).value).toBe('600')
    expect((wrapper.get('input[data-field="loads[2].gravity"]').element as HTMLInputElement).value).toBe('9810')
    expect(wrapper.find('[data-add-load="uniform-temperature"]').exists()).toBe(true)
    expect(wrapper.find('[data-add-load="initial-strain"]').exists()).toBe(true)
    expect(wrapper.find('[data-add-load="truss-self-weight"]').exists()).toBe(true)

    const gravityIssue: StructuralIssue = {
      code: 'P2_NONPOSITIVE_PROPERTY', severity: 'error', message: '自重加速度必须大于零',
      field: 'loads[2].gravity', objectId: 'SW',
    }
    await wrapper.setProps({ issues: [gravityIssue] })
    const gravity = wrapper.get('input[data-field="loads[2].gravity"]')
    expect(gravity.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-issue-field="loads[2].gravity"] a').attributes('href'))
      .toBe(`#${gravity.attributes('id')}`)

    await wrapper.get('input[data-field="loads[1].strain"]').setValue('750')
    expect((emittedModel(wrapper) as TrussModel2D).loads[1]).toMatchObject({ strain: 0.00075 })
  })

  it('edits frame qX/qY and interval in display units while emitting SI', async () => {
    const wrapper = mount(StructuralModelEditor, {
      props: { modelValue: frame, unitPresetId: 'engineering', issues: [] },
    })
    expect((wrapper.get('input[data-field="loads[0].qX"]').element as HTMLInputElement).value).toBe('1')
    expect((wrapper.get('input[data-field="loads[0].qY"]').element as HTMLInputElement).value).toBe('-10')
    expect((wrapper.get('input[data-field="loads[0].interval.a"]').element as HTMLInputElement).value).toBe('1000')
    expect(wrapper.get('input[data-field="loads[0].qY"]').element.parentElement?.textContent).toContain('N/mm')

    await wrapper.get('input[data-field="loads[0].qX"]').setValue('2.5')
    const load = (emittedModel(wrapper) as FrameModel2D).loads[0] as FrameUniformLoad
    expect(load.qX).toBe(2_500)
    expect(load.qY).toBe(-10_000)
  })
})
