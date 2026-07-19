<script setup lang="ts">
import { computed } from 'vue'
import MathFormula from '../../../components/MathFormula.vue'
import type { LameCylinderResult } from '../../../core/plate-shell'
import { formatEngineeringValue } from '../../../core/numeric'
import { convertFromSI, getPresetUnit, getUnitDefinition, type UnitPresetId } from '../../../core/units'

const props = defineProps<{ result: LameCylinderResult; unitPreset: UnitPresetId }>()
const stressUnit = computed(() => getPresetUnit('stress', props.unitPreset))
const lengthUnit = computed(() => getPresetUnit('length', props.unitPreset))
const stressSymbol = computed(() => getUnitDefinition('stress', stressUnit.value).symbol)
const lengthSymbol = computed(() => getUnitDefinition('length', lengthUnit.value).symbol)

function stress(value: number): string { return formatEngineeringValue(convertFromSI(value, 'stress', stressUnit.value)) }
function length(value: number): string { return formatEngineeringValue(convertFromSI(value, 'length', lengthUnit.value)) }
function percent(value: number | null): string { return value === null ? '—' : `${(value * 100).toFixed(6)}%` }

const boundaryLabel = computed(() => ({
  open: '开口端', closed: '封闭承压端', 'plane-strain': '平面应变 εz=0',
})[props.result.boundary])

const plot = computed(() => {
  const values = props.result.curve.flatMap((point) => [point.radialStressPa, point.hoopStressPa, point.axialStressPa])
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = max - min || 1
  const ri = props.result.curve[0]?.radiusM ?? 0
  const ro = props.result.curve.at(-1)?.radiusM ?? ri + 1
  const x = (r: number) => 48 + 440 * (r - ri) / (ro - ri)
  const y = (value: number) => 25 + 175 * (max - value) / range
  const points = (key: 'radialStressPa' | 'hoopStressPa' | 'axialStressPa') =>
    props.result.curve.map((point) => `${x(point.radiusM)},${y(point[key])}`).join(' ')
  return { radial: points('radialStressPa'), hoop: points('hoopStressPa'), axial: points('axialStressPa'), zeroY: y(0), min, max }
})
</script>

<template>
  <section class="results" aria-labelledby="lame-results-title" data-testid="lame-cylinder-results">
    <header><div><p>计算完成</p><h3 id="lame-results-title">Lamé 应力、位移与边界核对</h3></div><span>精确闭式解</span></header>
    <div v-for="warning in result.warnings" :key="warning" class="warning"><strong>薄壁对照提醒</strong><p>{{ warning }}</p></div>

    <div class="summary-grid">
      <article><small>轴向状态</small><strong>{{ boundaryLabel }}</strong></article>
      <article><small>Lamé 常数 A</small><strong>{{ stress(result.constants.aPa) }} {{ stressSymbol }}</strong></article>
      <article><small>Lamé 常数 B</small><strong>{{ formatEngineeringValue(result.constants.bPaM2) }} {{ unitPreset === 'engineering' ? 'MPa·mm²' : 'Pa·m²' }}</strong></article>
      <article><small>轴向应力 σz</small><strong>{{ stress(result.axialStressPa) }} {{ stressSymbol }}</strong></article>
    </div>

    <h4>内表面、求值位置与外表面</h4>
    <div class="point-grid">
      <article v-for="point in result.points" :key="`${point.label}-${point.radiusM}`" :data-testid="`lame-point-${point.label}`">
        <h5>{{ point.label }} · r={{ length(point.radiusM) }} {{ lengthSymbol }}</h5>
        <dl>
          <div><dt>径向应力 σr</dt><dd>{{ stress(point.radialStressPa) }} {{ stressSymbol }}</dd></div>
          <div><dt>环向应力 σθ</dt><dd>{{ stress(point.hoopStressPa) }} {{ stressSymbol }}</dd></div>
          <div><dt>轴向应力 σz</dt><dd>{{ stress(point.axialStressPa) }} {{ stressSymbol }}</dd></div>
          <div><dt>径向位移 u</dt><dd>{{ length(point.radialDisplacementM) }} {{ lengthSymbol }}</dd></div>
          <div><dt>von Mises</dt><dd>{{ stress(point.vonMisesPa) }} {{ stressSymbol }}</dd></div>
          <div><dt>Tresca</dt><dd>{{ stress(point.trescaPa) }} {{ stressSymbol }}</dd></div>
          <div><dt>三主应力</dt><dd>{{ point.principalStressesPa.map(stress).join(' / ') }} {{ stressSymbol }}</dd></div>
        </dl>
      </article>
    </div>

    <div class="curve-card">
      <h4>厚度方向应力曲线</h4>
      <svg viewBox="0 0 530 245" role="img" aria-label="径向环向和轴向应力随半径变化曲线">
        <line x1="48" :y1="plot.zeroY" x2="488" :y2="plot.zeroY" class="zero" />
        <line x1="48" y1="20" x2="48" y2="205" class="axis" /><line x1="48" y1="205" x2="488" y2="205" class="axis" />
        <polyline :points="plot.radial" class="radial-line" /><polyline :points="plot.hoop" class="hoop-line" /><polyline :points="plot.axial" class="axial-line" />
        <text x="55" y="20">{{ stress(plot.max) }} {{ stressSymbol }}</text><text x="55" y="222">{{ stress(plot.min) }} {{ stressSymbol }}</text>
        <text x="375" y="235">r / {{ lengthSymbol }}</text>
      </svg>
      <div class="legend"><span class="radial-key">σr</span><span class="hoop-key">σθ</span><span class="axial-key">σz</span></div>
    </div>

    <div class="boundary-checks">
      <strong>压力边界回代残差</strong>
      <span data-testid="lame-inner-residual">内表面：{{ stress(result.innerPressureResidualPa) }} {{ stressSymbol }}</span>
      <span data-testid="lame-outer-residual">外表面：{{ stress(result.outerPressureResidualPa) }} {{ stressSymbol }}</span>
    </div>

    <div v-if="result.thinWallComparison" class="thin-comparison" data-testid="lame-thin-comparison">
      <h4>薄壁膜解对照</h4>
      <p>中面环向：Lamé {{ stress(result.thinWallComparison.lameHoopPa) }} / 薄壁 {{ stress(result.thinWallComparison.thinHoopPa) }} {{ stressSymbol }}；相对差 {{ percent(result.thinWallComparison.hoopRelativeDifference) }}</p>
      <p>轴向：Lamé {{ stress(result.thinWallComparison.lameAxialPa) }} / 薄壁 {{ stress(result.thinWallComparison.thinAxialPa) }} {{ stressSymbol }}；相对差 {{ percent(result.thinWallComparison.axialRelativeDifference) }}</p>
    </div>

    <details open class="formula-panel"><summary>公式、位置与范围</summary>
      <MathFormula formula="\sigma_r=A-B/r^2,\quad \sigma_\theta=A+B/r^2" />
      <MathFormula formula="u(r)=\{[(1-\nu)A-\nu C]r+(1+\nu)B/r\}/E" />
      <p>公式 ID：{{ result.formula.id }}、{{ result.axialFormulaId }}、{{ result.displacementFormulaId }}。</p>
      <p>{{ result.controlLocation }}；位移向外为正。不含有限长度端部效应、塑性、多层或热梯度。</p>
    </details>
  </section>
