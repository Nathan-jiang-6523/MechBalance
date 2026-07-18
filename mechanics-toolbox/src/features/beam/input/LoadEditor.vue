<script setup lang="ts">
import { computed } from 'vue'
import type { UnitId } from '../../../core/units'
import { compatibleUnits } from './adapter'
import {
  createEmptyLoad,
  type BeamDirectionMode,
  type BeamLoadDraft,
  type BeamLoadDraftType,
  type UnitValueDraft,
} from './input-types'

const props = defineProps<{
  modelValue: BeamLoadDraft
  directionMode: BeamDirectionMode
  index: number
  errors: Readonly<Record<string, readonly string[]>>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BeamLoadDraft]
  remove: []
}>()

const title = computed(() => {
  if (props.modelValue.type === 'pointForce') return '集中力'
  if (props.modelValue.type === 'pointMoment') return '集中力矩'
  return '分段均布载荷'
})

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function selectValue(event: Event): string {
  return (event.target as HTMLSelectElement).value
}

function changeType(event: Event): void {
  emit(
    'update:modelValue',
    createEmptyLoad(props.modelValue.id, selectValue(event) as BeamLoadDraftType),
  )
}

function updateUnitField(
  field: 'position' | 'start' | 'end' | 'magnitude',
  patch: Partial<UnitValueDraft>,
): void {
  const load = props.modelValue
  if (field === 'magnitude') {
    emit('update:modelValue', { ...load, magnitude: { ...load.magnitude, ...patch } })
    return
  }
  if (field === 'position' && load.type !== 'uniformLoad') {
    emit('update:modelValue', { ...load, position: { ...load.position, ...patch } })
    return
  }
  if ((field === 'start' || field === 'end') && load.type === 'uniformLoad') {
    emit('update:modelValue', { ...load, [field]: { ...load[field], ...patch } })
  }
}

function changeUnit(field: 'position' | 'start' | 'end' | 'magnitude', event: Event): void {
  updateUnitField(field, { unit: selectValue(event) as UnitId, value: '' })
}

function updateDirection(event: Event): void {
  emit('update:modelValue', {
    ...props.modelValue,
    direction: selectValue(event),
  } as BeamLoadDraft)
}

function fieldErrors(field: string): readonly string[] {
  return props.errors[field] ?? []
}
</script>

