<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { formatEngineeringValue } from '../../core/numeric'
import {
  calculateSectionProperties,
  type SectionInput,
  type SectionKind,
  type SectionProperties,
} from '../../core/sections'
import {
  QUANTITY_CATALOG,
  convertFromSI,
  normalizeToSI,
  type QuantityId,
  type UnitId,
} from '../../core/units'
import SectionDiagram from './SectionDiagram.vue'

interface ShapeField {
  key: string
  coreField: string
  label: string
  symbol: string
}

interface ShapeOption {
  kind: SectionKind
  label: string
  fields: readonly ShapeField[]
  defaults: Readonly<Record<string, string>>
}

interface DisplayRow {
  label: string
  symbol: string
  value: string
  unit: string
}

const shapes: readonly ShapeOption[] = [
  {
    kind: 'rectangle',
    label: '矩形',
    fields: [
      { key: 'width', coreField: 'b', label: '宽度', symbol: 'b' },
      { key: 'height', coreField: 'h', label: '高度', symbol: 'h' },
    ],
    defaults: { width: '80', height: '120' },
  },
  {
    kind: 'hollowRectangle',
    label: '空心矩形',
    fields: [
      { key: 'outerWidth', coreField: 'B', label: '外宽', symbol: 'B' },
      { key: 'outerHeight', coreField: 'H', label: '外高', symbol: 'H' },
      { key: 'innerWidth', coreField: 'b', label: '内宽', symbol: 'b' },
      { key: 'innerHeight', coreField: 'h', label: '内高', symbol: 'h' },
    ],
    defaults: { outerWidth: '120', outerHeight: '80', innerWidth: '100', innerHeight: '60' },
  },
  {
    kind: 'solidCircle',
    label: '实心圆',
    fields: [{ key: 'diameter', coreField: 'd', label: '直径', symbol: 'd' }],
    defaults: { diameter: '50' },
  },
  {
    kind: 'circularTube',
    label: '圆管',
    fields: [
      { key: 'outerDiameter', coreField: 'D', label: '外径', symbol: 'D' },
      { key: 'innerDiameter', coreField: 'd', label: '内径', symbol: 'd' },
    ],
    defaults: { outerDiameter: '60', innerDiameter: '40' },
  },
] as const

const fallbackShape = shapes[0]!

const selectedKind = ref<SectionKind>('rectangle')
const fieldValues = ref<Record<string, string>>({ ...fallbackShape.defaults })
const fieldUnits = ref<Record<string, UnitId>>(
  Object.fromEntries(fallbackShape.fields.map((field) => [field.key, 'mm'])),
)
const errors = ref<Readonly<Record<string, string>>>({})
const properties = ref<SectionProperties | null>(null)
const hasCalculated = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const selectedShape = computed(
  () => shapes.find((shape) => shape.kind === selectedKind.value) ?? fallbackShape,
)

const errorSummary = computed(() => [...new Set(Object.values(errors.value))])

const modelLabel = computed(() => {
  switch (properties.value?.torsionModel) {
    case 'rectangle-engineering-approximation':
      return '矩形 Saint-Venant 扭转常数工程近似；Jp 与 Jt 含义不同。'
    case 'thin-walled-closed-section-midline':
      return '等壁厚薄壁闭口截面中线模型；不适用于厚壁或不等壁厚输入。'
    case 'circular-exact':
      return '圆截面精确关系；该截面 Jp = Jt。'
    default:
      return ''
  }
})

