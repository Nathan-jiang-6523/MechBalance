<script setup lang="ts">
import { computed, ref } from 'vue'
import MathFormula from '../../components/MathFormula.vue'
import {
  calculateEulerBuckling,
  COLUMN_END_CONDITIONS,
  type ColumnEndCondition,
} from '../../core/buckling'
import {
  calculateSectionProperties,
  type SectionInput,
  type SectionKind,
} from '../../core/sections'
import { evaluateNumericExpression, formatEngineeringValue } from '../../core/numeric'
import { normalizeToSI, convertFromSI, QUANTITY_CATALOG, type UnitId } from '../../core/units'

const BUCKLING_FORMULAS = [
  String.raw`i=\sqrt{\frac{I}{A}},\qquad \lambda=\frac{KL}{i}`,
  String.raw`P_{\mathrm{cr}}=\frac{\pi^2EI}{(KL)^2},\qquad \sigma_{\mathrm{cr}}=\frac{P_{\mathrm{cr}}}{A}`,
]

const elasticModulus = ref('200000')
const elasticModulusUnit = ref<UnitId>('MPa')
const length = ref('2000')
const lengthUnit = ref<UnitId>('mm')
const endCondition = ref<ColumnEndCondition>('pinnedPinned')
const sectionKind = ref<SectionKind>('rectangle')
const dimensions = ref<Record<string, string>>({ width: '30', height: '60' })
const dimensionUnit = ref<UnitId>('mm')
const slendernessLimit = ref('')
const submitted = ref(false)

const sectionDefinitions = [
  { id: 'rectangle', label: '矩形' },
  { id: 'hollowRectangle', label: '空心矩形' },
  { id: 'solidCircle', label: '实心圆' },
  { id: 'circularTube', label: '圆管' },
] as const

const SECTION_FIELDS = {
  rectangle: [['width', '宽度 b'], ['height', '高度 h']],
  hollowRectangle: [['outerWidth', '外宽 B'], ['outerHeight', '外高 H'], ['innerWidth', '内宽 b'], ['innerHeight', '内高 h']],
  solidCircle: [['diameter', '直径 d']],
  circularTube: [['outerDiameter', '外径 D'], ['innerDiameter', '内径 d']],
} as const satisfies Readonly<Record<SectionKind, readonly (readonly [string, string])[]>>

const fields = computed(() => SECTION_FIELDS[sectionKind.value])

function resetDimensions(): void {
  dimensions.value = sectionKind.value === 'rectangle'
    ? { width: '30', height: '60' }
    : sectionKind.value === 'hollowRectangle'
      ? { outerWidth: '60', outerHeight: '80', innerWidth: '48', innerHeight: '68' }
      : sectionKind.value === 'solidCircle'
        ? { diameter: '50' }
        : { outerDiameter: '60', innerDiameter: '48' }
}

function changeLengthUnit(): void { length.value = '' }
function changeElasticModulusUnit(): void { elasticModulus.value = '' }
function changeDimensionUnit(): void {
  dimensions.value = Object.fromEntries(Object.keys(dimensions.value).map((key) => [key, '']))
}

function dimensionMetres(key: string): number {
  return normalizeToSI(
    evaluateNumericExpression(dimensions.value[key] ?? ''),
    'length',
    dimensionUnit.value,
  )
}

function sectionInput(): SectionInput {
  if (sectionKind.value === 'rectangle') return { kind: 'rectangle', widthM: dimensionMetres('width'), heightM: dimensionMetres('height') }
  if (sectionKind.value === 'hollowRectangle') return {
    kind: 'hollowRectangle', outerWidthM: dimensionMetres('outerWidth'), outerHeightM: dimensionMetres('outerHeight'),
    innerWidthM: dimensionMetres('innerWidth'), innerHeightM: dimensionMetres('innerHeight'),
  }
  if (sectionKind.value === 'solidCircle') return { kind: 'solidCircle', diameterM: dimensionMetres('diameter') }
  return { kind: 'circularTube', outerDiameterM: dimensionMetres('outerDiameter'), innerDiameterM: dimensionMetres('innerDiameter') }
}

const calculation = computed(() => {
  try {
    const section = calculateSectionProperties(sectionInput())
    if (!section.ok) return { ok: false as const, errors: section.errors.map(({ message }) => message) }
    const limitText = slendernessLimit.value.trim()
    return calculateEulerBuckling({
      elasticModulusPa: normalizeToSI(
        evaluateNumericExpression(elasticModulus.value),
        'elasticModulus',
        elasticModulusUnit.value,
      ),
      lengthM: normalizeToSI(
        evaluateNumericExpression(length.value),
        'length',
        lengthUnit.value,
      ),
      areaM2: section.value.areaM2,
      ixM4: section.value.ixM4,
      iyM4: section.value.iyM4,
      endCondition: endCondition.value,
      ...(limitText ? { slendernessLimit: evaluateNumericExpression(limitText) } : {}),
    })
  } catch (error) {
    return {
      ok: false as const,
      errors: [error instanceof Error ? error.message : '请输入数值或算式'],
    }
  }
})

