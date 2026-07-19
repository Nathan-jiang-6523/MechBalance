import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('echarts/charts', () => ({ LineChart: {}, ScatterChart: {} }))
vi.mock('echarts/components', () => ({
  GridComponent: {}, LegendComponent: {}, MarkLineComponent: {}, TooltipComponent: {},
}))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))
vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
}))

import type { CurveChart } from '../../../src/core/contracts'
import {
  createStructuralQuantity as q,
  type StructuralScreenResult,
} from '../../../src/core/structural/contracts'
import StructuralChart from '../../../src/features/structural/components/StructuralChart.vue'
import StructuralResults from '../../../src/features/structural/components/StructuralResults.vue'
import {
  buildStructuralCharts,
  buildStructuralChartTableRows,
  buildStructuralResultRows,
} from '../../../src/features/structural/components/result-presentation'

const metadata = { requestId: 'r1', calculatedAt: '2026-07-19T00:00:00Z', formulaReferences: [] } as const

function beamResult(): StructuralScreenResult {
  return {
    calculatorId: 'structural-beam', status: 'warning', headline: '梁结果', summary: '已收敛',
    groups: [], charts: [], metadata,
    messages: [{ code: 'P2_WARN', severity: 'warning', message: '平衡残差接近限值', field: 'checks' }],
    balanceChecks: [{ id: 'eq', label: '平衡', residual: 1e-8, unit: 'N', tolerance: 1e-6, passed: true }],
    structural: {
      analysis: 'beam',
      controls: [
        {
          responseId: 'M', kind: 'maximum', value: q(12, 'N*m', '正弯矩'),
          position: q(0.5, 'm', '从左端'), side: 'left', controllingObjectId: 'e1',
        },
        {
          responseId: 'utilization', kind: 'maximum', value: q(0.8, '1', '未确认'),
          position: q(0, 'm', '从左端'),
        },
      ],
      displacements: [{
        nodeId: 'n1', u: q(0, 'm', '+x'), v: q(-0.001, 'm', '+y'), theta: q(-0.002, 'rad', '逆时针'),
      }],
      reactions: [{ nodeId: 'n1', fx: q(0, 'N', '+x'), fy: q(10, 'N', '+y'), mz: q(2, 'N*m', '逆时针') }],
      endForces: [{
        elementId: 'e1', coordinateSystem: 'local',
        nodeI: { fx: q(1, 'N', '局部 +x'), fy: q(-10, 'N', '局部 +y'), mz: q(2, 'N*m', '+z') },
        nodeJ: { fx: q(-1, 'N', '局部 +x'), fy: q(5, 'N', '局部 +y'), mz: q(-2, 'N*m', '+z') },
      }],
      stations: [
        {
          elementId: 'e1', x: q(0.5, 'm', '从 i 端'), side: 'left',
          axialForce: q(1, 'N', '拉为正'), shearForce: q(10, 'N', 'V=dM/dx'),
          bendingMoment: q(12, 'N*m', '正弯矩'), rotation: q(0.02, 'rad', '逆时针'), displacement: q(0.003, 'm', '+y'),
          fiberStresses: [{ y: q(0.1, 'm', '局部 +y'), stress: q(-20e6, 'Pa', '拉为正') }],
        },
        {
          elementId: 'e1', x: q(0.5, 'm', '从 i 端'), side: 'right',
          axialForce: q(1, 'N', '拉为正'), shearForce: q(-5, 'N', 'V=dM/dx'),
          bendingMoment: q(12, 'N*m', '正弯矩'), rotation: q(0.02, 'rad', '逆时针'), displacement: q(0.003, 'm', '+y'),
        },
      ],
    },
  }
}

