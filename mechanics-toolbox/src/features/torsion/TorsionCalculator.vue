<script setup lang="ts">
import { computed, ref } from 'vue'
import MathFormula from '../../components/MathFormula.vue'
import { formatEngineeringValue } from '../../core/numeric'
import { TorsionCalculationError, type PowerSolveMode } from '../../core/torsion'
import { QUANTITY_CATALOG, convertFromSI, type QuantityId, type UnitId } from '../../core/units'
import {
  calculateCircularShaftDraft,
  calculatePowerTransmissionDraft,
  createDefaultCircularShaftDraft,
  createDefaultPowerTransmissionDraft,
  resolveCircularShaftShearModulusPa,
  TorsionDraftError,
  type ElasticConstantInputMode,
  type NumericFieldDraft,
} from './adapter'

const TORSION_FORMULAS = [
  String.raw`J_t=\frac{\pi d^4}{32}\quad\text{（实心圆）}`,
  String.raw`J_t=\frac{\pi\left(D^4-d^4\right)}{32}\quad\text{（圆管）}`,
  String.raw`G=\frac{E}{2(1+\nu)}`,
  String.raw`\tau_{\max}=\frac{Tr}{J_t},\qquad \theta=\frac{TL}{GJ_t}`,
]

const POWER_FORMULAS = [
  String.raw`P=T\omega,\qquad \omega=2\pi n`,
]

const shaft = ref(createDefaultCircularShaftDraft())
const power = ref(createDefaultPowerTransmissionDraft())
const shaftResult = ref<ReturnType<typeof calculateCircularShaftDraft> | null>(null)
const shaftShearModulusPa = ref<number | null>(null)
const powerResult = ref<ReturnType<typeof calculatePowerTransmissionDraft> | null>(null)
const shaftError = ref('')
const powerError = ref('')

const lengthUnits = QUANTITY_CATALOG.length.units
const stressUnits = QUANTITY_CATALOG.stress.units
const torqueUnits = QUANTITY_CATALOG.torque.units
const powerUnits = QUANTITY_CATALOG.power.units
const speedUnits = QUANTITY_CATALOG.rotationalSpeed.units

const shaftRows = computed(() => {
  const result = shaftResult.value
  if (!result) return []
  return [
    row('采用的剪切模量', 'G', shaftShearModulusPa.value!, 'elasticModulus', 'MPa', 'MPa'),
    row('扭转常数', 'Jt', result.torsionConstantM4, 'secondMomentOfArea', 'mm4', 'mm⁴'),
    row('最大剪应力（有符号）', 'τmax', result.maximumShearStressPa, 'stress', 'MPa', 'MPa'),
    row('最大剪应力绝对值', '|τ|max', result.maximumAbsoluteShearStressPa, 'stress', 'MPa', 'MPa'),
    row('扭转角（有符号）', 'θ', result.twistAngleRad, 'angle', 'deg', '°'),
  ]
})

const powerRows = computed(() => {
  const result = powerResult.value
  if (!result) return []
  return [
    row('功率', 'P', result.powerW, 'power', 'kW', 'kW'),
    row('扭矩（有符号）', 'T', result.torqueNm, 'torque', 'N_mm', 'N·mm'),
    row('转速', 'n', result.rotationalSpeedRps, 'rotationalSpeed', 'r_per_min', 'r/min'),
    { label: '角速度', symbol: 'ω', value: formatEngineeringValue(result.angularSpeedRadPerS), unit: 'rad/s' },
  ]
})

function row(
  label: string,
  symbol: string,
  siValue: number,
  quantity: QuantityId,
  unit: UnitId,
  unitLabel: string,
) {
  return {
    label,
    symbol,
    value: formatEngineeringValue(convertFromSI(siValue, quantity, unit)),
    unit: unitLabel,
  }
}

function message(error: unknown): string {
  if (error instanceof TorsionDraftError || error instanceof TorsionCalculationError) {
    return error.message
  }
  return error instanceof Error ? error.message : '输入无效，无法完成计算'
}

function clearField(field: NumericFieldDraft): void {
  field.value = ''
}

function calculateShaft(): void {
  try {
    shaftShearModulusPa.value = resolveCircularShaftShearModulusPa(shaft.value)
    shaftResult.value = calculateCircularShaftDraft(shaft.value)
    shaftError.value = ''
  } catch (error) {
    shaftResult.value = null
    shaftShearModulusPa.value = null
    shaftError.value = message(error)
  }
}

