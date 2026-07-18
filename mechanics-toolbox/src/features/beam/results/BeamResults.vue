<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BeamExtrema, BeamSamplePoint, BeamSolution } from '../../../core/beam'
import { formatEngineeringValue, formatExtremaPosition } from '../../../core/numeric'
import { convertFromSI } from '../../../core/units'
import MathFormula from '../../../components/MathFormula.vue'
import BeamChart from './BeamChart.vue'
import BeamWarnings from './BeamWarnings.vue'
import {
  BEAM_CHART_FIELDS,
  buildExtremaRows,
  buildReactionRows,
  maximumAbsoluteDeflectionM,
} from './presentation'
import type { BeamChartField, BeamStressSummary } from './types'

const props = withDefaults(
  defineProps<{
    solution: BeamSolution
    extrema: BeamExtrema
    samples: readonly BeamSamplePoint[]
    spanLengthM: number
    sectionHeightM: number
    warnings?: readonly string[]
    stressSummary?: BeamStressSummary
  }>(),
  { warnings: () => [] },
)

const firstChartField = ref<BeamChartField>('shearN')
const secondChartField = ref<BeamChartField>('momentNm')

const BEAM_FORMULAS = [
  String.raw`EI\,\frac{\mathrm d^4 v}{\mathrm d x^4}=w(x)`,
  String.raw`\theta=\frac{\mathrm d v}{\mathrm d x},\qquad EI\,\frac{\mathrm d^2 v}{\mathrm d x^2}=M`,
  String.raw`\frac{\mathrm dM}{\mathrm dx}=V,\qquad \frac{\mathrm dV}{\mathrm dx}=w`,
  String.raw`\Delta V=F,\qquad \Delta M=-C`,
  String.raw`\sigma_x(x,y)=-\frac{M(x)y}{I_x},\qquad \tau_{\max,\mathrm{rect}}=\frac{3V}{2A}`,
]

const reactionRows = computed(() => buildReactionRows(props.solution.reactions))
const extremaRows = computed(() => buildExtremaRows(props.extrema))
const maximumDeflectionM = computed(() => maximumAbsoluteDeflectionM(props.extrema))

const stressRows = computed(() => {
  if (!props.stressSummary) return []
  return [
    {
      label: '控制弯矩位置',
      value: formatExtremaPosition(
        convertFromSI(props.stressSummary.controllingMomentPositionM, 'length', 'mm'),
      ),
      unit: 'mm',
    },
    {
      label: '上缘弯曲正应力',
      value: formatEngineeringValue(
        convertFromSI(props.stressSummary.topBendingStressPa, 'stress', 'MPa'),
      ),
      unit: 'MPa',
    },
    {
      label: '下缘弯曲正应力',
      value: formatEngineeringValue(
        convertFromSI(props.stressSummary.bottomBendingStressPa, 'stress', 'MPa'),
      ),
      unit: 'MPa',
    },
    {
      label: '最大弯曲正应力绝对值',
      value: formatEngineeringValue(
        convertFromSI(props.stressSummary.maximumAbsoluteBendingStressPa, 'stress', 'MPa'),
      ),
      unit: 'MPa',
    },
  ]
})
</script>