const resultRows = computed<DisplayRow[]>(() => {
  const value = properties.value
  if (!value) return []

  return [
    display('面积', 'A', value.areaM2, 'area', 'mm2', 'mm²'),
    display('形心横坐标', 'x̄', value.centroidM.x, 'length', 'mm', 'mm'),
    display('形心纵坐标', 'ȳ', value.centroidM.y, 'length', 'mm', 'mm'),
    display('x 轴截面二次矩', 'Ix', value.ixM4, 'secondMomentOfArea', 'mm4', 'mm⁴'),
    display('y 轴截面二次矩', 'Iy', value.iyM4, 'secondMomentOfArea', 'mm4', 'mm⁴'),
    display('惯性积', 'Ixy', value.ixyM4, 'secondMomentOfArea', 'mm4', 'mm⁴'),
    display('x 正侧截面模量', 'Wx+', value.sectionModuli.xPositiveM3, 'sectionModulus', 'mm3', 'mm³'),
    display('x 负侧截面模量', 'Wx−', value.sectionModuli.xNegativeM3, 'sectionModulus', 'mm3', 'mm³'),
    display('y 正侧截面模量', 'Wy+', value.sectionModuli.yPositiveM3, 'sectionModulus', 'mm3', 'mm³'),
    display('y 负侧截面模量', 'Wy−', value.sectionModuli.yNegativeM3, 'sectionModulus', 'mm3', 'mm³'),
    display('极惯性矩', 'Jp', value.polarMomentM4, 'secondMomentOfArea', 'mm4', 'mm⁴'),
    display('扭转常数', 'Jt', value.torsionConstantM4, 'secondMomentOfArea', 'mm4', 'mm⁴'),
  ]
})

function display(
  label: string,
  symbol: string,
  value: number,
  quantity: QuantityId,
  unit: UnitId,
  unitLabel: string,
): DisplayRow {
  return {
    label,
    symbol,
    value: formatEngineeringValue(convertFromSI(value, quantity, unit)),
    unit: unitLabel,
  }
}

function lengthToSI(key: string): number {
  const raw = fieldValues.value[key]
  if (raw?.trim() === '' || raw === undefined) {
    throw new InputFieldError(key, '请输入有限数值')
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new InputFieldError(key, '请输入有限数值')
  return normalizeToSI(parsed, 'length', fieldUnits.value[key] ?? 'mm')
}

class InputFieldError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'InputFieldError'
  }
}

function buildInput(): SectionInput {
  switch (selectedKind.value) {
    case 'rectangle':
      return { kind: 'rectangle', widthM: lengthToSI('width'), heightM: lengthToSI('height') }
    case 'hollowRectangle':
      return {
        kind: 'hollowRectangle',
        outerWidthM: lengthToSI('outerWidth'),
        outerHeightM: lengthToSI('outerHeight'),
        innerWidthM: lengthToSI('innerWidth'),
        innerHeightM: lengthToSI('innerHeight'),
      }
    case 'solidCircle':
      return { kind: 'solidCircle', diameterM: lengthToSI('diameter') }
    case 'circularTube':
      return {
        kind: 'circularTube',
        outerDiameterM: lengthToSI('outerDiameter'),
        innerDiameterM: lengthToSI('innerDiameter'),
      }
  }
}

function calculate(): void {
  let calculation: ReturnType<typeof calculateSectionProperties>
  try {
    calculation = calculateSectionProperties(buildInput())
  } catch (error) {
    errors.value = error instanceof InputFieldError
      ? { [error.field]: error.message }
      : { geometry: error instanceof Error ? error.message : '截面输入无效' }
    properties.value = null
    return
  }

  if (!calculation.ok) {
    errors.value = Object.fromEntries(
      calculation.errors.map((error) => {
        const field = selectedShape.value.fields.find((item) => item.coreField === error.field)
        return [field?.key ?? error.field, error.message]
      }),
    )
    properties.value = null
    return
  }

  errors.value = {}
  properties.value = calculation.value
  hasCalculated.value = true
}

function selectShape(shape: ShapeOption): void {
  selectedKind.value = shape.kind
  fieldValues.value = { ...shape.defaults }
  fieldUnits.value = Object.fromEntries(shape.fields.map((field) => [field.key, 'mm']))
  errors.value = {}
  properties.value = null
  hasCalculated.value = false
}