</template>

<style scoped>
.results{min-width:0;padding:22px;border:1px solid var(--color-line);border-radius:var(--radius-large);background:var(--color-panel);box-shadow:var(--shadow-panel)}
.results header{display:flex;align-items:center;justify-content:space-between;gap:16px}.results header p{margin:0 0 4px;color:var(--color-brand);font-size:10px;font-weight:800}.results h3,.results h4,.results h5{margin:0}.results header>span{padding:7px 10px;border-radius:999px;color:#25613d;background:#e7f5ec;font-size:11px;font-weight:800}
.warning{margin-top:14px;padding:12px 14px;border-left:4px solid #d08a25;color:#73511e;background:#fff8e9}.warning p{margin:4px 0 0;font-size:12px}
.summary-grid,.point-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-top:15px;overflow:hidden;border:1px solid var(--color-line);border-radius:9px;background:var(--color-line)}.summary-grid article{padding:13px;background:#fff}.summary-grid small{display:block;margin-bottom:5px;color:var(--color-muted)}.summary-grid strong{overflow-wrap:anywhere;font-size:12px}
.results>h4{margin-top:20px;font-size:13px}.point-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;border:0;overflow:visible;background:none}.point-grid article{min-width:0;padding:14px;border:1px solid var(--color-line);border-radius:9px;background:#fbfcfc}.point-grid h5{font-size:12px}.point-grid dl{margin:10px 0 0}.point-grid dl div{display:grid;grid-template-columns:1fr;gap:2px;padding:7px 0;border-top:1px solid #edf1f2}.point-grid dt{color:var(--color-muted);font-size:10px}.point-grid dd{margin:0;overflow-wrap:anywhere;font-size:11px;font-weight:800}
.curve-card{margin-top:18px;padding:15px;border:1px solid var(--color-line);border-radius:9px}.curve-card h4{font-size:13px}.curve-card svg{display:block;width:100%;max-height:320px}.curve-card polyline{fill:none;stroke-width:2.5}.radial-line{stroke:#b64835}.hoop-line{stroke:#17636b}.axial-line{stroke:#8b6425}.axis{stroke:#6d7f87;stroke-width:1}.zero{stroke:#9ba9ae;stroke-dasharray:5 4}.curve-card text{fill:#53636e;font:11px sans-serif}.legend{display:flex;gap:16px;font-size:11px;font-weight:800}.radial-key{color:#b64835}.hoop-key{color:#17636b}.axial-key{color:#8b6425}
.boundary-checks,.thin-comparison{display:grid;gap:6px;margin-top:15px;padding:13px;border-radius:9px;background:#f4f8f8;font-size:11px}.thin-comparison{background:#fff8e9}.thin-comparison h4{font-size:12px}.thin-comparison p{margin:0;line-height:1.5}.formula-panel{margin-top:16px;color:#53636e;font-size:11px}.formula-panel summary{cursor:pointer;color:#30454e;font-weight:800}.formula-panel p{line-height:1.55}
@media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.point-grid{grid-template-columns:1fr}}
@media(max-width:540px){.results{padding:16px}.results header{align-items:flex-start;flex-direction:column}.summary-grid{grid-template-columns:1fr}}
</style>
