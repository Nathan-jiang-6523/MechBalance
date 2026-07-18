<script setup lang="ts">
import { computed, ref } from 'vue'
import MathFormula from '../../components/MathFormula.vue'
import { formatEngineeringValue } from '../../core/numeric'
import { normalizeToSI, QUANTITY_CATALOG, type UnitId } from '../../core/units'
import {
  solveBendingTorsion,
  solvePlaneStress,
  type BendingTorsionResult,
  type PlaneStressResult,
} from '../../core/stress'
import MohrCircle from './MohrCircle.vue'

const STRESS_FORMULAS = [
  String.raw`\sigma_{\mathrm{avg}}=\frac{\sigma_x+\sigma_y}{2},\qquad R=\sqrt{\left(\frac{\sigma_x-\sigma_y}{2}\right)^2+\tau_{xy}^2}`,
  String.raw`\sigma_{1,2}=\sigma_{\mathrm{avg}}\pm R,\qquad \left(\sigma-\sigma_{\mathrm{avg}}\right)^2+\tau^2=R^2`,
  String.raw`\sigma_{x'}=\sigma_{\mathrm{avg}}+\frac{\sigma_x-\sigma_y}{2}\cos 2\theta+\tau_{xy}\sin 2\theta`,
  String.raw`\tau_{x'y'}=-\frac{\sigma_x-\sigma_y}{2}\sin 2\theta+\tau_{xy}\cos 2\theta`,
  String.raw`\theta_p=\frac{1}{2}\operatorname{atan2}\!\left(2\tau_{xy},\sigma_x-\sigma_y\right),\qquad \theta_s=\theta_p+45^\circ`,
  String.raw`\sigma_{\mathrm{VM}}=\sqrt{\sigma_x^2-\sigma_x\sigma_y+\sigma_y^2+3\tau_{xy}^2}`,
]

type Mode = 'plane' | 'bending-torsion'
type RoundKind = 'solid-circle' | 'circular-tube'

interface ResultRow { label: string; symbol: string; value: string; unit: string }

const mode = ref<Mode>('plane')
const sigmaX = ref('100')
const sigmaY = ref('0')
const tauXy = ref('0')
const strength = ref('')
const stressUnit = ref<UnitId>('MPa')
const bendingMoment = ref('1000000')
const torque = ref('500000')
const momentUnit = ref<UnitId>('N_mm')
const roundKind = ref<RoundKind>('solid-circle')
const diameter = ref('40')
const outerDiameter = ref('60')
const innerDiameter = ref('40')
const lengthUnit = ref<UnitId>('mm')
const result = ref<PlaneStressResult | null>(null)
const bendingResult = ref<BendingTorsionResult | null>(null)
const error = ref('')

function parseFinite(raw: string, label: string): number {
  if (raw.trim() === '') throw new RangeError(`${label}不能为空`)
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new RangeError(`${label}必须是有限数值`)
  return value
}

function optionalStrengthPa(): number | undefined {
  if (strength.value.trim() === '') return undefined
  const value = parseFinite(strength.value, '许用/屈服强度')
  if (value <= 0) throw new RangeError('许用/屈服强度必须大于 0')
  return normalizeToSI(value, 'stress', stressUnit.value)
}

function changeStressUnit(): void {
  sigmaX.value = ''
  sigmaY.value = ''
  tauXy.value = ''
  strength.value = ''
  selectMode(mode.value)
}

function changeMomentUnit(): void {
  bendingMoment.value = ''
  torque.value = ''
  selectMode(mode.value)
}

function changeLengthUnit(): void {
  diameter.value = ''
  outerDiameter.value = ''
  innerDiameter.value = ''
  selectMode(mode.value)
}

function calculate(): void {
  error.value = ''
  result.value = null
  bendingResult.value = null
  try {
    const strengthPa = optionalStrengthPa()
    if (mode.value === 'plane') {
      result.value = solvePlaneStress({
        sigmaXPa: normalizeToSI(parseFinite(sigmaX.value, 'σx'), 'stress', stressUnit.value),
        sigmaYPa: normalizeToSI(parseFinite(sigmaY.value, 'σy'), 'stress', stressUnit.value),
        tauXyPa: normalizeToSI(parseFinite(tauXy.value, 'τxy'), 'stress', stressUnit.value),
        ...(strengthPa === undefined ? {} : { strengthPa }),
      })
      return
    }

    const section = roundKind.value === 'solid-circle'
      ? { kind: 'solid-circle' as const, diameterM: normalizeToSI(parseFinite(diameter.value, '直径'), 'length', lengthUnit.value) }
      : {
          kind: 'circular-tube' as const,
          outerDiameterM: normalizeToSI(parseFinite(outerDiameter.value, '外径'), 'length', lengthUnit.value),
          innerDiameterM: normalizeToSI(parseFinite(innerDiameter.value, '内径'), 'length', lengthUnit.value),
        }
    bendingResult.value = solveBendingTorsion({
      bendingMomentNm: normalizeToSI(parseFinite(bendingMoment.value, '弯矩'), 'moment', momentUnit.value),
      torqueNm: normalizeToSI(parseFinite(torque.value, '转矩'), 'torque', momentUnit.value),
      section,
      ...(strengthPa === undefined ? {} : { strengthPa }),
    })
    result.value = bendingResult.value.stress
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '输入无效'
  }
}