function selectElasticConstantMode(mode: ElasticConstantInputMode): void {
  shaft.value.elasticConstantInputMode = mode
  if (mode === 'youngPoisson') {
    clearField(shaft.value.shearModulus)
  } else {
    clearField(shaft.value.youngModulus)
    shaft.value.poissonRatio = ''
  }
  shaftResult.value = null
  shaftShearModulusPa.value = null
  shaftError.value = ''
}

function calculatePower(): void {
  try {
    powerResult.value = calculatePowerTransmissionDraft(power.value)
    powerError.value = ''
  } catch (error) {
    powerResult.value = null
    powerError.value = message(error)
  }
}

function selectPowerMode(mode: PowerSolveMode): void {
  power.value.solveFor = mode
  clearField(power.value[mode])
  powerResult.value = null
  powerError.value = ''
}
</script>

<template>
  <section class="torsion-calculator" aria-labelledby="torsion-title">
    <header class="module-header">
      <div>
        <p class="kicker">P1 · 圆轴扭转</p>
        <h2 id="torsion-title">圆轴扭转与传动功率</h2>
        <p>默认 N、mm、MPa、N·mm、r/min、kW；输入先统一转换为 SI 再求解。</p>
      </div>
      <span class="sign-chip">正扭矩：按右手定则</span>
    </header>

    <section class="shaft-diagram" aria-label="圆轴扭矩、长度和截面示意">
      <svg viewBox="0 0 900 190" role="img" aria-label="圆轴受扭与正扭矩方向示意图">
        <defs>
          <marker id="torsion-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" fill="#b64835" />
          </marker>
        </defs>
        <path d="M220 58 H665 V132 H220 Z" class="shaft-body" />
        <ellipse cx="220" cy="95" rx="25" ry="37" class="shaft-end" />
        <ellipse cx="665" cy="95" rx="25" ry="37" class="shaft-end" />
        <ellipse v-if="shaft.kind === 'tube'" cx="665" cy="95" rx="13" ry="24" class="shaft-hole" />
        <path d="M704 132 A58 58 0 1 0 704 58" class="torque-arrow" marker-end="url(#torsion-arrow)" />
        <text x="754" y="99">+T（右手定则）</text>
        <line x1="220" y1="157" x2="665" y2="157" class="dimension" />
        <text x="442" y="178" text-anchor="middle">L</text>
        <text x="665" y="30" text-anchor="middle">{{ shaft.kind === 'solid' ? 'd' : 'D / d' }}</text>
      </svg>
      <p>实心圆轴/圆管均按 Saint-Venant 纯扭转；正负号只表示方向，不代表安全与否。</p>
    </section>

    <div class="calculator-grid">
      <article class="calculator-card" data-testid="shaft-calculator">
        <div class="card-heading">
          <div>
            <span>强度与刚度</span>
            <h3>圆轴剪应力、扭转角</h3>
          </div>
          <div class="mode-tabs" role="tablist" aria-label="圆轴截面类型">
            <button
              type="button"
              role="tab"
              :aria-selected="shaft.kind === 'solid'"
              :class="{ active: shaft.kind === 'solid' }"
              @click="shaft.kind = 'solid'; shaftResult = null"
            >实心圆轴</button>
            <button
              type="button"
              role="tab"
              :aria-selected="shaft.kind === 'tube'"
              :class="{ active: shaft.kind === 'tube' }"
              @click="shaft.kind = 'tube'; shaftResult = null"
            >圆管</button>
          </div>
        </div>

        <div class="input-grid">
          <label v-if="shaft.kind === 'solid'" class="field">
            <span>直径 d</span>
            <span class="input-unit">
              <input v-model="shaft.diameter.value" aria-label="直径" inputmode="decimal" />
              <select v-model="shaft.diameter.unit" aria-label="直径单位" @change="clearField(shaft.diameter)">
                <option v-for="unit in lengthUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
          <template v-else>
            <label class="field">
              <span>外径 D</span>
              <span class="input-unit">
                <input v-model="shaft.outerDiameter.value" aria-label="外径" inputmode="decimal" />
                <select v-model="shaft.outerDiameter.unit" aria-label="外径单位" @change="clearField(shaft.outerDiameter)">
                  <option v-for="unit in lengthUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
                </select>
              </span>
            </label>
            <label class="field">
              <span>内径 d</span>
              <span class="input-unit">
                <input v-model="shaft.innerDiameter.value" aria-label="内径" inputmode="decimal" />
                <select v-model="shaft.innerDiameter.unit" aria-label="内径单位" @change="clearField(shaft.innerDiameter)">
                  <option v-for="unit in lengthUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
                </select>
              </span>
            </label>
          </template>
          <label class="field">
            <span>轴长 L</span>
            <span class="input-unit">
              <input v-model="shaft.length.value" aria-label="轴长" inputmode="decimal" />
              <select v-model="shaft.length.unit" aria-label="轴长单位" @change="clearField(shaft.length)">
                <option v-for="unit in lengthUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
          <div class="material-input-mode wide">
            <div class="solve-modes" aria-label="弹性常数输入方式">
              <label>
                <input
                  type="radio"
                  name="shaft-elastic-constant-mode"
                  value="youngPoisson"
                  :checked="shaft.elasticConstantInputMode === 'youngPoisson'"
                  @change="selectElasticConstantMode('youngPoisson')"
                />
                输入 E + ν
              </label>
              <label>
                <input
                  type="radio"
                  name="shaft-elastic-constant-mode"
                  value="shearModulus"
                  :checked="shaft.elasticConstantInputMode === 'shearModulus'"
                  @change="selectElasticConstantMode('shearModulus')"
                />
                直接输入 G
              </label>
            </div>
            <small>各向同性线弹性材料按 G = E / [2(1 + ν)] 换算。</small>
          </div>
          <label class="field" :class="{ target: shaft.elasticConstantInputMode !== 'youngPoisson' }">
            <span>杨氏模量 E</span>
            <span class="input-unit">
              <input
                v-model="shaft.youngModulus.value"
                aria-label="杨氏模量"
                inputmode="decimal"
                :disabled="shaft.elasticConstantInputMode !== 'youngPoisson'"
              />
              <select
                v-model="shaft.youngModulus.unit"
                aria-label="杨氏模量单位"
                :disabled="shaft.elasticConstantInputMode !== 'youngPoisson'"
                @change="clearField(shaft.youngModulus)"
              >
                <option v-for="unit in stressUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
          <label class="field" :class="{ target: shaft.elasticConstantInputMode !== 'youngPoisson' }">
            <span>泊松比 ν</span>
            <span class="input-unit">
              <input
                v-model="shaft.poissonRatio"
                aria-label="泊松比"
                inputmode="decimal"
                :disabled="shaft.elasticConstantInputMode !== 'youngPoisson'"
              />
              <span class="unit-text">—</span>
            </span>
          </label>
          <label class="field wide" :class="{ target: shaft.elasticConstantInputMode !== 'shearModulus' }">
            <span>剪切模量 G</span>
            <span class="input-unit">
              <input
                v-model="shaft.shearModulus.value"
                aria-label="剪切模量"
                inputmode="decimal"
                :disabled="shaft.elasticConstantInputMode !== 'shearModulus'"
              />
              <select
                v-model="shaft.shearModulus.unit"
                aria-label="剪切模量单位"
                :disabled="shaft.elasticConstantInputMode !== 'shearModulus'"
                @change="clearField(shaft.shearModulus)"
              >
                <option v-for="unit in stressUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
          <label class="field wide">
            <span>扭矩 T（正负号表示方向）</span>
            <span class="input-unit">
              <input v-model="shaft.torque.value" aria-label="轴扭矩" inputmode="decimal" />
              <select v-model="shaft.torque.unit" aria-label="轴扭矩单位" @change="clearField(shaft.torque)">
                <option v-for="unit in torqueUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
        </div>

        <p v-if="shaftError" class="error" role="alert">{{ shaftError }}</p>
        <button class="calculate" type="button" @click="calculateShaft">计算圆轴扭转</button>

        <div v-if="shaftResult" class="results" aria-live="polite" data-testid="shaft-results">
          <div v-for="item in shaftRows" :key="item.symbol" class="result-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.symbol }} = {{ item.value }} <small>{{ item.unit }}</small></strong>
          </div>
        </div>

        <details class="assumptions">
          <summary>公式与适用范围</summary>
          <MathFormula v-for="formula in TORSION_FORMULAS" :key="formula" :formula="formula" />
          <p>材料输入二选一：直接给定 G，或由各向同性线弹性材料的 E、ν 换算。</p>
          <p>适用于等截面、线弹性、小变形、Saint-Venant 扭转；不含应力集中与翘曲约束。</p>
        </details>
      </article>

      <article class="calculator-card" data-testid="power-calculator">
        <div class="card-heading stacked">
          <div>
            <span>旋转传动</span>
            <h3>功率—扭矩—转速</h3>
          </div>
          <div class="solve-modes" aria-label="待求物理量">
            <label v-for="mode in (['power', 'torque', 'speed'] as const)" :key="mode">
              <input
                type="radio"
                name="solve-mode"
                :value="mode"
                :checked="power.solveFor === mode"
                @change="selectPowerMode(mode)"
              />
              求{{ mode === 'power' ? '功率 P' : mode === 'torque' ? '扭矩 T' : '转速 n' }}
            </label>
          </div>
          <p class="expression-hint">数值框支持算式：0.6*100、100*(1-5%)。</p>
        </div>

        <div class="input-grid power-fields">
          <label class="field" :class="{ target: power.solveFor === 'power' }">
            <span>功率 P</span>
            <span class="input-unit">
              <input v-model="power.power.value" aria-label="功率" inputmode="text" :disabled="power.solveFor === 'power'" :placeholder="power.solveFor === 'power' ? '待求' : ''" />
              <select v-model="power.power.unit" aria-label="功率单位" :disabled="power.solveFor === 'power'" @change="clearField(power.power)">
                <option v-for="unit in powerUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
          <label class="field" :class="{ target: power.solveFor === 'torque' }">
            <span>扭矩 T（有符号）</span>
            <span class="input-unit">
              <input v-model="power.torque.value" aria-label="传动扭矩" inputmode="text" :disabled="power.solveFor === 'torque'" :placeholder="power.solveFor === 'torque' ? '待求' : ''" />
              <select v-model="power.torque.unit" aria-label="传动扭矩单位" :disabled="power.solveFor === 'torque'" @change="clearField(power.torque)">
                <option v-for="unit in torqueUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
          <label class="field" :class="{ target: power.solveFor === 'speed' }">
            <span>转速 n（非负大小）</span>
            <span class="input-unit">
              <input v-model="power.speed.value" aria-label="转速" inputmode="text" :disabled="power.solveFor === 'speed'" :placeholder="power.solveFor === 'speed' ? '待求' : ''" />
              <select v-model="power.speed.unit" aria-label="转速单位" :disabled="power.solveFor === 'speed'" @change="clearField(power.speed)">
                <option v-for="unit in speedUnits" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
              </select>
            </span>
          </label>
        </div>

        <p v-if="powerError" class="error" role="alert">{{ powerError }}</p>
        <button class="calculate" type="button" @click="calculatePower">求解传动关系</button>

        <div v-if="powerResult" class="results" aria-live="polite" data-testid="power-results">
          <div v-for="item in powerRows" :key="item.symbol" class="result-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.symbol }} = {{ item.value }} <small>{{ item.unit }}</small></strong>
          </div>
        </div>

        <details class="assumptions">
          <summary>公式与符号</summary>
          <MathFormula v-for="formula in POWER_FORMULAS" :key="formula" :formula="formula" />
          <p>n 为非负转速大小；T 为有符号扭矩，P 的符号随 T。</p>
          <p>不计传动效率与损耗。反求扭矩时 n 不能为 0；反求转速时 T 不能为 0。</p>
        </details>
      </article>
    </div>
  </section>
