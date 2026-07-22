import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MathFormula from '../../../src/components/MathFormula.vue'
import { STRUCTURAL_THEORY_CATALOG } from '../../../src/features/structural/catalog'
import StructuralTheory from '../../../src/features/structural/components/StructuralTheory.vue'
import type {
  StructuralMatrixView,
  StructuralTheoryContent,
} from '../../../src/features/structural/types'

const content: StructuralTheoryContent = {
  title: '测试理论',
  formulas: [{
    id: 'P2-TEST-001',
    label: '测试矩阵关系',
    version: 'P2-TEST-v1',
    latex: String.raw`\boldsymbol{K}\boldsymbol{d}=\boldsymbol{F}`,
  }],
  assumptions: ['二维、小变形、线弹性。'],
  boundaries: ['不含材料非线性。'],
  mixedUnitNotes: ['平移项 N/m；平移—转动项 N；转动项 N·m。'],
}

const matrix: StructuralMatrixView = {
  id: 'global-k',
  title: '整体刚度矩阵 K',
  rowLabels: ['u1', 'θ1'],
  columnLabels: ['u1', 'θ1'],
  values: [[12, 6], [6, Number.NaN]],
}

describe('P2 StructuralTheory', () => {
  it('stays collapsed by default while rendering offline KaTeX content', () => {
    const wrapper = mount(StructuralTheory, { props: { content } })
    const details = wrapper.get('[data-testid="structural-theory-details"]')
    expect(details.attributes('open')).toBeUndefined()
    expect(wrapper.findComponent(MathFormula).exists()).toBe(true)
    expect(wrapper.find('.katex').exists()).toBe(true)
    expect(wrapper.find('math').exists()).toBe(true)
    expect(wrapper.text()).toContain('P2-TEST-001 · P2-TEST-v1')
    expect(wrapper.text()).toContain('二维、小变形、线弹性。')
    expect(wrapper.text()).toContain('不含材料非线性。')
  })

  it('shows matrix DOFs, mixed-unit explanation, and suppresses nonfinite text', () => {
    const wrapper = mount(StructuralTheory, { props: { content, matrices: [matrix] } })
    expect(wrapper.get('table[data-matrix-id="global-k"]').attributes('aria-label')).toBe('整体刚度矩阵 K')
    expect(wrapper.text()).toContain('平移项 N/m；平移—转动项 N；转动项 N·m。')
    expect(wrapper.text()).toContain('u1')
    expect(wrapper.text()).toContain('θ1')
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).not.toContain('NaN')
    expect(wrapper.text()).not.toContain('Infinity')
  })

  it('renders every formula used by each available structural module with its frozen version', () => {
    const expected = {
      beam: [
        ['P2-EB-001', 'P2-EB6-v1'],
        ['P2-EB-002', 'P2-EB-LOAD-v1'],
        ['P2-DSM-001', 'P2-DSM-v1'],
        ['P2-EB-RECOVERY-001', 'P2-EB-RECOVERY-v1'],
        ['P2-CBEAM-001', 'P2-CBEAM-v1'],
      ],
      'influence-line': [['P2-IL-001', 'P2-IL-v1']],
      'moving-load': [
        ['P2-IL-001', 'P2-IL-v1'],
        ['P2-ML-001', 'P2-ML-v1'],
      ],
      truss: [
        ['P2-DSM-001', 'P2-DSM-v1'],
        ['P2-TRUSS-001', 'P2-TRUSS-v1'],
        ['P2-TRUSS-INITIAL-001', 'P2-TRUSS-INITIAL-v1'],
      ],
      frame: [
        ['P2-EB-001', 'P2-EB6-v1'],
        ['P2-DSM-001', 'P2-DSM-v1'],
        ['P2-FRAME-001', 'P2-FRAME-v1'],
        ['P2-FRAME-INITIAL-001', 'P2-FRAME-INITIAL-v1'],
      ],
    } as const

    for (const [moduleId, formulaEntries] of Object.entries(expected)) {
      const moduleContent = STRUCTURAL_THEORY_CATALOG[moduleId as keyof typeof expected]
      expect(moduleContent).toBeDefined()
      expect(moduleContent!.formulas.map(({ id, version }) => [id, version])).toEqual(formulaEntries)

      const wrapper = mount(StructuralTheory, { props: { content: moduleContent! } })
      expect(wrapper.findAll('.formula-card')).toHaveLength(formulaEntries.length)
      for (const [id, version] of formulaEntries) {
        expect(wrapper.get(`[data-formula-id="${id}"]`).text()).toContain(`${id} · ${version}`)
      }
    }
  })
})
