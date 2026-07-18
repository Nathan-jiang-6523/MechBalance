<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getMaterialPreset,
  listMaterialPresets,
  type MaterialPresetId,
} from '../../core/materials'
import { convertFromSI, normalizeToSI } from '../../core/units'

const presets = listMaterialPresets()
const selectedId = ref<MaterialPresetId>('al-6061-t6')
const elasticModulus = ref('')
const density = ref('')

const selectedPreset = computed(() => getMaterialPreset(selectedId.value))

const parsedValues = computed(() => {
  const eValue = elasticModulus.value.trim() === '' ? Number.NaN : Number(elasticModulus.value)
  const densityValue = density.value.trim() === '' ? Number.NaN : Number(density.value)

  try {
    const elasticModulusPa = normalizeToSI(eValue, 'elasticModulus', 'MPa')
    const densityKgM3 = normalizeToSI(densityValue, 'density', 't_per_mm3')
    if (elasticModulusPa <= 0 || densityKgM3 <= 0) throw new Error('材料参数必须大于 0')
    return { valid: true as const, elasticModulusPa, densityKgM3 }
  } catch (error) {
    return {
      valid: false as const,
      message: error instanceof Error ? error.message : '材料参数无效',
    }
  }
})

const isOverridden = computed(() => {
  if (!parsedValues.value.valid) return false
  return (
    differs(parsedValues.value.elasticModulusPa, selectedPreset.value.elasticModulusPa) ||
    differs(parsedValues.value.densityKgM3, selectedPreset.value.densityKgM3)
  )
})

function differs(value: number, reference: number): boolean {
  return Math.abs(value - reference) > Math.max(Math.abs(reference) * 1e-12, Number.EPSILON)
}

function restorePreset(): void {
  elasticModulus.value = String(
    convertFromSI(selectedPreset.value.elasticModulusPa, 'elasticModulus', 'MPa'),
  )
  density.value = String(
    convertFromSI(selectedPreset.value.densityKgM3, 'density', 't_per_mm3'),
  )
}

function sourceScope(supports: string): string {
  switch (supports) {
    case 'designation':
      return '牌号说明'
    case 'elastic-modulus':
      return '弹性模量'
    case 'density':
      return '密度'
    default:
      return supports
  }
}

watch(selectedId, restorePreset, { immediate: true })
</script>

<template>
  <section class="material-panel" aria-labelledby="material-panel-title">
    <div class="material-heading">
      <div>
        <p>材料参数</p>
        <h2 id="material-panel-title">名义预设与手工覆盖</h2>
      </div>
      <span
        class="edit-state"
        :class="{ 'is-overridden': isOverridden, 'is-invalid': !parsedValues.valid }"
      >
        {{ !parsedValues.valid ? '输入无效' : isOverridden ? '已覆盖预设值' : '使用预设值' }}
      </span>
    </div>

    <div class="material-grid">
      <label class="field preset-field">
        <span>材料预设</span>
        <select v-model="selectedId">
          <option v-for="preset in presets" :key="preset.id" :value="preset.id">
            {{ preset.name }} · {{ preset.condition }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>弹性模量 E</span>
        <div class="input-with-unit" :class="{ 'has-error': !parsedValues.valid }">
          <input v-model="elasticModulus" type="text" inputmode="decimal" autocomplete="off" />
          <span>MPa</span>
        </div>
      </label>

      <label class="field">
        <span>密度 ρ</span>
        <div class="input-with-unit" :class="{ 'has-error': !parsedValues.valid }">
          <input v-model="density" type="text" inputmode="decimal" autocomplete="off" />
          <span>t/mm³</span>
        </div>
      </label>

      <button class="restore-button" type="button" :disabled="!isOverridden" @click="restorePreset">
        恢复预设
      </button>
    </div>

    <p v-if="!parsedValues.valid" class="input-error" role="alert">
      {{ parsedValues.message }}
    </p>

    <div class="material-warning">
      <strong>名义值提示</strong>
      <p>{{ selectedPreset.warning }}</p>
    </div>

    <details class="source-list">
      <summary>查看来源与访问日期</summary>
      <ul>
        <li v-for="source in selectedPreset.sources" :key="`${source.url}-${source.supports}`">
          <a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }}</a>
          <span>{{ sourceScope(source.supports) }} · {{ source.accessedOn }}</span>
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.material-panel {
  padding: clamp(22px, 3vw, 30px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-large);
  background: var(--color-panel);
  box-shadow: var(--shadow-panel);
}

.material-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
}

.material-heading p {
  margin-bottom: 5px;
  color: var(--color-brand);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.material-heading h2 {
  margin: 0;
  font-size: 19px;
}

.edit-state {
  flex: 0 0 auto;
  padding: 6px 9px;
  border-radius: 999px;
  color: var(--color-success);
  background: #e9f5ed;
  font-size: 11px;
  font-weight: 800;
}

.edit-state.is-overridden {
  color: var(--color-warning);
  background: #fff0df;
}

.edit-state.is-invalid {
  color: #963b34;
  background: #fff0ed;
}

.material-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) minmax(150px, 1fr) minmax(170px, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.field {
  display: grid;
  gap: 6px;
  color: #53636e;
  font-size: 12px;
  font-weight: 700;
}

.field select,
.input-with-unit {
  min-height: 42px;
  border: 1px solid #cad5da;
  border-radius: 8px;
  background: #fff;
}

.field select {
  width: 100%;
  padding: 0 10px;
}

.input-with-unit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
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
  min-height: 40px;
  padding: 0 10px;
  border: 0;
  outline: none;
}

.input-with-unit span {
  padding-right: 10px;
  color: var(--color-muted);
  font-size: 11px;
}

.restore-button {
  min-height: 42px;
  padding: 0 13px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: #f5f8f9;
  cursor: pointer;
  font-weight: 700;
}

.restore-button:disabled {
  cursor: default;
  opacity: 0.45;
}

.input-error {
  margin: 10px 0 0;
  color: #963b34;
  font-size: 12px;
}

.material-warning {
  margin-top: 18px;
  padding: 12px 14px;
  border-left: 3px solid var(--color-accent);
  color: #684825;
  background: #fff8ef;
}

.material-warning strong {
  font-size: 11px;
}

.material-warning p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.55;
}

.source-list {
  margin-top: 13px;
  color: var(--color-muted);
  font-size: 12px;
}

.source-list summary {
  cursor: pointer;
  font-weight: 700;
}

.source-list ul {
  display: grid;
  gap: 8px;
  margin: 11px 0 0;
  padding-left: 20px;
}

.source-list li span {
  display: block;
  margin-top: 2px;
  font-size: 10px;
}

.source-list a {
  color: var(--color-brand);
}

@media (max-width: 960px) {
  .material-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 580px) {
  .material-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .material-grid {
    grid-template-columns: 1fr;
  }
}
</style>