const result = computed(() => submitted.value && calculation.value.ok ? calculation.value.value : null)
const errors = computed(() => submitted.value && !calculation.value.ok ? calculation.value.errors : [])
const k = computed(() => COLUMN_END_CONDITIONS.find(({ id }) => id === endCondition.value)?.effectiveLengthFactor ?? 1)

function calculate(): void { submitted.value = true }
</script>

<template>
  <section class="buckling-calculator" aria-labelledby="buckling-title">
    <header>
      <div><p>P1 · 稳定性初算</p><h2 id="buckling-title">欧拉压杆稳定及长细比</h2></div>
      <strong>mm · N · MPa</strong>
    </header>

    <div class="buckling-layout">
      <div class="input-panel">
        <label><span>端部约束（必须选择）</span><select v-model="endCondition">
          <option v-for="item in COLUMN_END_CONDITIONS" :key="item.id" :value="item.id">{{ item.label }}，K={{ item.effectiveLengthFactor }}</option>
        </select></label>
        <label><span>杆件长度 L</span><div class="unit-input"><input v-model="length" inputmode="decimal" /><select v-model="lengthUnit" aria-label="压杆长度单位" @change="changeLengthUnit"><option v-for="unit in QUANTITY_CATALOG.length.units" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option></select></div></label>
        <label><span>弹性模量 E</span><div class="unit-input"><input v-model="elasticModulus" inputmode="decimal" /><select v-model="elasticModulusUnit" aria-label="压杆弹性模量单位" @change="changeElasticModulusUnit"><option v-for="unit in QUANTITY_CATALOG.elasticModulus.units" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option></select></div></label>
        <label><span>截面类型</span><select v-model="sectionKind" @change="resetDimensions">
          <option v-for="item in sectionDefinitions" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select></label>
        <div class="dimension-grid">
          <label v-for="field in fields" :key="field[0]"><span>{{ field[1] }}</span><div class="unit-input"><input v-model="dimensions[field[0]]" inputmode="decimal" /><select v-model="dimensionUnit" :aria-label="`${field[1]}单位`" @change="changeDimensionUnit"><option v-for="unit in QUANTITY_CATALOG.length.units" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option></select></div></label>
        </div>
        <label><span>项目长细比阈值 λlim（可留空）</span><input v-model="slendernessLimit" inputmode="decimal" placeholder="由采用的规范或项目输入" /></label>
        <p class="threshold-note">不内置通用阈值；留空时只计算，不替你静默选择规范。</p>
        <button type="button" @click="calculate">计算稳定性</button>
      </div>

      <div class="schematic" aria-label="压杆端部约束示意">
        <span>K = {{ k }}</span>
        <svg viewBox="0 0 260 350" role="img" aria-label="欧拉压杆示意图">
          <line x1="130" y1="55" x2="130" y2="295" class="column" />
          <path d="M130 90 l-12 -22 h24z" class="arrow" />
          <text x="148" y="84">P</text>
          <g v-if="endCondition === 'fixedFree' || endCondition === 'fixedFixed' || endCondition === 'fixedPinned'">
            <line x1="95" y1="300" x2="165" y2="300" class="support" />
            <path d="M100 300l-10 14m25-14l-10 14m25-14l-10 14m25-14l-10 14m25-14l-10 14" class="hatch" />
          </g>
          <path v-else d="M130 295l-22 28h44z" class="pin" />
          <line v-if="endCondition === 'fixedFixed'" x1="95" y1="50" x2="165" y2="50" class="support" />
          <path v-if="endCondition === 'pinnedPinned' || endCondition === 'fixedPinned'" d="M130 55l-22-28h44z" class="pin" />
          <text x="130" y="340" text-anchor="middle">Le = K·L</text>
        </svg>
      </div>
    </div>

    <div v-if="errors.length" class="error" role="alert"><strong>输入有误</strong><ul><li v-for="message in errors" :key="message">{{ message }}</li></ul></div>

    <section v-if="result" class="results" aria-labelledby="buckling-results">
      <div class="result-heading"><h3 id="buckling-results">控制结论</h3><span :class="result.assessment.status">{{ result.assessment.message }}</span></div>
      <div class="result-grid">
        <article><span>控制弱轴</span><strong>{{ result.controllingAxis }} 轴</strong></article>
        <article><span>有效长度 Le</span><strong>{{ formatEngineeringValue(convertFromSI(result.effectiveLengthM, 'length', 'mm')) }} mm</strong></article>
        <article><span>控制长细比 λ</span><strong>{{ formatEngineeringValue(result.controllingSlenderness) }}</strong></article>
        <article><span>欧拉临界载荷 Pcr</span><strong>{{ formatEngineeringValue(convertFromSI(result.criticalLoadN, 'force', 'kN')) }} kN</strong></article>
        <article><span>欧拉临界应力 σcr</span><strong>{{ formatEngineeringValue(convertFromSI(result.criticalStressPa, 'stress', 'MPa')) }} MPa</strong></article>
        <article><span>回转半径 rx / ry</span><strong>{{ formatEngineeringValue(convertFromSI(result.radiusXMetres, 'length', 'mm')) }} / {{ formatEngineeringValue(convertFromSI(result.radiusYMetres, 'length', 'mm')) }} mm</strong></article>
        <article><span>长细比 λx / λy</span><strong>{{ formatEngineeringValue(result.slendernessX) }} / {{ formatEngineeringValue(result.slendernessY) }}</strong></article>
        <article><span>控制回转半径 i</span><strong>{{ formatEngineeringValue(convertFromSI(result.controllingRadiusM, 'length', 'mm')) }} mm</strong></article>
      </div>
      <div class="warning">欧拉解仅适用于理想直杆、轴心受压、线弹性和小挠度屈曲。初弯曲、偏心、残余应力、材料屈服及规范折减未计入。</div>
      <details>
        <summary>公式与版本</summary>
        <MathFormula v-for="formula in BUCKLING_FORMULAS" :key="formula" :formula="formula" />
        <p>版本：P1-BUCKLING-EULER-v1。</p>
      </details>
    </section>
  </section>
