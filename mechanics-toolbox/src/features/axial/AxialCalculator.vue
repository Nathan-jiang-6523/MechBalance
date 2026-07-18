<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { AxialAnalysisResult } from '../../core/axial'
import type { QuantityId, UnitId } from '../../core/units'
import {
  axialCompatibleUnits,
  calculateAxialDraft,
  createAxialSegmentDraft,
  createDefaultAxialInputDraft,
  type AxialInputDraft,
  type AxialSegmentDraft,
  type AxialValueDraft,
} from './input'

const draft = ref<AxialInputDraft>(createDefaultAxialInputDraft())
const result = ref<AxialAnalysisResult | null>(null)
const errors = ref<string[]>([])
const hasCalculated = ref(false)
let nextSegmentId = 2
let recalculateTimer: ReturnType<typeof setTimeout> | undefined

const boundaryNote = computed(() => draft.value.boundary === 'free'
  ? '端部允许变形：总变形 = 轴力引起的机械变形 + 自由温度变形。'
  : '两端完全约束：不叠加外加端力，由 ΣΔL = 0 求温度约束力。')

function calculate(): void {
  const calculated = calculateAxialDraft(draft.value)
  if (!calculated.ok) {
    result.value = null
    errors.value = calculated.errors.map(({ message }) => message)
    return
  }
  result.value = calculated.value
  errors.value = []
  hasCalculated.value = true
}

watch(
  draft,
  () => {
    if (!hasCalculated.value) return
    if (recalculateTimer) clearTimeout(recalculateTimer)
    recalculateTimer = setTimeout(calculate, 250)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (recalculateTimer) clearTimeout(recalculateTimer)
})

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function selectValue(event: Event): string {
  return (event.target as HTMLSelectElement).value
}

function changeBoundary(event: Event): void {
  const boundary = selectValue(event) as AxialInputDraft['boundary']
  draft.value.boundary = boundary
  if (boundary === 'fullyRestrained') draft.value.axialForce.value = '0'
}

function changeRootUnit(event: Event): void {
  draft.value.axialForce = {
    value: '',
    unit: selectValue(event) as UnitId,
  }
}

type SegmentUnitField = 'length' | 'area' | 'elasticModulus' | 'deltaTemperature'

function changeSegmentUnit(segment: AxialSegmentDraft, field: SegmentUnitField, event: Event): void {
  segment[field] = { value: '', unit: selectValue(event) as UnitId }
}

function updateSegmentValue(
  segment: AxialSegmentDraft,
  field: SegmentUnitField,
  event: Event,
): void {
  segment[field].value = inputValue(event)
}

function addSegment(): void {
  draft.value.segments.push(createAxialSegmentDraft(`segment-${nextSegmentId}`, nextSegmentId - 1))
  nextSegmentId += 1
}

function removeSegment(index: number): void {
  if (draft.value.segments.length <= 1) return
  draft.value.segments.splice(index, 1)
}

function units(quantity: QuantityId): ReadonlyArray<{ id: UnitId; symbol: string }> {
  return axialCompatibleUnits(quantity)
}

function format(value: number, scale = 1, digits = 6): string {
  const scaled = value * scale
  if (!Number.isFinite(scaled)) return '—'
  if (Math.abs(scaled) < 5e-12) return '0'
  return Number(scaled.toPrecision(digits)).toString()
}

function forceState(value: number): string {
  if (Math.abs(value) < 1e-9) return '零轴力'
  return value > 0 ? '受拉' : '受压'
}

function segmentValue(segment: AxialSegmentDraft, field: SegmentUnitField): AxialValueDraft {
  return segment[field]
}
</script>