function selectMode(nextMode: Mode): void {
  mode.value = nextMode
  result.value = null
  bendingResult.value = null
  error.value = ''
}

function mpa(value: number): string { return formatEngineeringValue(value / 1e6) }
function degree(value: number | null): string {
  return value === null ? '任意' : formatEngineeringValue((value * 180) / Math.PI)
}

const resultRows = computed<ResultRow[]>(() => {
  const value = result.value
  if (!value) return []
  const rows: ResultRow[] = [
    { label: '第一面内主应力', symbol: 'σ1', value: mpa(value.sigma1Pa), unit: 'MPa' },
    { label: '第二面内主应力', symbol: 'σ2', value: mpa(value.sigma2Pa), unit: 'MPa' },
    { label: '第一主方向（物理角）', symbol: 'θp', value: degree(value.principalAngleRad), unit: value.principalAngleRad === null ? '' : '°' },
    { label: '最大面内剪应力', symbol: 'τmax,in', value: mpa(value.maxInPlaneShearPa), unit: 'MPa' },
    { label: 'von Mises 等效应力', symbol: 'σVM', value: mpa(value.vonMisesPa), unit: 'MPa' },
    { label: 'Tresca 等效应力', symbol: 'σT', value: mpa(value.trescaPa), unit: 'MPa' },
    { label: '三维最大剪应力', symbol: 'τmax,3D', value: mpa(value.maximum3dShearPa), unit: 'MPa' },
    { label: '三主应力（降序，含 0）', symbol: 'σI/σII/σIII', value: value.principalStressesPa.map(mpa).join(' / '), unit: 'MPa' },
  ]
  if (bendingResult.value) {
    rows.unshift(
      { label: '选定外缘弯曲正应力', symbol: 'σb', value: mpa(bendingResult.value.outerBendingStressPa), unit: 'MPa' },
      { label: '选定外缘扭转剪应力', symbol: 'τt', value: mpa(bendingResult.value.outerTorsionalShearPa), unit: 'MPa' },
    )
  }
  return rows
})

const criterionText = computed(() => {
  const utilization = result.value?.utilization
  if (!utilization) return ''
  const criterion = utilization.controllingCriterion === 'equal'
    ? '两准则相同'
    : utilization.controllingCriterion === 'von-mises' ? 'von Mises 控制' : 'Tresca 控制'
  return `${criterion}；控制利用率 ${formatEngineeringValue(utilization.controllingUtilization * 100)}%`
})
</script>

