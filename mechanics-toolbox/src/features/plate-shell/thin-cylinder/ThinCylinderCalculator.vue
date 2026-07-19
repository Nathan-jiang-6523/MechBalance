<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  solveThinCylinder,
  type ThinCylinderEndCondition,
  type ThinCylinderResult,
} from '../../../core/plate-shell'
import { evaluateNumericExpression } from '../../../core/numeric'
import {
  convertPresetValue,
  getPresetUnit,
  getUnitDefinition,
  normalizeToSI,
  type QuantityId,
  type UnitPresetId,
} from '../../../core/units'
import ThinCylinderDiagram from './ThinCylinderDiagram.vue'
import ThinCylinderResults from './ThinCylinderResults.vue'

type DraftField = 'meanRadius' | 'thickness' | 'elasticModulus' | 'poissonRatio'
  | 'internalPressure' | 'externalPressure' | 'axialForce' | 'torque'

interface DraftState extends Record<DraftField, string> {
  boundary: ThinCylinderEndCondition | null
}

const DEFAULT_DRAFT: DraftState = {
  boundary: null,
  meanRadius: '1000',
  thickness: '10',
  elasticModulus: '200000',
  poissonRatio: '0.3',
  internalPressure: '2',
  externalPressure: '0',
  axialForce: '0',
  torque: '0',
}

const UNIT_FIELDS: ReadonlyArray<readonly [DraftField, QuantityId]> = [
  ['meanRadius', 'length'],
  ['thickness', 'length'],
  ['elasticModulus', 'elasticModulus'],
  ['internalPressure', 'pressure'],
  ['externalPressure', 'pressure'],
  ['axialForce', 'force'],
  ['torque', 'torque'],
]

const draft = reactive<DraftState>({ ...DEFAULT_DRAFT })
const unitPreset = ref<UnitPresetId>('engineering')
const materialPreset = ref<'manual' | 'spcc' | 'al-6061'>('manual')
const result = ref<ThinCylinderResult | null>(null)
const errors = ref<string[]>([])

const unitLabels = computed(() => ({
  length: symbol('length'),
  elasticModulus: symbol('elasticModulus'),
  pressure: symbol('pressure'),
  force: symbol('force'),
  torque: symbol('torque'),
}))

function symbol(quantity: QuantityId): string {
  const unit = getPresetUnit(quantity, unitPreset.value)
  return getUnitDefinition(quantity, unit).symbol
}

function invalidate(): void {
  result.value = null
  errors.value = []
}

function displayNumber(value: number): string {
  return String(Number(value.toPrecision(12)))
}

function switchUnits(next: UnitPresetId): void {
  if (next === unitPreset.value) return
  const current = unitPreset.value
  for (const [field, quantity] of UNIT_FIELDS) {
    if (draft[field].trim() === '') continue
    try {
      const value = evaluateNumericExpression(draft[field])
      const converted = convertPresetValue(value, quantity, current, next)
      if (converted !== null) draft[field] = displayNumber(converted)
    } catch {
      // Keep invalid draft text verbatim; never silently coerce it.
    }
  }
  unitPreset.value = next
}

function applyMaterialPreset(): void {
  if (materialPreset.value === 'manual') return
  const material = materialPreset.value === 'spcc'
    ? { elasticModulusPa: 205e9, poissonRatio: 0.3 }
    : { elasticModulusPa: 69e9, poissonRatio: 0.33 }
  const unit = getPresetUnit('elasticModulus', unitPreset.value)
  draft.elasticModulus = displayNumber(getUnitDefinition('elasticModulus', unit).fromSI(material.elasticModulusPa))
  draft.poissonRatio = String(material.poissonRatio)
  invalidate()
}

function parse(field: DraftField, label: string): number {
  try {
    return evaluateNumericExpression(draft[field])
  } catch (error) {
    throw new Error(`${label}：${error instanceof Error ? error.message : '输入无效'}`)
  }
}

function toSI(field: DraftField, label: string, quantity: QuantityId): number {
  const value = parse(field, label)
  return normalizeToSI(value, quantity, getPresetUnit(quantity, unitPreset.value))
}

