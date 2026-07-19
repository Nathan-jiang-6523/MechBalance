<script setup lang="ts">
import { computed } from 'vue'
import MathFormula from '../../../components/MathFormula.vue'
import type { PlateBucklingResult, ShellBucklingResult } from '../../../core/plate-shell'
import { formatEngineeringValue } from '../../../core/numeric'
import { convertFromSI, getPresetUnit, getUnitDefinition, type QuantityId, type UnitPresetId } from '../../../core/units'

const props = defineProps<{ result: PlateBucklingResult | ShellBucklingResult; unitPreset: UnitPresetId }>()
const isPlate = computed(() => props.result.formulaId.includes('PLATE'))
function value(valueSI: number, quantity: QuantityId): string {
  return formatEngineeringValue(convertFromSI(valueSI, quantity, getPresetUnit(quantity, props.unitPreset)))
}
function symbol(quantity: QuantityId): string {
  return getUnitDefinition(quantity, getPresetUnit(quantity, props.unitPreset)).symbol
}
</script>

<template>
  <section class="results" data-testid="buckling-results">
    <header><h3>{{ isPlate ? '矩形板屈曲结果' : '圆柱壳屈曲结果' }}</h3><span>理想弹性估计</span></header>
    <div v-for="warning in result.warnings" :key="warning" class="warning">{{ warning }}</div>
    <div class="cards">
      <article><small>临界压缩膜力 Nx,cr</small><b>{{ value(result.criticalLineLoadNPerM, 'lineLoad') }} {{ symbol('lineLoad') }}</b></article>
      <article><small>临界应力 σcr</small><b>{{ value(result.criticalStressPa, 'stress') }} {{ symbol('stress') }}</b></article>
      <article><small>临界总压力 Pcr</small><b>{{ value(result.criticalTotalForceN, 'force') }} {{ symbol('force') }}</b></article>
      <article><small>理论利用比 Nx/Nx,cr</small><b>{{ formatEngineeringValue(result.utilization) }}</b></article>
    </div>
    <div v-if="isPlate" class="meta">
      <span>控制半波 m × n：{{ (result as PlateBucklingResult).longitudinalHalfWaves }} × {{ (result as PlateBucklingResult).transverseHalfWaves }}</span>
      <span>屈曲系数 k：{{ formatEngineeringValue((result as PlateBucklingResult).bucklingCoefficient) }}</span>
    </div>
    <div v-else class="meta">
      <span>搜索波数 m × n：{{ (result as ShellBucklingResult).axialHalfWaves }} × {{ (result as ShellBucklingResult).circumferentialWaves }}</span>
      <span>曲率参数 Z：{{ formatEngineeringValue((result as ShellBucklingResult).curvatureParameterZ) }}</span>
      <span>离散搜索 Nx：{{ value((result as ShellBucklingResult).searchLineLoadNPerM, 'lineLoad') }} {{ symbol('lineLoad') }}</span>
    </div>
    <details open>
      <summary>公式与范围 · {{ result.formulaId }}</summary>
      <MathFormula v-if="isPlate" formula="N_{x,cr}=k\pi^2D/b^2,\quad k=(mb/a+a/(mb))^2" />
      <MathFormula v-else formula="\sigma_{cr}=E(t/r)/\sqrt{3(1-\nu^2)}" />
      <p>压缩量取正；未组合材料屈服、后屈曲、整体柱屈曲或规范折减。</p>
    </details>
  </section>
</template>

<style scoped>
.results{padding:22px;border:1px solid var(--color-line);border-radius:var(--radius-large);background:#fff;box-shadow:var(--shadow-panel)}header{display:flex;justify-content:space-between;align-items:center}h3{margin:0}header span{padding:6px 9px;border-radius:99px;color:#76551e;background:#fff0c9;font-size:11px}.warning{margin-top:10px;padding:11px;border-left:3px solid #b35840;background:#fff3eb;font-size:12px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px}.cards article{display:grid;gap:7px;padding:13px;border:1px solid var(--color-line);border-radius:9px}.cards small,.meta,details{font-size:11px}.cards b{font-size:14px}.meta{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;padding:10px;background:#f4f7f6}details{margin-top:14px}@media(max-width:800px){.cards{grid-template-columns:repeat(2,1fr)}}@media(max-width:500px){.cards{grid-template-columns:1fr}}
</style>