<template>
  <section class="stress-calculator" aria-labelledby="stress-title">
    <header class="panel-header">
      <div>
        <p class="kicker">P1 · 组合应力</p>
        <h2 id="stress-title">平面应力与弯扭组合</h2>
        <p>UI 默认 N·mm / mm / MPa；计算前统一转换为 SI。拉应力为正。</p>
      </div>
      <span class="convention">τxy：+x 面沿 +y</span>
    </header>

    <div class="mode-tabs" role="tablist" aria-label="应力计算模式">
      <button type="button" :class="{ active: mode === 'plane' }" @click="selectMode('plane')">平面应力 / 莫尔圆</button>
      <button type="button" :class="{ active: mode === 'bending-torsion' }" @click="selectMode('bending-torsion')">圆轴弯扭组合</button>
    </div>

    <div class="stress-workspace">
      <div class="input-panel">
        <div class="unit-toolbar">
          <label v-if="mode === 'plane'">应力单位
            <select v-model="stressUnit" aria-label="平面应力输入单位" @change="changeStressUnit">
              <option v-for="unit in QUANTITY_CATALOG.stress.units" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
            </select>
          </label>
          <template v-else>
            <label>弯矩/转矩单位
              <select v-model="momentUnit" aria-label="弯矩转矩输入单位" @change="changeMomentUnit">
                <option v-for="unit in QUANTITY_CATALOG.torque.units" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </label>
            <label>截面尺寸单位
              <select v-model="lengthUnit" aria-label="弯扭截面尺寸单位" @change="changeLengthUnit">
                <option v-for="unit in QUANTITY_CATALOG.length.units" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </label>
          </template>
        </div>
        <div v-if="mode === 'plane'" class="field-grid">
          <label><span>正应力 σx <small>{{ stressUnit }}</small></span><input v-model="sigmaX" inputmode="decimal" /></label>
          <label><span>正应力 σy <small>{{ stressUnit }}</small></span><input v-model="sigmaY" inputmode="decimal" /></label>
          <label><span>剪应力 τxy <small>{{ stressUnit }}</small></span><input v-model="tauXy" inputmode="decimal" /></label>
        </div>

        <template v-else>
          <div class="field-grid">
            <label><span>弯矩 M <small>{{ momentUnit }}</small></span><input v-model="bendingMoment" inputmode="decimal" /></label>
            <label><span>转矩 T <small>{{ momentUnit }}</small></span><input v-model="torque" inputmode="decimal" /></label>
          </div>
          <div class="section-tabs">
            <button type="button" :class="{ active: roundKind === 'solid-circle' }" @click="roundKind = 'solid-circle'">实心圆</button>
            <button type="button" :class="{ active: roundKind === 'circular-tube' }" @click="roundKind = 'circular-tube'">圆管</button>
          </div>
          <div class="field-grid">
            <label v-if="roundKind === 'solid-circle'"><span>直径 d <small>{{ lengthUnit }}</small></span><input v-model="diameter" inputmode="decimal" /></label>
            <template v-else>
              <label><span>外径 D <small>{{ lengthUnit }}</small></span><input v-model="outerDiameter" inputmode="decimal" /></label>
              <label><span>内径 d <small>{{ lengthUnit }}</small></span><input v-model="innerDiameter" inputmode="decimal" /></label>
            </template>
          </div>
          <p class="model-note">
            圆截面采用外缘控制点：正 M → 拉应力；正 T → 正 τxy。
            {{ roundKind === 'solid-circle' ? '实心圆采用 I = πd⁴/64、J = 2I。' : '圆管采用 I = π(D⁴−d⁴)/64、J = 2I。' }}
          </p>
        </template>

        <label class="strength-field">
          <span>许用/屈服强度（可选） <small>{{ stressUnit }}</small></span>
          <input v-model="strength" inputmode="decimal" placeholder="留空则只算应力" />
        </label>
        <div v-if="error" class="error" role="alert">{{ error }}</div>
        <button class="calculate" type="button" @click="calculate">计算</button>
      </div>

      <div class="result-panel" aria-live="polite">
        <template v-if="result">
          <div class="result-grid">
            <article v-for="row in resultRows" :key="row.symbol">
              <span>{{ row.label }}</span>
              <strong>{{ row.symbol }} = {{ row.value }} <small>{{ row.unit }}</small></strong>
            </article>
          </div>
          <div v-if="result.utilization" class="criterion" :class="{ exceed: result.utilization.exceedsStrength }" role="status">
            <strong>{{ result.utilization.exceedsStrength ? '超出输入强度' : '未超出输入强度' }}</strong>
            <span>{{ criterionText }}</span>
            <small>VM {{ formatEngineeringValue(result.utilization.vonMises * 100) }}% · Tresca {{ formatEngineeringValue(result.utilization.tresca * 100) }}%</small>
          </div>
          <MohrCircle :result="result" />
          <div class="assumptions">
            <strong>适用范围</strong>
            <span>线弹性、小变形、平面应力；不计应力集中、残余应力、疲劳及屈曲。</span>
            <span>静水面内状态 R=0 时，各方向均为主方向；界面显示“任意”。</span>
          </div>
        </template>
        <div v-else class="empty"><strong>等待计算</strong><span>输入应力状态或圆轴弯矩、转矩。</span></div>
      </div>
    </div>

    <details class="formula-panel">
      <summary>公式、角度与版本</summary>
      <div class="formula-list">
        <MathFormula v-for="formula in STRESS_FORMULAS" :key="formula" :formula="formula" />
      </div>
      <ul>
        <li>莫尔圆转角与物理转角大小为 2 倍、方向相反。</li>
        <li>Tresca 使用三主应力（含 σ3=0）的最大差值。</li>
        <li>版本：P1-STRESS-PLANE-v1 / P1-STRESS-BT-v1。</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.stress-calculator { padding: clamp(22px, 3vw, 32px); border: 1px solid var(--color-line); border-radius: var(--radius-large); background: var(--color-panel); box-shadow: var(--shadow-panel); }
