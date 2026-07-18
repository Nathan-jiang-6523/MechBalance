import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  findBeamExtrema,
  sampleBeamSolution,
  solveBeam,
  type BeamModel,
  type BeamSamplePoint,
  type BeamSolution,
} from '../../../src/core/beam'
import BeamResults from '../../../src/features/beam/results/BeamResults.vue'
import { buildBeamChartData } from '../../../src/features/beam/results/presentation'

function sample(overrides: Partial<BeamSamplePoint>): BeamSamplePoint {
  return {
    xM: 0,
    side: 'right',
    shearN: 0,
    momentNm: 0,
    rotationRad: 0,
    deflectionM: 0,
    reasons: ['base'],
    ...overrides,
  }
}

describe('梁曲线数据', () => {
  it('同 x 的 left/right 剪力点保持相邻，形成竖直跳线', () => {
    const samples = [
      sample({ xM: 0.5, side: 'right', shearN: -4_000 }),
      sample({ xM: 0, side: 'right', shearN: 6_000 }),
      sample({ xM: 0.5, side: 'left', shearN: 6_000 }),
      sample({ xM: 1, side: 'left', shearN: -4_000 }),
    ]

    expect(buildBeamChartData(samples, 'shearN')).toEqual([
      [0, 6_000],
      [500, 6_000],
      [500, -4_000],
      [1_000, -4_000],
    ])
  })

  it('点矩位置的弯矩左右点保持相邻并换算为 N·mm', () => {
    const samples = [
      sample({ xM: 0.25, side: 'left', momentNm: 5 }),
      sample({ xM: 0.25, side: 'right', momentNm: -2 }),
    ]
    expect(buildBeamChartData(samples, 'momentNm')).toEqual([
      [250, 5_000],
      [250, -2_000],
    ])
  })
})

const model: BeamModel = {
  lengthM: 1,
  elasticModulusPa: 200e9,
  secondMomentM4: 8e-6,
  support: 'cantileverLeft',
  loads: [{ type: 'pointForce', positionM: 1, forceN: -1_000 }],
}

function solution(): BeamSolution {
  const result = solveBeam(model)
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('; '))
  return result.value
}

describe('梁图槽切换', () => {
  it('默认剪力/弯矩，可分别切换到转角/挠度', async () => {
    const solved = solution()
    const extrema = findBeamExtrema(solved)
    const wrapper = shallowMount(BeamResults, {
      props: {
        solution: solved,
        extrema,
        samples: sampleBeamSolution(solved, extrema),
        spanLengthM: 1,
        sectionHeightM: 0.05,
      },
      global: {
        stubs: {
          BeamChart: {
            props: ['field'],
            template: '<div class="beam-chart-stub" :data-field="field" />',
          },
        },
      },
    })

    let charts = wrapper.findAll('.beam-chart-stub')
    expect(charts.map((chart) => chart.attributes('data-field'))).toEqual(['shearN', 'momentNm'])

    await wrapper.find('[data-testid="first-chart-select"]').setValue('rotationRad')
    await wrapper.find('[data-testid="second-chart-select"]').setValue('deflectionM')
    charts = wrapper.findAll('.beam-chart-stub')
    expect(charts.map((chart) => chart.attributes('data-field'))).toEqual([
      'rotationRad',
      'deflectionM',
    ])
  })
})
