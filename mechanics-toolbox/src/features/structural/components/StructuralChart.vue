<script setup lang="ts">
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CurveChart } from '../../../core/contracts'
import { formatChartValue } from '../../../core/numeric'
import { buildStructuralChartTableRows, pointSign, sideLabel } from './result-presentation'

use([LineChart, ScatterChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{ chart: CurveChart }>()
const chartElement = ref<HTMLDivElement | null>(null)
const totalTableRows = computed(() => props.chart.series.reduce((sum, series) => sum + series.points.length, 0))
const tableRows = computed(() => buildStructuralChartTableRows(props.chart, 240))
let instance: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const SIGN_COLORS = { '正': '#126a73', '负': '#b5413c', '零': '#667780' } as const

function structuralChartOption(chart: CurveChart): EChartsCoreOption {
  return {
    animation: false,
    grid: { left: 72, right: 24, top: chart.series.length > 1 ? 54 : 30, bottom: 54 },
    legend: { show: chart.series.length > 1, top: 4 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value: unknown) => typeof value === 'number' ? formatChartValue(value) : String(value),
    },
    xAxis: {
      type: 'value', name: `${chart.xLabel} / ${chart.xUnit}`, nameLocation: 'middle', nameGap: 34,
      axisLabel: { formatter: (value: number) => formatChartValue(value) },
    },
    yAxis: {
      type: 'value', name: chart.series.map(({ unit }) => unit).filter((unit, index, all) => all.indexOf(unit) === index).join(' / '),
      nameLocation: 'middle', nameGap: 54,
      axisLabel: { formatter: (value: number) => formatChartValue(value) },
      splitLine: { lineStyle: { color: '#e8edef' } },
    },
    series: chart.series.map((series) => ({
      id: series.id,
      name: series.name,
      type: series.kind === 'scatter' ? 'scatter' : 'line',
      step: series.kind === 'step' ? 'end' : false,
      smooth: false,
      connectNulls: false,
      sampling: 'none',
      showSymbol: true,
      symbolSize: 6,
      data: series.points.map((point) => ({
        value: [point.x, point.y],
        itemStyle: { color: SIGN_COLORS[pointSign(point.y)] },
      })),
      lineStyle: { width: 2, color: '#53636e' },
      markLine: {
        silent: true,
        symbol: 'none',
        label: { show: false },
        lineStyle: { color: '#8d999f', type: 'dashed', width: 1 },
        data: [{ yAxis: 0 }],
      },
    })),
  }
}

function renderChart(): void {
  if (!chartElement.value) return
  instance ??= init(chartElement.value, undefined, { renderer: 'canvas' })
  instance.setOption(structuralChartOption(props.chart), { notMerge: true })
}

onMounted(() => {
  renderChart()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => instance?.resize())
    if (chartElement.value) resizeObserver.observe(chartElement.value)
  }
})

watch(() => props.chart, () => void nextTick(renderChart), { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  instance?.dispose()
  instance = null
})
</script>

<template>
  <section class="structural-chart" :aria-labelledby="`chart-${chart.id}`">
    <h4 :id="`chart-${chart.id}`">{{ chart.title }}</h4>
    <div
      ref="chartElement"
      class="chart-canvas"
      role="img"
      :aria-label="`${chart.title}曲线；正值青色点，负值红色点，零值灰色点`"
    />
    <p class="sign-legend"><span data-sign="positive">+正</span><span data-sign="negative">−负</span><span data-sign="zero">0 零</span></p>
    <p v-if="tableRows.length < totalTableRows" class="table-limit-note">
      数值表显示 {{ tableRows.length }} / {{ totalTableRows }} 个代表点；曲线仍使用全部计算点。
    </p>
    <div class="chart-table-wrap">
      <table data-testid="structural-chart-table">
        <thead><tr><th>系列</th><th>x / {{ chart.xUnit }}</th><th>侧别</th><th>数值</th><th>正负</th></tr></thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.key" :data-sign="row.sign">
            <td>{{ row.seriesName }}</td>
            <td>{{ formatChartValue(row.x) }}</td>
            <td>{{ sideLabel(row.side) }}</td>
            <td>{{ formatChartValue(row.y) }} {{ row.unit }}</td>
            <td>{{ row.sign }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.structural-chart { min-width: 0; border: 1px solid var(--color-line); border-radius: 10px; background: #fff; overflow: hidden; }
.structural-chart h4 { margin: 0; padding: 12px 14px 0; font-size: 14px; }
.chart-canvas { width: 100%; height: 300px; }
.sign-legend { display: flex; gap: 14px; margin: -4px 14px 10px; font-size: 12px; font-weight: 800; }
.table-limit-note { margin: 0 14px 10px; color: var(--color-muted); font-size: 12px; }
[data-sign="positive"] { color: #126a73; }
[data-sign="negative"] { color: #b5413c; }
[data-sign="zero"] { color: #667780; }
.chart-table-wrap { max-height: 230px; overflow: auto; border-top: 1px solid var(--color-line); }
table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 12px; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--color-line); text-align: left; white-space: nowrap; }
th { position: sticky; top: 0; background: #f5f8f9; color: #53636e; }
@media (max-width: 580px) { .chart-canvas { height: 260px; } }
</style>