<template>
  <section class="axial-calculator" aria-labelledby="axial-title">
    <div class="intro-card">
      <div>
        <span>P1 · 材料力学</span>
        <h2 id="axial-title">轴向拉压、伸长与温度变形</h2>
        <p>均匀杆与分段串联杆；拉为正、压为负、升温为正。内部统一使用 SI 单位。</p>
      </div>
      <strong>默认输入：mm · N · MPa</strong>
    </div>

    <section class="axial-diagram" aria-labelledby="axial-diagram-title">
      <div>
        <h3 id="axial-diagram-title">边界与杆段示意</h3>
        <p>{{ draft.boundary === 'free' ? '允许轴向变形；红色箭头按轴力拉正压负显示。' : '两端完全约束；由兼容条件 ΣΔL=0 求温度约束力。' }}</p>
      </div>
      <svg viewBox="0 0 820 190" role="img" aria-label="轴向杆件、端部边界与温度载荷示意">
        <defs>
          <marker id="axial-force-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#b64835" />
          </marker>
        </defs>
        <text x="410" y="28" text-anchor="middle">各杆段 ΔT、A、E 可独立输入</text>
        <g v-for="(_, index) in draft.segments" :key="`diagram-${index}`">
          <rect
            :x="140 + index * (540 / draft.segments.length)"
            y="70"
            :width="540 / draft.segments.length"
            height="42"
            :class="index % 2 ? 'segment alternate' : 'segment'"
          />
          <text
            :x="140 + (index + 0.5) * (540 / draft.segments.length)"
            y="96"
            text-anchor="middle"
          >段 {{ index + 1 }}</text>
        </g>
        <template v-if="draft.boundary === 'free'">
          <line
            v-if="Number(draft.axialForce.value) >= 0"
            x1="140" y1="91" x2="78" y2="91"
            class="force" marker-end="url(#axial-force-arrow)"
          />
          <line
            v-if="Number(draft.axialForce.value) >= 0"
            x1="680" y1="91" x2="742" y2="91"
            class="force" marker-end="url(#axial-force-arrow)"
          />
          <line
            v-if="Number(draft.axialForce.value) < 0"
            x1="78" y1="91" x2="134" y2="91"
            class="force" marker-end="url(#axial-force-arrow)"
          />
          <line
            v-if="Number(draft.axialForce.value) < 0"
            x1="742" y1="91" x2="686" y2="91"
            class="force" marker-end="url(#axial-force-arrow)"
          />
          <text x="66" y="78" text-anchor="middle">N</text><text x="754" y="78" text-anchor="middle">N</text>
        </template>
        <template v-else>
          <line x1="132" y1="48" x2="132" y2="134" class="wall" />
          <line x1="688" y1="48" x2="688" y2="134" class="wall" />
          <path d="M104 55l28-14m-28 30l28-14m-28 30l28-14m-28 30l28-14m-28 30l28-14 M688 41l28 14m-28 2l28 14m-28 2l28 14m-28 2l28 14m-28 2l28 14" class="hatch" />
        </template>
        <line x1="140" y1="145" x2="680" y2="145" class="dimension" />
        <text x="410" y="168" text-anchor="middle">总长度 L = ΣLi</text>
      </svg>
    </section>

    <section class="input-card" aria-labelledby="axial-input-title">
      <header class="card-heading">
        <div>
          <p>边界必须显式选择</p>
          <h3 id="axial-input-title">工况输入</h3>
        </div>
        <span>{{ draft.segments.length }} 个串联杆段</span>
      </header>

      <div class="boundary-grid">
        <label class="field">
          <span>端部边界</span>
          <select aria-label="端部边界" :value="draft.boundary" @change="changeBoundary">
            <option value="free">允许变形（轴力＋自由温变）</option>
            <option value="fullyRestrained">两端完全约束（仅温变）</option>
          </select>
        </label>
        <label v-if="draft.boundary === 'free'" class="field">
          <span>轴向力 N（拉＋ / 压−）</span>
          <div class="input-with-unit">
            <input
              aria-label="轴向力"
              :value="draft.axialForce.value"
              inputmode="decimal"
              @input="draft.axialForce.value = inputValue($event)"
            />
            <select aria-label="轴向力单位" :value="draft.axialForce.unit" @change="changeRootUnit">
              <option v-for="unit in units('force')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
            </select>
          </div>
        </label>
        <div v-else class="constraint-banner" role="note">
          <strong>完全约束温变</strong>
          <span>外加轴力输入已停用；结果给出约束反力、共同内力和各段约束应力。</span>
        </div>
      </div>
      <p class="boundary-note">{{ boundaryNote }}</p>

      <div class="segment-heading">
        <div>
          <h3>杆段参数</h3>
          <p>各段首尾串联，截面与材料可不同；界面传递同一轴力。</p>
        </div>
        <button type="button" class="secondary-button" @click="addSegment">＋ 添加杆段</button>
      </div>

      <div class="segment-list">
        <article v-for="(segment, index) in draft.segments" :key="segment.id" class="segment-card">
          <header>
            <strong>杆段 {{ index + 1 }}</strong>
            <button
              type="button"
              class="remove-button"
              :disabled="draft.segments.length <= 1"
              :aria-label="`删除杆段 ${index + 1}`"
              @click="removeSegment(index)"
            >删除</button>
          </header>
          <div class="segment-fields">
            <label class="field">
              <span>长度 L</span>
              <div class="input-with-unit">
                <input
                  :aria-label="`杆段 ${index + 1} 长度`"
                  :value="segmentValue(segment, 'length').value"
                  inputmode="decimal"
                  @input="updateSegmentValue(segment, 'length', $event)"
                />
                <select
                  :aria-label="`杆段 ${index + 1} 长度单位`"
                  :value="segment.length.unit"
                  @change="changeSegmentUnit(segment, 'length', $event)"
                >
                  <option v-for="unit in units('length')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
                </select>
              </div>
            </label>
            <label class="field">
              <span>截面积 A</span>
              <div class="input-with-unit">
                <input
                  :aria-label="`杆段 ${index + 1} 截面积`"
                  :value="segment.area.value"
                  inputmode="decimal"
                  @input="updateSegmentValue(segment, 'area', $event)"
                />
                <select
                  :aria-label="`杆段 ${index + 1} 截面积单位`"
                  :value="segment.area.unit"
                  @change="changeSegmentUnit(segment, 'area', $event)"
                >
                  <option v-for="unit in units('area')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
                </select>
              </div>
            </label>
            <label class="field">
              <span>弹性模量 E</span>
              <div class="input-with-unit">
                <input
                  :aria-label="`杆段 ${index + 1} 弹性模量`"
                  :value="segment.elasticModulus.value"
                  inputmode="decimal"
                  @input="updateSegmentValue(segment, 'elasticModulus', $event)"
                />
                <select
                  :aria-label="`杆段 ${index + 1} 弹性模量单位`"
                  :value="segment.elasticModulus.unit"
                  @change="changeSegmentUnit(segment, 'elasticModulus', $event)"
                >
                  <option v-for="unit in units('elasticModulus')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
                </select>
              </div>
            </label>
            <label class="field">
              <span>线膨胀系数 α</span>
              <div class="input-with-suffix">
                <input
                  :aria-label="`杆段 ${index + 1} 线膨胀系数`"
                  :value="segment.thermalExpansionMicroPerK"
                  inputmode="decimal"
                  @input="segment.thermalExpansionMicroPerK = inputValue($event)"
                />
                <span>10⁻⁶/K</span>
              </div>
            </label>
            <label class="field">
              <span>温差 ΔT（升温＋ / 降温−）</span>
              <div class="input-with-unit">
                <input
                  :aria-label="`杆段 ${index + 1} 温差`"
                  :value="segment.deltaTemperature.value"
                  inputmode="decimal"
                  @input="updateSegmentValue(segment, 'deltaTemperature', $event)"
                />
                <select
                  :aria-label="`杆段 ${index + 1} 温差单位`"
                  :value="segment.deltaTemperature.unit"
                  @change="changeSegmentUnit(segment, 'deltaTemperature', $event)"
                >
                  <option v-for="unit in units('temperatureDifference')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
                </select>
              </div>
            </label>
          </div>
        </article>
      </div>

      <div v-if="errors.length" class="error-summary" role="alert">
        <strong>本次计算未完成</strong>
        <ul><li v-for="message in errors" :key="message">{{ message }}</li></ul>
      </div>
      <button type="button" class="calculate-button" @click="calculate">计算轴向响应</button>
    </section>

    <section v-if="result" class="results-card" aria-labelledby="axial-results-title">
      <header class="result-heading">
        <div>
          <p>工程结论</p>
          <h3 id="axial-results-title">
            {{ result.boundary === 'free' ? `总长度变化 ${format(result.totalDeformationM, 1000)} mm` : `约束轴力 ${format(result.constraintForceN)} N` }}
          </h3>
        </div>
        <span :class="result.internalForceN > 0 ? 'tension' : result.internalForceN < 0 ? 'compression' : ''">
          {{ forceState(result.internalForceN) }}
        </span>
      </header>

      <div class="result-grid">
        <div><span>总长度</span><strong>{{ format(result.totalLengthM, 1000) }} mm</strong></div>
        <div><span>共同内力 N</span><strong>{{ format(result.internalForceN) }} N</strong></div>
        <div><span>机械变形</span><strong>{{ format(result.mechanicalDeformationM, 1000) }} mm</strong></div>
        <div><span>自由温变</span><strong>{{ format(result.freeThermalDeformationM, 1000) }} mm</strong></div>
        <div><span>总变形</span><strong data-testid="total-deformation">{{ format(result.totalDeformationM, 1000) }} mm</strong></div>
        <div v-if="result.boundary === 'fullyRestrained'"><span>约束轴力</span><strong data-testid="constraint-force">{{ format(result.constraintForceN) }} N</strong></div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>杆段</th><th>状态</th><th>应力 σ / MPa</th><th>机械应变 / με</th><th>温度应变 / με</th><th>段变形 / mm</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(segment, index) in result.segments" :key="segment.id">
              <td>{{ index + 1 }}</td>
              <td>{{ forceState(segment.internalForceN) }}</td>
              <td>{{ format(segment.stressPa, 1e-6) }}</td>
              <td>{{ format(segment.mechanicalStrain, 1e6) }}</td>
              <td>{{ format(segment.thermalStrain, 1e6) }}</td>
              <td>{{ format(segment.totalDeformationM, 1000) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="result.boundary === 'fullyRestrained'" class="compatibility-check">
        兼容校核：ΣΔL = {{ format(result.totalDeformationM, 1000, 3) }} mm（目标 0 mm）
      </p>
      <details class="formula-details">
        <summary>公式、符号与适用范围</summary>
        <div>
          <p>各段应力：σᵢ = N / Aᵢ；机械变形：ΔLₘ = Σ[N·Lᵢ/(EᵢAᵢ)]。</p>
          <p>自由温变：ΔLₜ = Σ(αᵢΔTᵢLᵢ)；完全约束：Nᶜ = −ΔLₜ / Σ[Lᵢ/(EᵢAᵢ)]。</p>
          <p>假设：直杆、同轴载荷、小变形、线弹性、各杆段内 A/E/α/ΔT 均匀；忽略自重、应力集中、局部连接变形与屈曲。</p>
        </div>
      </details>
    </section>

    <div v-else-if="!errors.length" class="result-placeholder">
      <strong>等待首次计算</strong>
      <span>确认边界、单位和各杆段参数后，点击“计算轴向响应”。</span>
    </div>
  </section>
</template>

<style scoped>
.axial-calculator { display: grid; gap: 22px; }
.intro-card, .axial-diagram, .input-card, .results-card { border: 1px solid var(--color-line, #d7e0e3); border-radius: 12px; background: var(--color-panel, #fff); }
.intro-card { display: flex; justify-content: space-between; gap: 24px; padding: 18px 22px; border-left: 4px solid var(--color-brand, #126a73); background: #f7faf9; }
.intro-card span, .card-heading > div > p, .result-heading p { color: var(--color-brand, #126a73); font-size: 11px; font-weight: 800; letter-spacing: .06em; }
.intro-card h2 { margin: 5px 0 7px; font-size: clamp(19px, 2vw, 25px); }
.intro-card p, .segment-heading p { margin: 0; color: #667881; font-size: 12px; line-height: 1.6; }
.intro-card > strong { flex: 0 0 auto; color: #72572d; font-size: 12px; }
.axial-diagram { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; align-items: center; padding: 14px 20px; overflow: hidden; }
.axial-diagram h3 { margin: 0 0 5px; font-size: 15px; }
.axial-diagram p { margin: 0; color: #667881; font-size: 11px; line-height: 1.55; }
.axial-diagram svg { display: block; width: 100%; min-width: 560px; height: auto; }
.axial-diagram text { fill: #53636e; font: 700 12px sans-serif; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.axial-diagram .segment { fill: #d9eeee; stroke: #126a73; stroke-width: 2; }
.axial-diagram .segment.alternate { fill: #eaf3dc; }
.axial-diagram .force { stroke: #b64835; stroke-width: 2.5; }
.axial-diagram .wall, .axial-diagram .hatch { fill: none; stroke: #126a73; stroke-width: 2.5; }
.axial-diagram .dimension { stroke: #9a5a18; stroke-width: 1.3; }
.input-card, .results-card { display: grid; gap: 18px; padding: 22px; box-shadow: var(--shadow-panel, 0 8px 24px rgb(20 45 50 / 8%)); }
.card-heading, .segment-heading, .segment-card > header, .result-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-heading p, .result-heading p { margin: 0 0 4px; }
.card-heading h3, .segment-heading h3, .result-heading h3 { margin: 0; color: #263e48; }
.card-heading > span { color: #667881; font-size: 12px; font-weight: 700; }
.boundary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.field { display: grid; gap: 6px; color: #53636e; font-size: 12px; font-weight: 700; }
.field > select { min-height: 42px; padding: 0 10px; border: 1px solid #cad5da; border-radius: 8px; background: #fff; }
.input-with-unit, .input-with-suffix { display: grid; grid-template-columns: minmax(0, 1fr) auto; overflow: hidden; border: 1px solid #cad5da; border-radius: 8px; background: #fff; }
.input-with-unit:focus-within, .input-with-suffix:focus-within { border-color: #126a73; box-shadow: 0 0 0 3px rgb(18 106 115 / 10%); }
.input-with-unit input, .input-with-suffix input { min-width: 0; min-height: 42px; padding: 0 10px; border: 0; outline: 0; }
.input-with-unit select { border: 0; border-left: 1px solid #e2e7e9; color: #667881; background: #f7f9fa; }
.input-with-suffix span { display: grid; place-items: center; padding: 0 10px; border-left: 1px solid #e2e7e9; color: #667881; background: #f7f9fa; }
.constraint-banner { display: grid; gap: 4px; padding: 10px 12px; border-left: 3px solid #b27b27; color: #6d552f; background: #fff8e8; font-size: 12px; }
.boundary-note { margin: -8px 0 0; padding: 9px 12px; color: #425e68; background: #eef5f5; font-size: 12px; }
.segment-heading { padding-top: 17px; border-top: 1px solid #dfe6e8; }
.secondary-button, .remove-button { min-height: 34px; padding: 0 11px; border: 1px solid #9dbdc1; border-radius: 7px; color: #125e66; background: #f1f8f8; cursor: pointer; }
.segment-list { display: grid; gap: 12px; }
.segment-card { display: grid; gap: 13px; padding: 15px; border: 1px solid #dce4e7; border-radius: 9px; background: #fbfcfc; }
.segment-card > header { color: #314c57; }
.remove-button { min-height: 28px; color: #9b4039; border-color: #d7aaa6; background: #fff5f3; }
.remove-button:disabled { cursor: not-allowed; opacity: .35; }
.segment-fields { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.error-summary { padding: 13px; border-radius: 8px; color: #8f342d; background: #fff0ed; }
.error-summary ul { margin: 7px 0 0; padding-left: 20px; }
.calculate-button { min-height: 46px; border: 0; border-radius: 8px; color: #fff; background: var(--color-brand, #126a73); cursor: pointer; font-weight: 800; }
.result-heading > span { padding: 5px 10px; border-radius: 999px; color: #52666e; background: #edf2f3; font-size: 12px; font-weight: 800; }
.result-heading > span.tension { color: #166050; background: #e5f5ef; }
.result-heading > span.compression { color: #9a3f37; background: #fff0ed; }
.result-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.result-grid > div { display: grid; gap: 5px; padding: 13px; border: 1px solid #e1e7e9; border-radius: 8px; background: #fafcfc; }
.result-grid span { color: #667881; font-size: 11px; }
.result-grid strong { color: #263e48; font-size: 16px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; min-width: 760px; border-collapse: collapse; font-size: 12px; }
th, td { padding: 10px; border-bottom: 1px solid #e0e6e8; text-align: right; }
th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
th { color: #5b6e76; background: #f5f8f8; }
.compatibility-check { margin: 0; padding: 10px 12px; color: #315e54; background: #edf8f4; font-size: 12px; }
.formula-details { border-top: 1px solid #dfe6e8; padding-top: 13px; color: #52666e; font-size: 12px; }
.formula-details summary { cursor: pointer; color: #31505c; font-weight: 800; }
.formula-details p { margin: 9px 0 0; line-height: 1.6; }
.result-placeholder { display: grid; gap: 5px; padding: 20px; border: 1px dashed #b8c8cd; border-radius: 10px; color: #667881; background: #f8fafb; text-align: center; }
@media (max-width: 1050px) { .segment-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 700px) {
  .intro-card, .card-heading, .segment-heading, .result-heading { align-items: stretch; flex-direction: column; }
  .boundary-grid, .segment-fields, .result-grid { grid-template-columns: 1fr; }
  .intro-card > strong { flex: auto; }
  .axial-diagram { grid-template-columns: 1fr; overflow-x: auto; }
}
</style>