function calculate(): void {
  result.value = null
  errors.value = []
  try {
    if (!draft.boundary) throw new Error('必须显式选择端面压力传力状态')
    result.value = solveThinCylinder({
      calculatorId: 'thin-cylinder',
      boundary: draft.boundary,
      geometry: {
        kind: 'thin-cylinder',
        meanRadiusM: toSI('meanRadius', '中面半径', 'length'),
        thicknessM: toSI('thickness', '厚度', 'length'),
      },
      material: {
        elasticModulusPa: toSI('elasticModulus', '弹性模量', 'elasticModulus'),
        poissonRatio: parse('poissonRatio', '泊松比'),
      },
      load: {
        internalPressurePa: toSI('internalPressure', '内压', 'pressure'),
        externalPressurePa: toSI('externalPressure', '外压', 'pressure'),
        axialForceN: toSI('axialForce', '轴力', 'force'),
        torqueNm: toSI('torque', '扭矩', 'torque'),
      },
    })
  } catch (error) {
    errors.value = [error instanceof Error ? error.message : '薄壁圆筒计算失败']
  }
}

function reset(): void {
  Object.assign(draft, DEFAULT_DRAFT)
  unitPreset.value = 'engineering'
  materialPreset.value = 'manual'
  result.value = null
  errors.value = []
}
</script>

<template>
  <section class="calculator" aria-labelledby="thin-cylinder-title">
    <header class="calculator-heading">
      <div>
        <p>P3 · Gate P3-1A</p>
        <h2 id="thin-cylinder-title">薄壁圆筒膜应力</h2>
        <span>中面半径；拉为正；内外压为非负幅值；内部统一使用 SI。</span>
      </div>
      <div class="unit-presets" role="group" aria-label="单位制">
        <button type="button" :aria-pressed="unitPreset === 'engineering'" :class="{ active: unitPreset === 'engineering' }" @click="switchUnits('engineering')">t–mm–s–N–MPa</button>
        <button type="button" :aria-pressed="unitPreset === 'si'" :class="{ active: unitPreset === 'si' }" @click="switchUnits('si')">SI（kg–m–s–N–Pa）</button>
      </div>
    </header>

    <div class="workspace-grid">
      <form class="input-panel" @submit.prevent="calculate">
        <fieldset class="full-width boundary-fieldset">
          <legend>1. 端面压力传力状态（必选）</legend>
          <label><input v-model="draft.boundary" type="radio" value="open" @change="invalidate" />开口 / 无承压端盖</label>
          <label><input v-model="draft.boundary" type="radio" value="closed" @change="invalidate" />封闭承压端盖</label>
        </fieldset>

        <h3 class="full-width">2. 几何</h3>
        <label><span>中面半径 rₘ</span><div class="unit-input"><input v-model="draft.meanRadius" aria-label="中面半径" inputmode="decimal" @input="invalidate" /><b>{{ unitLabels.length }}</b></div></label>
        <label><span>厚度 t</span><div class="unit-input"><input v-model="draft.thickness" aria-label="厚度" inputmode="decimal" @input="invalidate" /><b>{{ unitLabels.length }}</b></div></label>

        <h3 class="full-width">3. 材料</h3>
        <label class="full-width"><span>材料预设</span><select v-model="materialPreset" aria-label="薄壁圆筒材料预设" @change="applyMaterialPreset"><option value="manual">手工 / 验收基准</option><option value="spcc">SPCC 名义值</option><option value="al-6061">AL 6061-T6 名义值</option></select></label>
        <label><span>弹性模量 E</span><div class="unit-input"><input v-model="draft.elasticModulus" aria-label="薄壁圆筒弹性模量" inputmode="decimal" @input="materialPreset = 'manual'; invalidate()" /><b>{{ unitLabels.elasticModulus }}</b></div></label>
        <label><span>泊松比 ν</span><div class="unit-input"><input v-model="draft.poissonRatio" aria-label="薄壁圆筒泊松比" inputmode="decimal" @input="materialPreset = 'manual'; invalidate()" /><b>—</b></div></label>
        <p class="full-width field-note">膜力由静力平衡决定，E、ν 用于统一材料合法域；本计算不输出变形。</p>

        <h3 class="full-width">4. 载荷</h3>
        <label><span>内压 pᵢ（幅值）</span><div class="unit-input"><input v-model="draft.internalPressure" aria-label="内压" inputmode="decimal" @input="invalidate" /><b>{{ unitLabels.pressure }}</b></div></label>
        <label><span>外压 pₒ（幅值）</span><div class="unit-input"><input v-model="draft.externalPressure" aria-label="外压" inputmode="decimal" @input="invalidate" /><b>{{ unitLabels.pressure }}</b></div></label>
        <label><span>居中轴力 F（拉为正）</span><div class="unit-input"><input v-model="draft.axialForce" aria-label="外加轴向力" inputmode="decimal" @input="invalidate" /><b>{{ unitLabels.force }}</b></div></label>
        <label><span>扭矩 T（+z 面向 +θ 为正）</span><div class="unit-input"><input v-model="draft.torque" aria-label="薄壁圆筒扭矩" inputmode="decimal" @input="invalidate" /><b>{{ unitLabels.torque }}</b></div></label>

        <div class="full-width actions">
          <button type="submit">计算薄壁圆筒</button>
          <button type="button" class="secondary" @click="reset">重置为新算例</button>
        </div>
      </form>

      <ThinCylinderDiagram :boundary="draft.boundary" />
    </div>

    <div v-if="errors.length" class="error" role="alert">
      <strong>无法计算</strong>
      <ul><li v-for="message in errors" :key="message">{{ message }}</li></ul>
    </div>
    <ThinCylinderResults v-if="result" :result="result" :unit-preset="unitPreset" />
  </section>
