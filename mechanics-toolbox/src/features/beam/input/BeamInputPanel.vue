<script setup lang="ts">
import { computed } from 'vue'
import type { SectionKind } from '../../../core/sections'
import type { UnitId } from '../../../core/units'
import { buildBeamModel, compatibleUnits } from './adapter'
import LoadEditor from './LoadEditor.vue'
import {
  BEAM_SUPPORT_OPTIONS,
  SECTION_OPTIONS,
  changeDirectionMode,
  createEmptyLoad,
  createSectionDraft,
  type BeamDirectionMode,
  type BeamInputDraft,
  type BeamLoadDraft,
  type BeamLoadDraftType,
  type SectionDimensionKey,
  type UnitValueDraft,
} from './input-types'

const props = defineProps<{ modelValue: BeamInputDraft }>()
const emit = defineEmits<{
  'update:modelValue': [value: BeamInputDraft]
  calculate: [value: BeamInputDraft]
}>()

interface SectionFieldDefinition {
  key: SectionDimensionKey
  label: string
  symbol: string
}

const SECTION_FIELDS: Readonly<Record<SectionKind, readonly SectionFieldDefinition[]>> = {
  rectangle: [
    { key: 'width', label: '宽度', symbol: 'b' },
    { key: 'height', label: '高度', symbol: 'h' },
  ],
  hollowRectangle: [
    { key: 'outerWidth', label: '外宽', symbol: 'B' },
    { key: 'outerHeight', label: '外高', symbol: 'H' },
    { key: 'innerWidth', label: '内宽', symbol: 'b' },
    { key: 'innerHeight', label: '内高', symbol: 'h' },
  ],
  solidCircle: [{ key: 'diameter', label: '直径', symbol: 'd' }],
  circularTube: [
    { key: 'outerDiameter', label: '外径', symbol: 'D' },
    { key: 'innerDiameter', label: '内径', symbol: 'd' },
  ],
}

const sectionFields = computed(() => SECTION_FIELDS[props.modelValue.section.kind])
const validation = computed(() => buildBeamModel(props.modelValue))
const errorsByField = computed<Readonly<Record<string, readonly string[]>>>(() => {
  if (validation.value.ok) return {}
  const grouped: Record<string, string[]> = {}
  validation.value.errors.forEach(({ field, message }) => {
    ;(grouped[field] ??= []).push(message)
  })
  return grouped
})

function inputValue(event: Event): string { return (event.target as HTMLInputElement).value }
function selectValue(event: Event): string { return (event.target as HTMLSelectElement).value }
function update(patch: Partial<BeamInputDraft>): void { emit('update:modelValue', { ...props.modelValue, ...patch }) }

function updateRootField(field: 'length' | 'elasticModulus', patch: Partial<UnitValueDraft>): void {
  update({ [field]: { ...props.modelValue[field], ...patch } })
}

function changeRootUnit(field: 'length' | 'elasticModulus', event: Event): void {
  updateRootField(field, { unit: selectValue(event) as UnitId, value: '' })
}

function changeSupport(event: Event): void {
  update({ support: selectValue(event) as BeamInputDraft['support'] })
}

function changeMode(event: Event): void {
  emit(
    'update:modelValue',
    changeDirectionMode(props.modelValue, selectValue(event) as BeamDirectionMode),
  )
}

function changeSection(event: Event): void {
  update({ section: createSectionDraft(selectValue(event) as SectionKind) })
}

function updateSectionField(key: SectionDimensionKey, patch: Partial<UnitValueDraft>): void {
  const current = props.modelValue.section.dimensions[key]
  if (!current) return
  update({
    section: {
      ...props.modelValue.section,
      dimensions: {
        ...props.modelValue.section.dimensions,
        [key]: { ...current, ...patch },
      },
    },
  })
}

function changeSectionUnit(key: SectionDimensionKey, event: Event): void {
  updateSectionField(key, { unit: selectValue(event) as UnitId, value: '' })
}

function loadErrors(index: number): Readonly<Record<string, readonly string[]>> {
  const prefix = `loads.${index}.`
  return Object.fromEntries(
    Object.entries(errorsByField.value)
      .filter(([field]) => field.startsWith(prefix))
      .map(([field, messages]) => [field.slice(prefix.length), messages]),
  )
}