<template>
  <section class="beam-results" aria-labelledby="beam-results-title">
    <div class="results-heading">
      <div>
        <p>梁综合计算 · 结果</p>
        <h2 id="beam-results-title">反力、内力、变形与应力</h2>
      </div>
      <span class="result-status">已计算</span>
    </div>

    <section class="result-section reaction-section" aria-labelledby="reaction-title">
      <h3 id="reaction-title">反力摘要</h3>
      <div class="summary-grid reaction-grid">
        <article v-for="row in reactionRows" :key="row.key" data-testid="reaction-row">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }} <small>{{ row.unit }}</small></strong>
        </article>
      </div>
      <div class="balance-residual">
        <span>平衡残差</span>
        <span>ΣFy：{{ formatEngineeringValue(solution.balanceResidual.forceN) }} N</span>
        <span>
          ΣM左：{{ formatEngineeringValue(convertFromSI(solution.balanceResidual.momentAboutLeftNm, 'moment', 'N_mm')) }}
          N·mm
        </span>
      </div>
    </section>

    <BeamWarnings
      :span-length-m="spanLengthM"
      :section-height-m="sectionHeightM"
      :maximum-deflection-m="maximumDeflectionM"
      :warnings="warnings"
    />

    <section class="result-section" aria-labelledby="extrema-title">
      <h3 id="extrema-title">内力与变形极值</h3>
      <div class="summary-grid extrema-grid">
        <article v-for="row in extremaRows" :key="row.key" data-testid="extrema-row">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }} <small>{{ row.unit }}</small></strong>
          <p>{{ row.position }} · {{ row.side }}</p>
        </article>
      </div>
    </section>

    <section v-if="stressSummary" class="result-section" aria-labelledby="stress-title">
      <h3 id="stress-title">应力摘要</h3>
      <div class="summary-grid stress-grid">
        <article v-for="row in stressRows" :key="row.label" data-testid="stress-row">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }} <small>{{ row.unit }}</small></strong>
        </article>
        <article data-testid="shear-stress-row">
          <span>最大梁剪应力</span>
          <strong v-if="stressSummary.shear.supported">
            {{ formatEngineeringValue(convertFromSI(stressSummary.shear.maximumShearStressPa, 'stress', 'MPa')) }}
            <small>MPa</small>
          </strong>
          <p v-else>{{ stressSummary.shear.message || '当前截面暂不支持剪应力恢复' }}</p>
        </article>
      </div>
    </section>

    <section class="result-section chart-section" aria-labelledby="chart-title">
      <div class="section-heading-row">
        <div>
          <h3 id="chart-title">沿梁长曲线</h3>
          <p>同一 x 的 left/right 点直接连接，保留内力跳变。</p>
        </div>
      </div>
      <div class="chart-grid">
        <article class="chart-card">
          <label>
            图槽 1
            <select v-model="firstChartField" data-testid="first-chart-select">
              <option v-for="option in BEAM_CHART_FIELDS" :key="option.field" :value="option.field">
                {{ option.label }} {{ option.shortLabel }}
              </option>
            </select>
          </label>
          <BeamChart :field="firstChartField" :samples="samples" :extrema="extrema" />
        </article>
        <article class="chart-card">
          <label>
            图槽 2
            <select v-model="secondChartField" data-testid="second-chart-select">
              <option v-for="option in BEAM_CHART_FIELDS" :key="option.field" :value="option.field">
                {{ option.label }} {{ option.shortLabel }}
              </option>
            </select>
          </label>
          <BeamChart :field="secondChartField" :samples="samples" :extrema="extrema" />
        </article>
      </div>
    </section>

    <details class="assumption-panel" open>
      <summary>模型假设与公式版本</summary>
      <div class="formula-list">
        <MathFormula v-for="formula in BEAM_FORMULAS" :key="formula" :formula="formula" />
      </div>
      <ul>
        <li>Euler–Bernoulli 梁，小变形、线弹性。</li>
        <li>梁长范围内 E、I 为常数，不计剪切变形。</li>
        <li>坐标与正负号遵循项目已确认约定。</li>
        <li>公式版本：P1-BEAM-EB4-v1。</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.beam-results {
  display: grid;
  gap: 18px;
  padding: clamp(22px, 3vw, 32px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-large);
  background: var(--color-panel);
  box-shadow: var(--shadow-panel);
}

.results-heading,
.section-heading-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.results-heading p {
  margin: 0 0 6px;
  color: var(--color-brand);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.results-heading h2 {
  margin: 0;
  font-size: 22px;
}

.result-status {
  flex: 0 0 auto;
  padding: 6px 9px;
  border-radius: 999px;
  color: var(--color-success);
  background: #e7f5ec;
  font-size: 11px;
  font-weight: 800;
}

.result-section {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: #fbfcfc;
}

.reaction-section {
  border-top: 3px solid var(--color-brand);
}

.result-section h3 {
  margin: 0 0 13px;
  font-size: 15px;
}

.summary-grid {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 9px;
  background: var(--color-line);
}

.reaction-grid,
.stress-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.extrema-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.summary-grid article {
  min-width: 0;
  padding: 12px;
  background: #fff;
}

.summary-grid article > span {
  display: block;
  margin-bottom: 5px;
  color: var(--color-muted);
  font-size: 10px;
}

.summary-grid strong {
  overflow-wrap: anywhere;
  font-size: 13px;
}

.summary-grid small {
  color: var(--color-muted);
  font-size: 10px;
}

.summary-grid p {
  margin: 5px 0 0;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.45;
}

.balance-residual {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 11px;
  color: var(--color-muted);
  font-size: 11px;
}

.balance-residual span:first-child {
  color: #53636e;
  font-weight: 800;
}

.chart-section {
  padding: 18px 12px 10px;
}

.section-heading-row {
  padding: 0 6px;
}

.section-heading-row h3 {
  margin-bottom: 4px;
}

.section-heading-row p {
  margin: 0;
  color: var(--color-muted);
  font-size: 11px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.chart-card {
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.chart-card label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 11px 13px 0;
  color: #53636e;
  font-size: 11px;
  font-weight: 800;
}

.chart-card select {
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid #cad5da;
  border-radius: 7px;
  color: #33444d;
  background: #fff;
}

.assumption-panel {
  border-left: 3px solid var(--color-brand);
  color: #53636e;
  background: #f3f8f8;
}

.assumption-panel summary {
  padding: 12px 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.assumption-panel ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0 18px 14px 32px;
  font-size: 11px;
  line-height: 1.5;
}

.formula-list {
  display: grid;
  gap: 4px;
  padding: 0 14px 8px;
}

@media (max-width: 1050px) {
  .reaction-grid,
  .stress-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 580px) {
  .results-heading {
    flex-direction: column;
  }

  .reaction-grid,
  .stress-grid,
  .extrema-grid {
    grid-template-columns: 1fr;
  }

  .result-section {
    padding: 14px;
  }
}
</style>