describe('P2 structural result presentation', () => {
  it('puts control values before lazy node/element details and shows warning, units, IDs, positions and signs', async () => {
    const result = beamResult()
    const wrapper = shallowMount(StructuralResults, {
      props: { result },
      global: { stubs: { StructuralChart: { props: ['chart'], template: '<div data-testid="chart-stub" />' } } },
    })
    for (const detail of wrapper.findAll('details')) {
      ;(detail.element as HTMLDetailsElement).open = true
      await detail.trigger('toggle')
    }
    expect(wrapper.findAll('[data-testid="control-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('P2_WARN')
    expect(wrapper.text()).toContain('平衡残差接近限值')
    expect(wrapper.text()).toContain('e1')
    expect(wrapper.text()).toContain('m · left（左侧）')
    expect(wrapper.text()).toContain('拉为正')
    expect(wrapper.text()).toContain('Pa')
    expect(wrapper.text()).not.toContain('utilization')
    expect(wrapper.html().indexOf('control-table')).toBeLessThan(wrapper.html().indexOf('displacement-table'))
    expect(wrapper.html().indexOf('displacement-table')).toBeLessThan(wrapper.html().indexOf('element-table'))
    expect(wrapper.findAll('[data-testid="chart-stub"]')).toHaveLength(5)
  })

  it('builds beam N/V/M/theta/v curves and preserves left/right jump order', () => {
    const charts = buildStructuralCharts(beamResult())
    expect(charts.map(({ id }) => id)).toEqual([
      'structural-N', 'structural-V', 'structural-M', 'structural-theta', 'structural-v',
    ])
    expect(charts[1]!.series[0]!.points).toEqual([
      { x: 0.5, y: 10, side: 'left' }, { x: 0.5, y: -5, side: 'right' },
    ])
  })

  it('atomically converts result tables and chart axes through the shared engineering preset', () => {
    const result = beamResult()
    const rows = buildStructuralResultRows(result, 'engineering')
    expect(rows.controls[0]).toMatchObject({ value: 12_000, unit: 'N·mm', position: { value: 500, unit: 'mm' } })
    expect(rows.displacements.find(({ label }) => label === '节点位移 v')).toMatchObject({ value: -1, unit: 'mm' })
    expect(rows.elements.find(({ label }) => label.startsWith('纤维应力'))).toMatchObject({ value: -20, unit: 'MPa' })
    const charts = buildStructuralCharts(result, 'engineering')
    expect(charts[0]?.xUnit).toBe('mm')
    const momentSeries = charts.find(({ id }) => id === 'structural-M')?.series[0]
    expect(momentSeries?.unit).toBe('N·mm')
    expect(momentSeries?.points[0]).toMatchObject({ x: 500, y: 12_000 })
  })

  it('shows truss tension/compression state and provides axial/stress distributions', async () => {
    const result: StructuralScreenResult = {
      calculatorId: 'truss', status: 'success', headline: '桁架', groups: [], charts: [], messages: [], balanceChecks: [], metadata,
      structural: {
        analysis: 'truss', controls: [], displacements: [], reactions: [],
        elements: [{
          elementId: 'T1', axialForce: q(-100, 'N', '拉为正'), stress: q(-1e6, 'Pa', '拉为正'), state: 'compression',
        }],
      },
    }
    expect(buildStructuralResultRows(result).elements.every(({ state }) => state === 'compression')).toBe(true)
    expect(buildStructuralCharts(result).map(({ id }) => id)).toEqual(['truss-axial', 'truss-stress'])
    const wrapper = shallowMount(StructuralResults, {
      props: { result }, global: { stubs: { StructuralChart: true } },
    })
    const elementDetail = wrapper.get('[data-detail="elements"]')
    ;(elementDetail.element as HTMLDetailsElement).open = true
    await elementDetail.trigger('toggle')
    expect(wrapper.text()).toContain('压')
    expect(wrapper.text()).toContain('T1')
  })

  it('builds frame N/V/M and influence curves, but never invents a moving-load envelope', () => {
    const beam = beamResult()
    if (beam.status === 'error' || beam.structural.analysis !== 'beam') throw new Error('beam expected')
    const frame: StructuralScreenResult = {
      ...beam, calculatorId: 'frame', status: 'success', messages: [],
      structural: { ...beam.structural, analysis: 'frame' },
    }
    expect(buildStructuralCharts(frame).map(({ id }) => id)).toEqual(['structural-N', 'structural-V', 'structural-M'])

    const influence: StructuralScreenResult = {
      calculatorId: 'influence', status: 'success', headline: '影响线', groups: [], charts: [], messages: [], balanceChecks: [], metadata,
      structural: {
        analysis: 'influence-line', responseId: 'V@5', controls: [], ordinates: [
          { position: q(5, 'm', '从左端'), ordinate: q(0.5, '1', '向下单位力'), side: 'left' },
          { position: q(5, 'm', '从左端'), ordinate: q(-0.5, '1', '向下单位力'), side: 'right' },
        ],
      },
    }
    expect(buildStructuralCharts(influence)[0]!.series[0]!.points.map(({ side }) => side)).toEqual(['left', 'right'])

    const fakeEnvelope: CurveChart = { id: 'fake', title: '未确认全包络', xLabel: 'x', xUnit: 'm', series: [] }
    const moving: StructuralScreenResult = {
      calculatorId: 'moving', status: 'success', headline: '移动载荷', groups: [], charts: [fakeEnvelope], messages: [], balanceChecks: [], metadata,
      structural: {
        analysis: 'moving-load', responseId: 'M', controls: [{
          responseId: 'M', kind: 'maximum', value: q(10, 'N*m', '正弯矩'), position: q(2, 'm', '轴组位置'), controllingAxleId: 'A1',
        }], axlePositions: [{ axleId: 'A1', position: q(2, 'm', '桥面位置') }],
      },
    }
    expect(buildStructuralCharts(moving)).toEqual([])
    const movingWrapper = shallowMount(StructuralResults, { props: { result: moving } })
    expect(movingWrapper.text()).toContain('控制轴 A1')
    expect(movingWrapper.text()).not.toContain('未确认全包络')
  })
})

describe('P2 StructuralChart', () => {
  const chart: CurveChart = {
    id: 'jump', title: '剪力跳变', xLabel: 'x', xUnit: 'm', series: [{
      id: 'V', name: 'V', kind: 'line', unit: 'N', points: [
        { x: 1, y: 5, side: 'left' }, { x: 1, y: -3, side: 'right' }, { x: 2, y: 0 },
      ],
    }],
  }

  it('keeps input order and exposes text signs beside colors', () => {
    expect(buildStructuralChartTableRows(chart).map(({ y, sign, side }) => ({ y, sign, side }))).toEqual([
      { y: 5, sign: '正', side: 'left' }, { y: -3, sign: '负', side: 'right' }, { y: 0, sign: '零', side: undefined },
    ])
    const wrapper = shallowMount(StructuralChart, { props: { chart } })
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.text()).toContain('left（左侧）')
    expect(wrapper.text()).toContain('right（右侧）')
    expect(wrapper.text()).toContain('正')
    expect(wrapper.text()).toContain('负')
    expect(wrapper.text()).toContain('零')
  })

  it('limits very large numeric tables while retaining endpoints and extrema', () => {
    const large: CurveChart = {
      id: 'large', title: 'large', xLabel: 'x', xUnit: 'm', series: [{
        id: 's', name: 's', kind: 'line', unit: 'N',
        points: Array.from({ length: 700 }, (_, index) => ({ x: index, y: index === 350 ? -999 : index })),
      }],
    }
    const rows = buildStructuralChartTableRows(large, 10)
    expect(rows).toHaveLength(10)
    expect(rows.some(({ x }) => x === 0)).toBe(true)
    expect(rows.some(({ x }) => x === 699)).toBe(true)
    expect(rows.some(({ y }) => y === -999)).toBe(true)
  })
})