</template>

<style scoped>
.buckling-calculator{display:grid;gap:20px}.buckling-calculator>header{display:flex;justify-content:space-between;gap:20px;padding:20px 22px;border:1px solid var(--color-line);border-left:4px solid var(--color-brand);border-radius:12px;background:#f7faf9}.buckling-calculator header p{margin:0 0 5px;color:var(--color-brand);font-size:11px;font-weight:800}.buckling-calculator h2{margin:0;font-size:24px}.buckling-calculator header strong{color:#72572d;font-size:12px}.buckling-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px}.input-panel,.schematic,.results{padding:20px;border:1px solid var(--color-line);border-radius:var(--radius-large);background:var(--color-panel);box-shadow:var(--shadow-panel)}.input-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.input-panel label{display:grid;gap:6px;color:#53636e;font-size:12px;font-weight:700}.input-panel input,.input-panel select{min-width:0;min-height:42px;padding:0 10px;border:1px solid #cad5da;border-radius:8px;background:#fff}.unit-input{display:grid;grid-template-columns:1fr auto;border:1px solid #cad5da;border-radius:8px;overflow:hidden}.unit-input input{border:0}.unit-input b{display:grid;place-items:center;padding:0 10px;border-left:1px solid #e2e7e9;color:#667881;background:#f7f9fa;font-size:11px}.dimension-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;grid-column:1/-1}.threshold-note{grid-column:1/-1;margin:0;color:var(--color-muted);font-size:11px}.input-panel button{grid-column:1/-1;min-height:44px;border:0;border-radius:8px;color:#fff;background:var(--color-brand);font-weight:800;cursor:pointer}.schematic{position:relative;text-align:center}.schematic>span{position:absolute;right:16px;top:14px;color:#8a5a21;font-weight:800}.schematic svg{width:100%;max-height:360px}.column{stroke:#17636b;stroke-width:7}.arrow{fill:#b64835}.support,.hatch,.pin{fill:none;stroke:#17636b;stroke-width:2}.pin{fill:#d9eeee}.schematic text{fill:#53636e;font:700 13px sans-serif}.error{padding:15px 18px;border-radius:9px;color:#8f342d;background:#fff0ed}.error ul{margin:6px 0 0}.result-heading{display:flex;justify-content:space-between;gap:16px;align-items:center}.result-heading h3{margin:0}.result-heading span{padding:8px 10px;border-radius:8px;font-size:12px}.meetsLimit{color:#25613d;background:#e7f5ec}.belowLimit{color:#923e36;background:#fff0ed}.notAssessed{color:#76551e;background:#fff7df}.result-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-top:15px;border:1px solid var(--color-line);border-radius:9px;overflow:hidden;background:var(--color-line)}.result-grid article{padding:13px;background:#fff}.result-grid span{display:block;margin-bottom:5px;color:var(--color-muted);font-size:10px}.result-grid strong{font-size:13px}.warning{margin-top:14px;padding:12px;border-left:3px solid #c37a20;color:#73511e;background:#fff8e9;font-size:11px;line-height:1.55}.results details{margin-top:12px;color:#53636e;font-size:11px}.results details p{line-height:1.6}@media(max-width:900px){.buckling-layout{grid-template-columns:1fr}.schematic{display:none}.result-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.buckling-calculator>header{flex-direction:column}.input-panel,.dimension-grid,.result-grid{grid-template-columns:1fr}}
.unit-input select{min-height:42px;padding:0 8px;border:0;border-left:1px solid #e2e7e9;border-radius:0;color:#667881;background:#f7f9fa;font-size:11px}
</style>
