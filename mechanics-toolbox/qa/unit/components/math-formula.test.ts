import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MathFormula from '../../../src/components/MathFormula.vue'

describe('MathFormula', () => {
  it('renders accessible KaTeX HTML and MathML offline', () => {
    const wrapper = mount(MathFormula, {
      props: { formula: String.raw`EI\,\frac{\mathrm d^4v}{\mathrm dx^4}=w(x)` },
    })

    expect(wrapper.find('.katex').exists()).toBe(true)
    expect(wrapper.find('math').exists()).toBe(true)
    expect(wrapper.text()).toContain('EI')
    expect(wrapper.text()).toContain('w(x)')
  })

  it('shows invalid input as a KaTeX error instead of throwing', () => {
    const wrapper = mount(MathFormula, { props: { formula: String.raw`\notACommand{` } })

    expect(wrapper.find('.katex-error').exists()).toBe(true)
  })
})
