import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  findBeamExtrema,
  sampleBeamSolution,
  solveBeam,
  type BeamModel,
  type BeamSolution,
} from '../../../src/core/beam'
import BeamResults from '../../../src/features/beam/results/BeamResults.vue'
import BeamWarnings from '../../../src/features/beam/results/BeamWarnings.vue'
import { buildBeamWarnings } from '../../../src/features/beam/results/presentation'

const model: BeamModel = {
  lengthM: 2,
  elasticModulusPa: 200e9,
  secondMomentM4: 8e-6,
  support: 'simplySupported',
  loads: [{ type: 'pointForce', positionM: 0.8, forceN: -10_000 }],
}

function solution(): BeamSolution {
  const result = solveBeam(model)
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('; '))
  return result.value
}

describe('梁结果摘要', () => {
  it('反力优先显示，四字段各有最大/最小值及 left/right 位置', () => {
    const solved = solution()
    const extrema = findBeamExtrema(solved)
    const wrapper = shallowMount(BeamResults, {
      props: {
        solution: solved,
        extrema,
        samples: sampleBeamSolution(solved, extrema),
        spanLengthM: model.lengthM,
        sectionHeightM: 0.1,
      },
    })

    expect(wrapper.find('h3').text()).toBe('反力摘要')
    expect(wrapper.findAll('[data-testid="reaction-row"]')).toHaveLength(4)
    expect(wrapper.findAll('[data-testid="extrema-row"]')).toHaveLength(8)
    expect(wrapper.text()).toContain('left（左侧）')
    expect(wrapper.text()).toContain('right（右侧）')
    expect(wrapper.text()).toContain('ΣFy')
  })

  it('显示应力摘要和不支持截面的剪应力说明', () => {
    const solved = solution()
    const extrema = findBeamExtrema(solved)
    const wrapper = shallowMount(BeamResults, {
      props: {
        solution: solved,
        extrema,
        samples: sampleBeamSolution(solved, extrema),
        spanLengthM: model.lengthM,
        sectionHeightM: 0.1,
        stressSummary: {
          controllingMomentPositionM: 0.8,
          topBendingStressPa: -120e6,
          bottomBendingStressPa: 120e6,
          maximumAbsoluteBendingStressPa: 120e6,
          shear: {
            supported: false,
            message: '当前截面暂不支持剪应力恢复',
          },
        },
      },
    })

    expect(wrapper.findAll('[data-testid="stress-row"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('控制弯矩位置')
    expect(wrapper.text()).toContain('-120.000')
    expect(wrapper.find('[data-testid="shear-stress-row"]').text()).toContain(
      '当前截面暂不支持剪应力恢复',
    )
  })
})

describe('梁适用性警告', () => {
  it('严格按 L/h < 10 与 |v|max/L > 1% 触发强警告', () => {
    expect(buildBeamWarnings(1, 0.1, 0.01)).toHaveLength(0)

    const warnings = buildBeamWarnings(1, 0.11, 0.010_001)
    expect(warnings.map((item) => item.code)).toEqual(['slenderness', 'large-deflection'])
    expect(warnings.every((item) => item.severity === 'strong')).toBe(true)
  })

  it('有警告时自动展开，无警告时折叠，并合并外部警告', () => {
    const active = shallowMount(BeamWarnings, {
      props: {
        spanLengthM: 1,
        sectionHeightM: 0.2,
        maximumDeflectionM: 0,
        warnings: ['平衡残差接近限值'],
      },
    })
    expect(active.find('details').attributes()).toHaveProperty('open')
    expect(active.text()).toContain('平衡残差接近限值')

    const inactive = shallowMount(BeamWarnings, {
      props: { spanLengthM: 1, sectionHeightM: 0.05, maximumDeflectionM: 0 },
    })
    expect(inactive.find('details').attributes()).not.toHaveProperty('open')
    expect(inactive.text()).toContain('无活动警告')
  })
})