function updateLoad(index: number, load: BeamLoadDraft): void {
  const loads = props.modelValue.loads.slice()
  loads[index] = load
  update({ loads })
}

function removeLoad(index: number): void {
  update({ loads: props.modelValue.loads.filter((_, loadIndex) => loadIndex !== index) })
}

let nextLoadId = 2
function addLoad(type: BeamLoadDraftType): void {
  if (props.modelValue.loads.length >= 10) return
  const usedIds = new Set(props.modelValue.loads.map(({ id }) => id))
  while (usedIds.has(`load-${nextLoadId}`)) nextLoadId += 1
  const load = createEmptyLoad(`load-${nextLoadId}`, type)
  nextLoadId += 1
  update({ loads: [...props.modelValue.loads, load] })
}

function calculate(): void {
  if (validation.value.ok) emit('calculate', props.modelValue)
}

function fieldErrors(field: string): readonly string[] { return errorsByField.value[field] ?? [] }
</script>

<template>
  <section class="beam-input-panel" aria-labelledby="beam-input-title">
    <header>
      <div>
        <p>Euler–Bernoulli 梁</p>
        <h2 id="beam-input-title">梁与载荷输入</h2>
      </div>
      <span>{{ modelValue.loads.length }}/10 项载荷</span>
    </header>

    <div class="base-grid">
      <label class="field">
        <span>支承方式</span>
        <select class="plain-select" :value="modelValue.support" @change="changeSupport">
          <option v-for="option in BEAM_SUPPORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <label class="field">
        <span>载荷方向输入</span>
        <select class="plain-select" :value="modelValue.directionMode" @change="changeMode">
          <option value="magnitudeDirection">非负幅值＋方向</option>
          <option value="signed">带符号数值</option>
        </select>
      </label>
      <label class="field">
        <span>梁长 L</span>
        <div class="input-with-unit" :class="{ invalid: fieldErrors('length').length }">
          <input :value="modelValue.length.value" inputmode="decimal" autocomplete="off" @input="updateRootField('length', { value: inputValue($event) })" />
          <select :value="modelValue.length.unit" aria-label="梁长单位" @change="changeRootUnit('length', $event)">
            <option v-for="unit in compatibleUnits('length')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
          </select>
        </div>
        <small v-for="message in fieldErrors('length')" :key="message" class="field-error">{{ message }}</small>
      </label>
      <label class="field">
        <span>弹性模量 E</span>
        <div class="input-with-unit" :class="{ invalid: fieldErrors('elasticModulus').length }">
          <input :value="modelValue.elasticModulus.value" inputmode="decimal" autocomplete="off" @input="updateRootField('elasticModulus', { value: inputValue($event) })" />
          <select :value="modelValue.elasticModulus.unit" aria-label="弹性模量单位" @change="changeRootUnit('elasticModulus', $event)">
            <option v-for="unit in compatibleUnits('elasticModulus')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
          </select>
        </div>
        <small v-for="message in fieldErrors('elasticModulus')" :key="message" class="field-error">{{ message }}</small>
      </label>
    </div>

    <section class="section-block" aria-labelledby="beam-section-title">
      <div class="block-heading">
        <h3 id="beam-section-title">截面几何</h3>
        <label>
          <span>截面类型</span>
          <select class="plain-select" :value="modelValue.section.kind" @change="changeSection">
            <option v-for="option in SECTION_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>
      <div class="base-grid section-grid">
        <label v-for="field in sectionFields" :key="field.key" class="field">
          <span>{{ field.label }} {{ field.symbol }}</span>
          <div class="input-with-unit" :class="{ invalid: fieldErrors(`section.${field.key}`).length }">
            <input
              :value="modelValue.section.dimensions[field.key]?.value"
              inputmode="decimal"
              autocomplete="off"
              @input="updateSectionField(field.key, { value: inputValue($event) })"
            />
            <select
              :value="modelValue.section.dimensions[field.key]?.unit"
              :aria-label="`${field.label}单位`"
              @change="changeSectionUnit(field.key, $event)"
            >
              <option v-for="unit in compatibleUnits('length')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
            </select>
          </div>
          <small v-for="message in fieldErrors(`section.${field.key}`)" :key="message" class="field-error">{{ message }}</small>
        </label>
      </div>
      <small v-for="message in fieldErrors('section.geometry')" :key="message" class="field-error geometry-error">{{ message }}</small>
    </section>

    <section class="loads-block" aria-labelledby="loads-title">
      <div class="block-heading">
        <div>
          <h3 id="loads-title">载荷</h3>
          <p>同位置载荷保留为独立输入，计算前由后台合并。</p>
        </div>
        <div class="add-buttons">
          <button type="button" :disabled="modelValue.loads.length >= 10" @click="addLoad('pointForce')">＋集中力</button>
          <button type="button" :disabled="modelValue.loads.length >= 10" @click="addLoad('pointMoment')">＋力矩</button>
          <button type="button" :disabled="modelValue.loads.length >= 10" @click="addLoad('uniformLoad')">＋均布载荷</button>
        </div>
      </div>
      <small v-for="message in fieldErrors('loads')" :key="message" class="field-error">{{ message }}</small>
      <div class="load-list">
        <LoadEditor
          v-for="(load, index) in modelValue.loads"
          :key="load.id"
          :model-value="load"
          :direction-mode="modelValue.directionMode"
          :index="index"
          :errors="loadErrors(index)"
          @update:model-value="updateLoad(index, $event)"
          @remove="removeLoad(index)"
        />
        <p v-if="modelValue.loads.length === 0" class="empty-loads">尚未添加载荷。</p>
      </div>
    </section>

    <div v-if="!validation.ok" class="error-summary" role="alert">
      <strong>请检查输入（{{ validation.errors.length }} 项）</strong>
      <span>红色字段修正后才能计算。</span>
    </div>
    <button class="calculate-button" type="button" @click="calculate">计算梁响应</button>
  </section>
