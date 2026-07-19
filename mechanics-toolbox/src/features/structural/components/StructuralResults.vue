<script setup lang="ts">
import { computed } from 'vue'
import { formatSignificant } from '../../../core/numeric'
import type { UnitPresetId } from '../../../core/units'
import type { StructuralScreenResult } from '../../../core/structural/contracts'
import StructuralChart from './StructuralChart.vue'
import { buildStructuralCharts, buildStructuralResultRows, sideLabel, type StructuralDisplayRow } from './result-presentation'

const props = withDefaults(defineProps<{ result: StructuralScreenResult; unitPresetId?: UnitPresetId }>(), {
  unitPresetId: 'si',
})
const rows = computed(() => buildStructuralResultRows(props.result, props.unitPresetId))
const charts = computed(() => buildStructuralCharts(props.result, props.unitPresetId))
const stateLabel = (state?: StructuralDisplayRow['state']): string => state === 'tension'
  ? '拉' : state === 'compression' ? '压' : state === 'zero' ? '零力' : '—'
</script>

<template>
  <section class="structural-results" aria-labelledby="structural-results-title">
    <header class="results-header">
      <div><p>结构力学 · 结果</p><h2 id="structural-results-title">{{ result.headline }}</h2></div>
      <span class="status" :data-status="result.status">{{ result.status }}</span>
    </header>
    <p v-if="result.summary" class="summary">{{ result.summary }}</p>

    <section v-if="result.messages.length" class="messages" aria-label="警告与消息">
      <article v-for="message in result.messages" :key="`${message.code}-${message.field ?? ''}`" :data-severity="message.severity">
        <strong>{{ message.code }}</strong><span>{{ message.message }}</span><small v-if="message.field">{{ message.field }}</small>
      </article>
    </section>

    <template v-if="result.status !== 'error'">
      <section class="result-block controls" aria-labelledby="control-results-title">
        <h3 id="control-results-title">控制值</h3>
        <p v-if="rows.controls.length === 0" class="empty">本结果未返回控制值。</p>
        <div v-else class="table-wrap"><table data-testid="control-table">
          <thead><tr><th>响应</th><th>对象 ID</th><th>数值</th><th>位置</th><th>正值含义</th><th>说明</th></tr></thead>
          <tbody><tr v-for="row in rows.controls" :key="row.key" data-testid="control-row">
            <td>{{ row.label }}</td><td>{{ row.objectId ?? '—' }}</td><td>{{ formatSignificant(row.value) }} {{ row.unit }}</td>
            <td>{{ row.position ? `${formatSignificant(row.position.value)} ${row.position.unit} · ${sideLabel(row.position.side)}` : '—' }}</td>
            <td>{{ row.positive }}</td><td>{{ row.note ?? '—' }}</td>
          </tr></tbody>
        </table></div>
      </section>

      <section v-if="rows.displacements.length" class="result-block" aria-labelledby="node-displacements-title">
        <h3 id="node-displacements-title">节点位移</h3>
        <div class="table-wrap"><table data-testid="displacement-table">
          <thead><tr><th>量</th><th>节点 ID</th><th>数值</th><th>方向/正值含义</th></tr></thead>
          <tbody><tr v-for="row in rows.displacements" :key="row.key"><td>{{ row.label }}</td><td>{{ row.objectId }}</td><td>{{ formatSignificant(row.value) }} {{ row.unit }}</td><td>{{ row.positive }}</td></tr></tbody>
        </table></div>
      </section>

      <section v-if="rows.reactions.length" class="result-block" aria-labelledby="node-reactions-title">
        <h3 id="node-reactions-title">节点反力</h3>
        <div class="table-wrap"><table data-testid="reaction-table">
          <thead><tr><th>量</th><th>节点 ID</th><th>数值</th><th>方向/正值含义</th></tr></thead>
          <tbody><tr v-for="row in rows.reactions" :key="row.key"><td>{{ row.label }}</td><td>{{ row.objectId }}</td><td>{{ formatSignificant(row.value) }} {{ row.unit }}</td><td>{{ row.positive }}</td></tr></tbody>
        </table></div>
      </section>

      <section v-if="rows.elements.length" class="result-block" aria-labelledby="element-results-title">
        <h3 id="element-results-title">单元/杆件明细</h3>
        <div class="table-wrap"><table data-testid="element-table">
          <thead><tr><th>量</th><th>对象 ID</th><th>数值</th><th>位置</th><th>拉压</th><th>方向/正负含义</th></tr></thead>
          <tbody><tr v-for="row in rows.elements" :key="row.key">
            <td>{{ row.label }}</td><td>{{ row.objectId ?? '—' }}</td><td>{{ formatSignificant(row.value) }} {{ row.unit }}</td>
            <td>{{ row.position ? `${formatSignificant(row.position.value)} ${row.position.unit} · ${sideLabel(row.position.side)}` : '—' }}</td>
            <td>{{ stateLabel(row.state) }}</td><td>{{ row.positive }}<span v-if="row.note"> · {{ row.note }}</span></td>
          </tr></tbody>
        </table></div>
      </section>

      <section v-if="result.balanceChecks.length" class="result-block" aria-labelledby="balance-title">
        <h3 id="balance-title">平衡/能量检查</h3>
        <div class="table-wrap"><table data-testid="balance-table">
          <thead><tr><th>检查</th><th>残差</th><th>容差</th><th>结果</th></tr></thead>
          <tbody><tr v-for="check in result.balanceChecks" :key="check.id"><td>{{ check.label }}</td><td>{{ formatSignificant(check.residual) }} {{ check.unit }}</td><td>{{ formatSignificant(check.tolerance) }} {{ check.unit }}</td><td>{{ check.passed ? '通过' : '未通过' }}</td></tr></tbody>
        </table></div>
      </section>

      <section v-if="charts.length" class="result-block charts" aria-labelledby="structural-charts-title">
        <div class="chart-heading"><h3 id="structural-charts-title">内力、变形与影响线</h3><p>曲线下方数值表保留正负及 left/right 跳变点。</p></div>
        <div class="chart-grid"><StructuralChart v-for="item in charts" :key="item.id" :chart="item" /></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.structural-results { display: grid; gap: 16px; min-width: 0; padding: clamp(18px, 3vw, 30px); border: 1px solid var(--color-line); border-radius: var(--radius-large); background: var(--color-panel); }