</template>

<style scoped>
.torsion-calculator {
  padding: clamp(20px, 3vw, 32px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-large);
  background: var(--color-panel);
  box-shadow: var(--shadow-panel);
}
.module-header, .card-heading { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
.module-header h2, .card-heading h3 { margin: 4px 0 6px; }
.module-header p, .card-heading span { color: var(--color-muted); font-size: 12px; }
.kicker { color: var(--color-brand) !important; font-weight: 800; letter-spacing: .08em; }
.sign-chip { flex: 0 0 auto; padding: 7px 10px; border-radius: 7px; color: var(--color-brand-deep); background: var(--color-brand-soft); font-weight: 700; }
.shaft-diagram { display: grid; grid-template-columns:minmax(0, 1fr) 230px; gap: 16px; align-items:center; margin-top:18px; padding:10px 16px; overflow:hidden; border:1px solid var(--color-line); border-radius:10px; background:#f7faf9; }
.shaft-diagram svg { display:block; width:100%; min-width:560px; height:150px; }
.shaft-diagram p { margin:0; color:var(--color-muted); font-size:11px; line-height:1.55; }
.shaft-diagram text { fill:#53636e; font:700 12px sans-serif; paint-order:stroke; stroke:#f7faf9; stroke-width:3px; }
.shaft-body,.shaft-end { fill:#d9eeee; stroke:#126a73; stroke-width:2; }
.shaft-hole { fill:#f7faf9; stroke:#126a73; stroke-width:2; }
.torque-arrow { fill:none; stroke:#b64835; stroke-width:2.5; }
.dimension { stroke:#9a5a18; stroke-width:1.2; }
.calculator-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 22px; }
.calculator-card { min-width: 0; padding: 20px; border: 1px solid var(--color-line); border-radius: 12px; background: #fbfcfc; }
.mode-tabs { display: flex; gap: 5px; }
.mode-tabs button { padding: 7px 9px; border: 1px solid var(--color-line); border-radius: 7px; color: #53636e; background: #fff; cursor: pointer; }
.mode-tabs button.active { color: #fff; border-color: var(--color-brand); background: var(--color-brand); }
.stacked { flex-direction: column; }
.solve-modes { display: flex; flex-wrap: wrap; gap: 7px; }
.solve-modes label { padding: 7px 9px; border-radius: 7px; background: #edf4f4; color: #40545a; font-size: 12px; font-weight: 700; cursor: pointer; }
.material-input-mode { grid-column: 1 / -1; display: grid; gap: 7px; padding-top: 4px; }
.material-input-mode small { color: var(--color-muted); font-size: 11px; line-height: 1.5; }
.expression-hint { margin: 0; color: var(--color-muted); font-size: 11px; line-height: 1.5; }
.input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.power-fields { grid-template-columns: 1fr; }
.field { display: grid; gap: 6px; color: #53636e; font-size: 12px; font-weight: 700; }
.field.wide { grid-column: 1 / -1; }
.field.target { opacity: .68; }
.input-unit { display: grid; grid-template-columns: minmax(0, 1fr) auto; overflow: hidden; border: 1px solid #cad5da; border-radius: 8px; background: #fff; }
.input-unit:focus-within { border-color: var(--color-brand); box-shadow: 0 0 0 3px rgb(18 106 115 / 10%); }
.input-unit input { min-width: 0; width: 100%; min-height: 41px; padding: 0 10px; border: 0; outline: 0; }
.input-unit select { border: 0; border-left: 1px solid #e2e7e9; padding: 0 7px; color: var(--color-muted); background: #f7f9fa; }
.unit-text { display: grid; min-width: 42px; place-items: center; border-left: 1px solid #e2e7e9; color: var(--color-muted); background: #f7f9fa; }
.input-unit input:disabled, .input-unit select:disabled { background: #e9edef; cursor: not-allowed; }
.calculate { width: 100%; min-height: 43px; margin-top: 16px; border: 0; border-radius: 8px; color: #fff; background: var(--color-brand); font-weight: 800; cursor: pointer; }
.calculate:hover { background: var(--color-brand-deep); }
.error { margin: 14px 0 0; padding: 10px 12px; border-radius: 8px; color: #8f342d; background: #fff0ed; font-size: 12px; }
.results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; margin-top: 16px; border: 1px solid var(--color-line); border-radius: 9px; background: var(--color-line); }
.result-row { padding: 11px; background: #fff; }
.result-row:last-child:nth-child(odd) { grid-column: 1 / -1; }
.result-row > span { display: block; margin-bottom: 5px; color: var(--color-muted); font-size: 10px; }
.result-row strong { overflow-wrap: anywhere; font-size: 13px; }
.result-row small { color: var(--color-muted); font-size: 10px; }
.assumptions { margin-top: 15px; padding: 11px 13px; border-left: 3px solid var(--color-accent); color: #60472d; background: #fff8ee; font-size: 12px; line-height: 1.55; }
.assumptions summary { cursor: pointer; font-weight: 800; }
.assumptions p { margin: 7px 0 0; }
@media (max-width: 1050px) { .calculator-grid { grid-template-columns: 1fr; } }
@media (max-width: 580px) {
  .module-header, .card-heading { flex-direction: column; }
  .shaft-diagram { grid-template-columns:1fr; overflow-x:auto; }
  .input-grid, .results { grid-template-columns: 1fr; }
  .field.wide { grid-column: auto; }
  .sign-chip { align-self: flex-start; }
}
</style>