function clearFieldAfterUnitChange(key: string): void {
  fieldValues.value[key] = ''
  errors.value = {}
  properties.value = null
}

watch(
  fieldValues,
  () => {
    if (!hasCalculated.value) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(calculate, 300)
  },
  { deep: true },
)

onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <section class="section-calculator" aria-labelledby="section-calculator-title">
    <div class="panel-header">
      <div>
        <p class="panel-kicker">首款计算器 · 截面模块</p>
        <h2 id="section-calculator-title">常用截面性质</h2>
        <p>尺寸默认采用 mm，也可逐字段选单位；内核计算前统一转换为 SI。</p>
      </div>
      <span class="coordinate-chip">x 向右 · y 向上</span>
    </div>

    <div class="shape-tabs" role="tablist" aria-label="截面类型">
      <button
        v-for="shape in shapes"
        :key="shape.kind"
        type="button"
        role="tab"
        :aria-selected="selectedKind === shape.kind"
        :class="{ 'is-active': selectedKind === shape.kind }"
        @click="selectShape(shape)"
      >
        {{ shape.label }}
      </button>
    </div>

    <div class="section-workspace">
      <div class="input-column">
        <div class="diagram-card">
          <SectionDiagram :kind="selectedKind" />
          <p>示意图仅说明尺寸与坐标，不按输入比例绘制。</p>
        </div>

        <div class="field-grid">
          <label v-for="field in selectedShape.fields" :key="field.key" class="field">
            <span>{{ field.label }} {{ field.symbol }}</span>
            <div class="input-with-unit" :class="{ 'has-error': errors[field.key] }">
              <input
                v-model="fieldValues[field.key]"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                :aria-invalid="Boolean(errors[field.key])"
              />
              <select
                v-model="fieldUnits[field.key]"
                :aria-label="`${field.label}单位`"
                @change="clearFieldAfterUnitChange(field.key)"
              >
                <option
                  v-for="unit in QUANTITY_CATALOG.length.units"
                  :key="unit.id"
                  :value="unit.id"
                >
                  {{ unit.symbol }}
                </option>
              </select>
            </div>
            <small v-if="errors[field.key]" class="field-error">{{ errors[field.key] }}</small>
          </label>
        </div>

        <div v-if="errorSummary.length" class="error-summary" role="alert">
          <strong>请检查输入</strong>
          <span v-for="message in errorSummary" :key="message">{{ message }}</span>
        </div>

        <button class="calculate-button" type="button" @click="calculate">
          计算截面性质
        </button>
      </div>

      <div class="result-column" aria-live="polite">
        <template v-if="properties">
          <div class="result-header">
            <div>
              <span>计算结果</span>
              <h3>{{ selectedShape.label }}</h3>
            </div>
            <span class="result-status">已计算</span>
          </div>

          <div class="result-grid">
            <div v-for="row in resultRows" :key="row.symbol" class="result-item">
              <span>{{ row.label }}</span>
              <div>
                <strong>{{ row.symbol }} = {{ row.value }}</strong>
                <small>{{ row.unit }}</small>
              </div>
            </div>
          </div>

          <div class="model-note">
            <strong>扭转模型</strong>
            <p>{{ modelLabel }}</p>
          </div>
        </template>

        <div v-else class="empty-result">
          <span class="empty-symbol">Ix</span>
          <strong>等待计算</strong>
          <p>确认截面尺寸单位后点击“计算截面性质”。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-calculator {
  padding: clamp(22px, 3vw, 32px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-large);
  background: var(--color-panel);
  box-shadow: var(--shadow-panel);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.panel-kicker {
  margin-bottom: 7px;
  color: var(--color-brand);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.panel-header h2 {
  margin-bottom: 7px;
  font-size: 22px;
}

.panel-header p:last-child {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
}

.coordinate-chip {
  flex: 0 0 auto;
  padding: 7px 10px;
  border-radius: 7px;
  color: var(--color-brand-deep);
  background: var(--color-brand-soft);
  font-size: 12px;
  font-weight: 700;
}

.shape-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin: 24px 0 18px;
  padding-bottom: 2px;
}

.shape-tabs button {
  flex: 0 0 auto;
  min-width: 96px;
  padding: 9px 13px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  color: #53636e;
  background: #f7f9fa;
  cursor: pointer;
}

.shape-tabs button.is-active {
  border-color: var(--color-brand);
  color: #fff;
  background: var(--color-brand);
}

.section-workspace {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(400px, 1.2fr);
  gap: 20px;
}

.input-column,
.result-column {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: #fbfcfc;
}

.diagram-card {
  margin-bottom: 18px;
  padding: 10px 14px 8px;
  border-radius: 10px;
  background: #f1f6f6;
}

.diagram-card p {
  margin: 0;
  color: var(--color-muted);
  font-size: 11px;
  text-align: center;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.field {
  display: grid;
  gap: 6px;
  color: #53636e;
  font-size: 12px;
  font-weight: 700;
}

.input-with-unit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border: 1px solid #cad5da;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.input-with-unit:focus-within {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px rgb(18 106 115 / 10%);
}

.input-with-unit.has-error {
  border-color: #c6574e;
}

.input-with-unit input {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 0 10px;
  border: 0;
  outline: 0;
}

.input-with-unit select {
  align-self: stretch;
  padding: 0 8px;
  border: 0;
  border-left: 1px solid #e2e7e9;
  color: var(--color-muted);
  background: #f7f9fa;
  outline: none;
  color: var(--color-muted);
  font-size: 11px;
}

.field-error {
  color: #a23b34;
  line-height: 1.4;
}

.error-summary {
  display: grid;
  gap: 4px;
  margin-top: 14px;
  padding: 11px 13px;
  border-radius: 8px;
  color: #8f342d;
  background: #fff0ed;
  font-size: 12px;
}

.calculate-button {
  width: 100%;
  min-height: 44px;
  margin-top: 17px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: var(--color-brand);
  cursor: pointer;
  font-weight: 800;
}

.calculate-button:hover {
  background: var(--color-brand-deep);
}

.result-column {
  display: flex;
  flex-direction: column;
}

.result-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
}

