<script setup lang="ts">
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components'
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { BeamExtrema, BeamSamplePoint } from '../../../core/beam'
import { formatChartValue } from '../../../core/numeric'
import {
  BEAM_FIELD_PRESENTATION,
  buildBeamChartData,
  convertExtremum,
} from './presentation'
import type { BeamChartField } from './types'

use([
  LineChart,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  CanvasRenderer,
])

const props = defineProps<{
  field: BeamChartField
  samples: readonly BeamSamplePoint[]
  extrema: BeamExtrema
}>()

const chartElement = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const presentation = computed(() => BEAM_FIELD_PRESENTATION[props.field])
const isDeformation = computed(
  () => props.field === 'rotationRad' || props.field === 'deflectionM',
)

function chartOption(): EChartsCoreOption {
  const fieldExtrema = props.extrema[props.field]
  const minimum = convertExtremum(fieldExtrema.minimum, props.field)
  const maximum = convertExtremum(fieldExtrema.maximum, props.field)
  return {
    animation: false,
    grid: { left: 68, right: 24, top: 36, bottom: 52, containLabel: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value: unknown) =>
        typeof value === 'number' ? `${formatChartValue(value)} ${presentation.value.unit}` : String(value),
    },
    xAxis: {
      type: 'value',
      name: 'x / mm',
      nameLocation: 'middle',
      nameGap: 32,
      axisLine: { onZero: false },
      axisLabel: { formatter: (value: number) => formatChartValue(value) },
    },
    yAxis: {
      type: 'value',
      name: `${presentation.value.shortLabel} / ${presentation.value.unit}`,
      nameLocation: 'middle',
      nameGap: 50,
      axisLabel: { formatter: (value: number) => formatChartValue(value) },
      splitLine: { lineStyle: { color: '#e8edef' } },
    },
    series: [
      {
        name: `${presentation.value.label} / ${presentation.value.unit}`,
        type: 'line',
        data: buildBeamChartData(props.samples, props.field),
        smooth: false,
        connectNulls: false,
        showSymbol: false,
        sampling: 'none',
        lineStyle: { width: 2, color: '#126a73' },
        itemStyle: { color: '#126a73' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: '#8d999f', type: 'dashed', width: 1 },
          data: [{ yAxis: 0 }],
        },
        markPoint: {
          symbolSize: 38,
          label: { fontSize: 9, formatter: (parameters: { name?: string }) => parameters.name ?? '' },
          data: [
            { name: 'max', coord: maximum, value: maximum[1] },
            { name: 'min', coord: minimum, value: minimum[1] },
          ],
        },
      },
    ],
  }
}

function renderChart(): void {
  if (!chartElement.value) return
  chart ??= init(chartElement.value, undefined, { renderer: 'canvas' })
  chart.setOption(chartOption(), { notMerge: true })
}

onMounted(() => {
  renderChart()
  resizeObserver = new ResizeObserver(() => chart?.resize())
  if (chartElement.value) resizeObserver.observe(chartElement.value)
})

watch(
  () => [props.field, props.samples, props.extrema],
  () => void nextTick(renderChart),
  { deep: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="chart-shell">
    <div
      ref="chartElement"
      class="chart-canvas"
      role="img"
      :aria-label="`${presentation.label}沿梁长曲线`"
    />
    <p v-if="isDeformation" class="scale-note">变形曲线仅表示数值变化，非真实变形比例。</p>
  </div>
</template>

<style scoped>
.chart-shell {
  min-width: 0;
}

.chart-canvas {
  width: 100%;
  height: 330px;
}

.scale-note {
  margin: -8px 18px 12px;
  color: var(--color-muted);
  font-size: 11px;
  text-align: right;
}

@media (max-width: 580px) {
  .chart-canvas {
    height: 290px;
  }
}
</style>
