<script setup lang="ts">
import { computed } from 'vue'
import MathFormula from '../../../components/MathFormula.vue'
import type { ThinCylinderResult } from '../../../core/plate-shell'
import { convertFromSI, getPresetUnit, getUnitDefinition, type UnitPresetId } from '../../../core/units'
import { formatEngineeringValue } from '../../../core/numeric'

const props = defineProps<{
  result: ThinCylinderResult
  unitPreset: UnitPresetId
}>()

const units = computed(() => ({
  stress: getPresetUnit('stress', props.unitPreset),
  line: getPresetUnit('lineLoad', props.unitPreset),
  pressure: getPresetUnit('pressure', props.unitPreset),
}))

function symbol(quantity: 'stress' | 'lineLoad' | 'pressure'): string {
  const unit = quantity === 'lineLoad' ? units.value.line : units.value[quantity]
  return getUnitDefinition(quantity, unit).symbol
}

function stress(value: number): string {
  return formatEngineeringValue(convertFromSI(value, 'stress', units.value.stress))
}

function line(value: number): string {
  return formatEngineeringValue(convertFromSI(value, 'lineLoad', units.value.line))
}

function pressure(value: number): string {
  return formatEngineeringValue(convertFromSI(value, 'pressure', units.value.pressure))
}

const membraneRows = computed(() => [
  ['环向膜内力', 'Nθ', props.result.membraneForces.hoopNPerM],
  ['压力轴向膜内力', 'Nzᵖ', props.result.membraneForces.axialPressureNPerM],
  ['外加轴力膜内力', 'Nzᶠ', props.result.membraneForces.axialForceNPerM],
  ['轴向总膜内力', 'Nz', props.result.membraneForces.axialTotalNPerM],
  ['扭转剪切膜内力', 'Nzθ', props.result.membraneForces.shearNPerM],
] as const)

const stressRows = computed(() => [
  ['环向膜应力', 'σθ', props.result.stresses.hoopPa],
  ['轴向总膜应力', 'σz', props.result.stresses.axialTotalPa],
  ['扭转剪应力', 'τzθ', props.result.stresses.shearPa],
  ['第一面内主应力', 'σ1', props.result.planeStress.sigma1Pa],
  ['第二面内主应力', 'σ2', props.result.planeStress.sigma2Pa],
  ['von Mises 等效应力', 'σVM', props.result.planeStress.vonMisesPa],
  ['Tresca 等效应力', 'σT', props.result.planeStress.trescaPa],
] as const)
</script>

<template>
  <section class="results" aria-labelledby="thin-cylinder-results-title" data-testid="thin-cylinder-results">
    <header>
      <div>
        <p>计算完成</p>
        <h3 id="thin-cylinder-results-title">薄壁圆筒膜结果</h3>
      </div>
      <span :class="result.warnings.length ? 'warning-status' : 'success-status'">
        {{ result.warnings.length ? '结果含警告' : '适用性通过' }}
      </span>
    </header>

    <div v-for="warning in result.warnings" :key="warning.code" class="warning" :class="warning.severity">
      <strong>{{ warning.severity === 'strong-warning' ? '强警告' : '适用性提醒' }}</strong>
      <p>{{ warning.message }}</p>
    </div>

    <div class="summary-grid">
      <article>
        <span>净压差 Δp</span>
        <strong>{{ pressure(result.netPressurePa) }} {{ symbol('pressure') }}</strong>
      </article>
      <article>
        <span>薄壁比 t/rₘ</span>
        <strong data-testid="thin-wall-ratio">{{ formatEngineeringValue(result.applicability.checks[0]?.actual) }}</strong>
      </article>
      <article>
        <span>端面压力传力</span>
        <strong>{{ result.boundary === 'closed' ? '封闭端盖传力' : '开口端不传力' }}</strong>
      </article>
      <article>
        <span>解法性质</span>
        <strong>{{ result.modelStatement }}</strong>
      </article>
    </div>

    <h4>膜内力</h4>
    <div class="result-grid membrane-grid">
      <article v-for="row in membraneRows" :key="row[1]">
        <span>{{ row[0] }} · {{ row[1] }}</span>
        <strong>{{ line(row[2]) }} {{ symbol('lineLoad') }}</strong>
      </article>
    </div>

    <h4>膜应力与强度不变量</h4>
    <div class="result-grid stress-grid">
      <article v-for="row in stressRows" :key="row[1]" :data-testid="`thin-cylinder-${row[1]}`">
        <span>{{ row[0] }} · {{ row[1] }}</span>
        <strong>{{ stress(row[2]) }} {{ symbol('stress') }}</strong>
      </article>
    </div>

    <details open class="formula-panel">
      <summary>公式、方向与适用说明</summary>
      <MathFormula formula="N_\theta=\Delta p r_m,\quad \sigma_\theta=N_\theta/t" />
      <MathFormula :formula="result.boundary === 'closed' ? 'N_z^p=\Delta p r_m/2' : 'N_z^p=0'" />
      <MathFormula formula="N_z^F=F/(2\pi r_m),\quad N_{z\theta}=T/(2\pi r_m^2)" />
      <p>公式 ID：{{ result.formula.id }}；补充：{{ result.supplementalFormulaIds.join('、') }}。</p>
      <p>{{ result.controlLocation }}。拉应力为正；轴力沿 +z 拉为正；正扭矩在 +z 截面产生 +θ 剪应力。</p>
      <p>二维膜模型忽略 σr 对面内状态的影响；不代表三维径向应力点值恒为零。</p>
    </details>
  </section>
</template>

<style scoped>
.results { min-width: 0; padding: 22px; border: 1px solid var(--color-line); border-radius: var(--radius-large); background: var(--color-panel); box-shadow: var(--shadow-panel); }
.results header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.results header p { margin: 0 0 4px; color: var(--color-brand); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.results h3, .results h4 { margin: 0; }
.results h4 { margin-top: 20px; font-size: 13px; }
.success-status, .warning-status { padding: 7px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.success-status { color: #25613d; background: #e7f5ec; }
.warning-status { color: #7c511a; background: #fff1d8; }
.warning { margin-top: 14px; padding: 12px 14px; border-left: 4px solid #d08a25; background: #fff8e9; }
.warning.strong-warning { border-left-color: #b64835; color: #7f312b; background: #fff0ed; }
.warning p { margin: 4px 0 0; font-size: 12px; line-height: 1.55; }
.summary-grid, .result-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-top: 15px; overflow: hidden; border: 1px solid var(--color-line); border-radius: 9px; background: var(--color-line); }
.result-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.summary-grid article, .result-grid article { min-width: 0; padding: 13px; background: #fff; }
.summary-grid span, .result-grid span { display: block; margin-bottom: 6px; color: var(--color-muted); font-size: 10px; }
.summary-grid strong, .result-grid strong { overflow-wrap: anywhere; color: #30454e; font-size: 13px; font-variant-numeric: tabular-nums; }
.formula-panel { margin-top: 18px; color: #53636e; font-size: 11px; }
.formula-panel summary { cursor: pointer; color: #30454e; font-weight: 800; }
.formula-panel p { line-height: 1.55; }
@media (max-width: 900px) { .summary-grid, .result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .results { padding: 16px; } .results header { align-items: flex-start; flex-direction: column; } .summary-grid, .result-grid { grid-template-columns: 1fr; } }
</style>