<template>
  <fieldset class="load-card" :data-load-index="index">
    <legend>载荷 {{ index + 1 }} · {{ title }}</legend>
    <div class="load-toolbar">
      <label>
        <span>类型</span>
        <select :value="modelValue.type" aria-label="载荷类型" @change="changeType">
          <option value="pointForce">集中力</option>
          <option value="pointMoment">集中力矩</option>
          <option value="uniformLoad">分段均布载荷</option>
        </select>
      </label>
      <button type="button" class="remove-button" :aria-label="`删除载荷 ${index + 1}`" @click="emit('remove')">
        删除
      </button>
    </div>

    <div class="load-grid">
      <template v-if="modelValue.type !== 'uniformLoad'">
        <label class="field">
          <span>位置 a</span>
          <div class="input-with-unit" :class="{ invalid: fieldErrors('position').length }">
            <input
              :value="modelValue.position.value"
              inputmode="decimal"
              autocomplete="off"
              :aria-invalid="Boolean(fieldErrors('position').length)"
              @input="updateUnitField('position', { value: inputValue($event) })"
            />
            <select
              :value="modelValue.position.unit"
              aria-label="位置单位"
              @change="changeUnit('position', $event)"
            >
              <option v-for="unit in compatibleUnits('length')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
            </select>
          </div>
          <small v-for="message in fieldErrors('position')" :key="message" class="field-error">{{ message }}</small>
        </label>
      </template>

      <template v-else>
        <label class="field">
          <span>起点 a</span>
          <div class="input-with-unit" :class="{ invalid: fieldErrors('start').length || fieldErrors('interval').length }">
            <input :value="modelValue.start.value" inputmode="decimal" autocomplete="off" @input="updateUnitField('start', { value: inputValue($event) })" />
            <select :value="modelValue.start.unit" aria-label="均布载荷起点单位" @change="changeUnit('start', $event)">
              <option v-for="unit in compatibleUnits('length')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
            </select>
          </div>
          <small v-for="message in fieldErrors('start')" :key="message" class="field-error">{{ message }}</small>
        </label>
        <label class="field">
          <span>终点 b</span>
          <div class="input-with-unit" :class="{ invalid: fieldErrors('end').length || fieldErrors('interval').length }">
            <input :value="modelValue.end.value" inputmode="decimal" autocomplete="off" @input="updateUnitField('end', { value: inputValue($event) })" />
            <select :value="modelValue.end.unit" aria-label="均布载荷终点单位" @change="changeUnit('end', $event)">
              <option v-for="unit in compatibleUnits('length')" :key="unit.id" :value="unit.id">{{ unit.symbol }}</option>
            </select>
          </div>
          <small v-for="message in fieldErrors('end')" :key="message" class="field-error">{{ message }}</small>
        </label>
      </template>

      <label class="field">
        <span>{{ directionMode === 'signed' ? '带符号数值' : '非负幅值' }}</span>
        <div class="input-with-unit" :class="{ invalid: fieldErrors('magnitude').length }">
          <input
            :value="modelValue.magnitude.value"
            inputmode="decimal"
            autocomplete="off"
            :aria-invalid="Boolean(fieldErrors('magnitude').length)"
            @input="updateUnitField('magnitude', { value: inputValue($event) })"
          />
          <select :value="modelValue.magnitude.unit" aria-label="载荷单位" @change="changeUnit('magnitude', $event)">
            <option
              v-for="unit in compatibleUnits(modelValue.type === 'pointForce' ? 'force' : modelValue.type === 'pointMoment' ? 'moment' : 'lineLoad')"
              :key="unit.id"
              :value="unit.id"
            >{{ unit.symbol }}</option>
          </select>
        </div>
        <small v-for="message in fieldErrors('magnitude')" :key="message" class="field-error">{{ message }}</small>
      </label>

      <label v-if="directionMode === 'magnitudeDirection'" class="field direction-field">
        <span>方向</span>
        <select class="plain-select" :value="modelValue.direction" aria-label="载荷方向" @change="updateDirection">
          <template v-if="modelValue.type === 'pointMoment'">
            <option value="counterClockwise">逆时针（+）</option>
            <option value="clockwise">顺时针（−）</option>
          </template>
          <template v-else>
            <option value="up">向上（+）</option>
            <option value="down">向下（−）</option>
          </template>
        </select>
      </label>
    </div>
    <small v-for="message in fieldErrors('interval')" :key="message" class="interval-error">{{ message }}</small>
  </fieldset>
</template>

<style scoped>
.load-card { margin: 0; padding: 14px; border: 1px solid #d7e0e3; border-radius: 10px; background: #fff; }
.load-card legend { padding: 0 6px; color: #263e48; font-size: 13px; font-weight: 800; }
.load-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.load-toolbar label, .field { display: grid; gap: 5px; color: #53636e; font-size: 12px; font-weight: 700; }
.load-toolbar select, .plain-select { min-height: 38px; padding: 0 9px; border: 1px solid #cad5da; border-radius: 7px; background: #fff; }
.remove-button { padding: 7px 10px; border: 1px solid #d7a7a3; border-radius: 7px; color: #983f38; background: #fff7f5; cursor: pointer; }
.load-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
.input-with-unit { display: grid; grid-template-columns: minmax(0, 1fr) auto; border: 1px solid #cad5da; border-radius: 8px; overflow: hidden; }
.input-with-unit:focus-within { border-color: #126a73; box-shadow: 0 0 0 3px rgb(18 106 115 / 10%); }
.input-with-unit.invalid { border-color: #c6574e; }
.input-with-unit input { min-width: 0; min-height: 39px; padding: 0 9px; border: 0; outline: 0; }
.input-with-unit select { border: 0; border-left: 1px solid #e2e7e9; color: #667881; background: #f7f9fa; }
.field-error, .interval-error { color: #a23b34; line-height: 1.35; }
.interval-error { display: block; margin-top: 7px; }
@media (max-width: 700px) { .load-grid { grid-template-columns: 1fr; } }
</style>