.result-header span:first-child {
  color: var(--color-muted);
  font-size: 11px;
}

.result-header h3 {
  margin: 3px 0 0;
  font-size: 18px;
}

.result-status {
  padding: 5px 8px;
  border-radius: 999px;
  color: var(--color-success);
  background: #e7f5ec;
  font-size: 11px;
  font-weight: 800;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 9px;
  background: var(--color-line);
}

.result-item {
  min-width: 0;
  padding: 12px;
  background: #fff;
}

.result-item > span {
  display: block;
  margin-bottom: 5px;
  color: var(--color-muted);
  font-size: 10px;
}

.result-item div {
  display: flex;
  gap: 5px;
  align-items: baseline;
}

.result-item strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.result-item small {
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: 10px;
}

.model-note {
  margin-top: 14px;
  padding: 12px 14px;
  border-left: 3px solid var(--color-accent);
  color: #60472d;
  background: #fff8ee;
}

.model-note strong {
  font-size: 11px;
}

.model-note p {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.55;
}

.empty-result {
  flex: 1;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: var(--color-muted);
  text-align: center;
}

.empty-symbol {
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  border-radius: 50%;
  color: var(--color-brand);
  background: var(--color-brand-soft);
  font-size: 19px;
  font-weight: 800;
}

.empty-result p {
  max-width: 280px;
  margin: 7px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1050px) {
  .section-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 580px) {
  .panel-header {
    flex-direction: column;
  }

  .field-grid,
  .result-grid {
    grid-template-columns: 1fr;
  }

  .input-column,
  .result-column {
    padding: 14px;
  }
}
</style>