.panel-header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
.kicker { margin: 0 0 7px; color: var(--color-brand); font-size: 11px; font-weight: 800; letter-spacing: .08em; }
h2 { margin: 0 0 7px; font-size: 22px; }
.panel-header p:last-child { margin: 0; color: var(--color-muted); font-size: 13px; }
.convention { flex: 0 0 auto; padding: 7px 10px; border-radius: 7px; color: var(--color-brand-deep); background: var(--color-brand-soft); font-size: 11px; font-weight: 700; }
.mode-tabs, .section-tabs { display: flex; gap: 8px; margin: 22px 0 16px; }
.mode-tabs button, .section-tabs button { padding: 9px 13px; border: 1px solid var(--color-line); border-radius: 8px; background: #f7f9fa; color: #53636e; cursor: pointer; }
.mode-tabs button.active, .section-tabs button.active { border-color: var(--color-brand); background: var(--color-brand); color: #fff; }
.stress-workspace { display: grid; grid-template-columns: minmax(280px, .72fr) minmax(480px, 1.28fr); gap: 18px; }
.input-panel, .result-panel { min-width: 0; padding: 18px; border: 1px solid var(--color-line); border-radius: 12px; background: #fbfcfc; }
.unit-toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:14px; padding:10px; border-radius:8px; background:#eef5f5; }
.unit-toolbar label { min-width:140px; }
.unit-toolbar select { min-height:34px; padding:0 8px; border:1px solid #cad5da; border-radius:7px; background:#fff; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
label { display: grid; gap: 6px; color: #53636e; font-size: 12px; font-weight: 700; }
label span { display: flex; justify-content: space-between; gap: 8px; }
label small { color: var(--color-muted); font-weight: 500; }
input { width: 100%; min-width: 0; min-height: 42px; box-sizing: border-box; padding: 0 10px; border: 1px solid #cad5da; border-radius: 8px; outline: none; }
input:focus { border-color: var(--color-brand); box-shadow: 0 0 0 3px rgb(18 106 115 / 10%); }
.strength-field { margin-top: 14px; }
.model-note { margin: 12px 0 0; padding: 10px; border-left: 3px solid var(--color-accent); background: #fff8ee; color: #725337; font-size: 11px; line-height: 1.55; }
.error { margin-top: 12px; padding: 10px; border-radius: 8px; color: #8f342d; background: #fff0ed; font-size: 12px; }
.calculate { width: 100%; min-height: 44px; margin-top: 16px; border: 0; border-radius: 8px; color: #fff; background: var(--color-brand); cursor: pointer; font-weight: 800; }
.result-panel { display: grid; gap: 14px; }
.result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--color-line); border-radius: 9px; background: var(--color-line); }
.result-grid article { min-width: 0; padding: 11px; background: #fff; }
.result-grid article > span { display: block; margin-bottom: 5px; color: var(--color-muted); font-size: 10px; }
.result-grid strong { overflow-wrap: anywhere; font-size: 12px; }
.result-grid small { color: var(--color-muted); font-size: 10px; }
.criterion { display: grid; gap: 4px; padding: 12px; border-left: 4px solid var(--color-success); background: #eaf6ed; color: #2f6941; font-size: 12px; }
.criterion.exceed { border-left-color: #bd4339; background: #fff0ed; color: #8f342d; }
.assumptions { display: grid; gap: 5px; padding: 12px; border-radius: 8px; background: #f1f6f6; color: var(--color-muted); font-size: 11px; line-height: 1.5; }
.assumptions strong { color: #40535b; }
.formula-panel { margin-top: 16px; border-left: 3px solid var(--color-brand); color: #53636e; background: #f3f8f8; }
.formula-panel summary { padding: 12px 14px; cursor: pointer; font-size: 12px; font-weight: 800; }
.formula-panel ul { display: grid; gap: 5px; margin: 0; padding: 0 18px 14px 32px; font-size: 11px; line-height: 1.55; }
.formula-list { display: grid; gap: 3px; padding: 0 14px 8px; font-size: 12px; }
.empty { min-height: 440px; display: grid; place-content: center; gap: 7px; color: var(--color-muted); text-align: center; font-size: 12px; }
@media (max-width: 1050px) { .stress-workspace { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .panel-header { flex-direction: column; } .field-grid, .result-grid { grid-template-columns: 1fr; } .input-panel, .result-panel { padding: 13px; } }
</style>