.results-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.results-header p { margin: 0 0 5px; color: var(--color-brand); font-size: 11px; font-weight: 800; letter-spacing: .08em; }
.results-header h2 { margin: 0; font-size: 22px; }
.status { padding: 6px 9px; border-radius: 999px; background: #e7f5ec; color: var(--color-success); font-size: 11px; font-weight: 800; }
.status[data-status="warning"] { background: #fff5d8; color: #795700; }.status[data-status="error"] { background: #fdebea; color: #9c2f2b; }
.summary, .empty, .chart-heading p { margin: 0; color: var(--color-muted); font-size: 12px; }
.messages { display: grid; gap: 7px; }.messages article { display: grid; grid-template-columns: auto 1fr auto; gap: 9px; padding: 10px 12px; border-left: 3px solid #667780; background: #f4f7f8; font-size: 12px; }
.messages article[data-severity="warning"] { border-color: #d49a00; background: #fff9e9; }.messages article[data-severity="error"] { border-color: #b5413c; background: #fff1f0; }.messages small { color: var(--color-muted); }
.result-block { min-width: 0; padding: 16px; border: 1px solid var(--color-line); border-radius: 11px; background: #fbfcfc; }.controls { border-top: 3px solid var(--color-brand); }.result-block h3 { margin: 0 0 12px; font-size: 15px; }
.table-wrap { max-width: 100%; overflow: auto; }table { width: 100%; min-width: 690px; border-collapse: collapse; background: #fff; font-size: 12px; }th, td { padding: 9px 10px; border: 1px solid var(--color-line); text-align: left; vertical-align: top; }th { color: #53636e; background: #f3f7f8; white-space: nowrap; }
.chart-heading { margin-bottom: 12px; }.chart-heading h3 { margin-bottom: 4px; }.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 960px) { .chart-grid { grid-template-columns: 1fr; } }@media (max-width: 580px) { .structural-results { padding: 14px; }.results-header { flex-direction: column; }.result-block { padding: 12px; } }
</style>