</template>

<style scoped>
.beam-input-panel { display: grid; gap: 18px; padding: 22px; border: 1px solid var(--color-line, #d7e0e3); border-radius: 12px; background: #fbfcfc; }
.beam-input-panel > header, .block-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
header p, .block-heading p { margin: 0 0 4px; color: #667881; font-size: 12px; }
header h2, .block-heading h3 { margin: 0; color: #263e48; }
header > span { color: #667881; font-size: 12px; font-weight: 700; }
.base-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
.field, .block-heading label { display: grid; gap: 6px; color: #53636e; font-size: 12px; font-weight: 700; }
.plain-select { min-height: 42px; padding: 0 10px; border: 1px solid #cad5da; border-radius: 8px; background: #fff; }
.input-with-unit { display: grid; grid-template-columns: minmax(0, 1fr) auto; border: 1px solid #cad5da; border-radius: 8px; overflow: hidden; }
.input-with-unit:focus-within { border-color: #126a73; box-shadow: 0 0 0 3px rgb(18 106 115 / 10%); }
.input-with-unit.invalid { border-color: #c6574e; }
.input-with-unit input { min-width: 0; min-height: 42px; padding: 0 10px; border: 0; outline: 0; }
.input-with-unit select { border: 0; border-left: 1px solid #e2e7e9; color: #667881; background: #f7f9fa; }
.section-block, .loads-block { display: grid; gap: 13px; padding-top: 17px; border-top: 1px solid #dfe6e8; }
.section-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.add-buttons { display: flex; flex-wrap: wrap; justify-content: end; gap: 7px; }
.add-buttons button { min-height: 34px; padding: 0 10px; border: 1px solid #9dbdc1; border-radius: 7px; color: #125e66; background: #f1f8f8; cursor: pointer; }
.add-buttons button:disabled { cursor: not-allowed; opacity: .45; }
.load-list { display: grid; gap: 12px; }
.empty-loads { margin: 0; padding: 16px; color: #667881; text-align: center; background: #f3f6f7; }
.field-error { color: #a23b34; line-height: 1.4; }
.geometry-error { display: block; }
.error-summary { display: flex; justify-content: space-between; gap: 10px; padding: 11px 13px; border-radius: 8px; color: #8f342d; background: #fff0ed; font-size: 12px; }
.calculate-button { min-height: 46px; border: 0; border-radius: 8px; color: #fff; background: var(--color-brand, #126a73); cursor: pointer; font-weight: 800; }
@media (max-width: 900px) { .section-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 700px) { .base-grid, .section-grid { grid-template-columns: 1fr; } .beam-input-panel > header, .block-heading { align-items: stretch; flex-direction: column; } .add-buttons { justify-content: start; } }
</style>