</template>

<style scoped>
.calculator { display: grid; gap: 20px; }
.calculator-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px 22px; border: 1px solid var(--color-line); border-left: 4px solid var(--color-brand); border-radius: 12px; background: #f7faf9; }
.calculator-heading p { margin: 0 0 5px; color: var(--color-brand); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.calculator-heading h2 { margin: 0 0 5px; font-size: 24px; }
.calculator-heading span { color: var(--color-muted); font-size: 11px; }
.unit-presets { display: flex; flex: 0 0 auto; gap: 5px; }
.unit-presets button { min-height: 38px; padding: 0 10px; border: 1px solid var(--color-line); border-radius: 8px; color: #53636e; background: #fff; cursor: pointer; font-size: 11px; font-weight: 700; }
.unit-presets button.active { color: #fff; border-color: var(--color-brand); background: var(--color-brand); }
.workspace-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr); gap: 18px; align-items: start; }
.input-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; min-width: 0; padding: 20px; border: 1px solid var(--color-line); border-radius: var(--radius-large); background: var(--color-panel); box-shadow: var(--shadow-panel); }
.input-panel h3 { margin: 4px 0 -1px; color: #30454e; font-size: 13px; }
.input-panel label { display: grid; gap: 6px; min-width: 0; color: #53636e; font-size: 12px; font-weight: 700; }
.input-panel select { width: 100%; min-height: 42px; padding: 0 10px; border: 1px solid #cad5da; border-radius: 8px; background: #fff; }
.full-width { grid-column: 1 / -1; }
.boundary-fieldset { display: flex; flex-wrap: wrap; gap: 13px 20px; margin: 0; padding: 13px; border: 1px solid #cad5da; border-radius: 9px; }
.boundary-fieldset legend { padding: 0 5px; color: #30454e; font-size: 12px; font-weight: 800; }
.boundary-fieldset label { display: flex; align-items: center; gap: 7px; }
.unit-input { display: grid; grid-template-columns: minmax(0, 1fr) auto; min-height: 42px; overflow: hidden; border: 1px solid #cad5da; border-radius: 8px; background: #fff; }
.unit-input:focus-within { border-color: var(--color-brand); box-shadow: 0 0 0 3px rgb(18 106 115 / 10%); }
.unit-input input { min-width: 0; padding: 0 10px; border: 0; outline: 0; }
.unit-input b { display: grid; place-items: center; min-width: 36px; padding: 0 9px; border-left: 1px solid #e2e7e9; color: #667881; background: #f7f9fa; font-size: 10px; }
.field-note { margin: -3px 0 4px; color: var(--color-muted); font-size: 10px; line-height: 1.5; }
.actions { display: flex; gap: 9px; margin-top: 5px; }
.actions button { min-height: 44px; padding: 0 15px; border: 0; border-radius: 8px; color: #fff; background: var(--color-brand); cursor: pointer; font-weight: 800; }
.actions .secondary { color: #53636e; border: 1px solid var(--color-line); background: #f5f8f9; }
.error { padding: 15px 18px; border-radius: 9px; color: #8f342d; background: #fff0ed; }
.error ul { margin: 6px 0 0; }
@media (max-width: 1000px) { .calculator-heading { align-items: flex-start; flex-direction: column; } .workspace-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .calculator-heading, .input-panel { padding: 16px; } .unit-presets { width: 100%; flex-direction: column; } .input-panel { grid-template-columns: 1fr; } .full-width { grid-column: auto; } .boundary-fieldset { flex-direction: column; } .actions { flex-direction: column; } }
</style>
