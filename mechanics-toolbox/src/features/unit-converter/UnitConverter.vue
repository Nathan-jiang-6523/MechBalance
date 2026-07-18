<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatEngineeringValue } from '../../core/numeric'
import {
  QUANTITY_CATALOG,
  convertUnitDetailed,
  type QuantityId,
  type UnitId,
} from '../../core/units'

const quantityIds = Object.keys(QUANTITY_CATALOG) as QuantityId[]
const quantity = ref<QuantityId>('length')
const fromUnit = ref<UnitId>('mm')
const toUnit = ref<UnitId>('m')
const inputValue = ref('')

const definition = computed(() => QUANTITY_CATALOG[quantity.value])

const conversion = computed(() => {
  if (inputValue.value.trim() === '') return { state: 'empty' as const }

  const parsed = Number(inputValue.value)
  if (!Number.isFinite(parsed)) {
    return { state: 'error' as const, message: '请输入有限数值' }
  }

  try {
    return {
      state: 'ready' as const,
      value: convertUnitDetailed(parsed, quantity.value, fromUnit.value, toUnit.value),
    }
  } catch (error) {
    return {
      state: 'error' as const,
      message: error instanceof Error ? error.message : '单位换算失败',
    }
  }
})

const outputUnit = computed(() =>
  definition.value.units.find((unit) => unit.id === toUnit.value),
)

watch(quantity, () => {
  const [first, second] = definition.value.units
  if (!first) return
  fromUnit.value = first.id
  toUnit.value = second?.id ?? first.id
  inputValue.value = ''
})

function clearForUnitChange(): void {
  inputValue.value = ''
}

function swapUnits(): void {
  const currentFrom = fromUnit.value
  fromUnit.value = toUnit.value
  toUnit.value = currentFrom
  inputValue.value = ''
}
</script>

<template>
  <section class="calculator-panel" aria-labelledby="unit-converter-title">
    <div class="panel-header">
      <div>
        <p class="panel-kicker">公共工具</p>
        <h2 id="unit-converter-title">常用单位换算</h2>
        <p>换算由统一单位内核完成；切换单位后清空数值，防止旧数值被误读。</p>
      </div>
      <span class="system-chip">t = 质量吨</span>
    </div>

    <div class="converter-grid">
      <label class="field field-wide">
        <span>物理量</span>
        <select v-model="quantity">
          <option v-for="id in quantityIds" :key="id" :value="id">
            {{ QUANTITY_CATALOG[id].label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>输入数值</span>
        <input
          v-model="inputValue"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="请输入数值"
        />
      </label>

      <label class="field">
        <span>原单位</span>
        <select v-model="fromUnit" @change="clearForUnitChange">
          <option v-for="unit in definition.units" :key="unit.id" :value="unit.id">
            {{ unit.label }}（{{ unit.symbol }}）
          </option>
        </select>
      </label>

      <button class="swap-button" type="button" title="交换单位" @click="swapUnits">
        ⇄
        <span>交换</span>
      </button>

      <label class="field">
        <span>目标单位</span>
        <select v-model="toUnit" @change="clearForUnitChange">
          <option v-for="unit in definition.units" :key="unit.id" :value="unit.id">
            {{ unit.label }}（{{ unit.symbol }}）
          </option>
        </select>
      </label>
    </div>

    <div class="conversion-result" :class="`is-${conversion.state}`" aria-live="polite">
      <template v-if="conversion.state === 'ready'">
        <span>换算结果</span>
        <strong>
          {{ formatEngineeringValue(conversion.value.outputValue) }}
          <small>{{ outputUnit?.symbol }}</small>
        </strong>
      </template>
      <template v-else-if="conversion.state === 'error'">
        <span>输入有误</span>
        <strong>{{ conversion.message }}</strong>
      </template>
      <template v-else>
        <span>换算结果</span>
        <strong>等待输入</strong>
      </template>
    </div>
  </section>
</template>

<style scoped>
.calculator-panel {
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
  margin-bottom: 26px;
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
  max-width: 660px;
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.65;
}

.system-chip {
  flex: 0 0 auto;
  padding: 7px 10px;
  border-radius: 7px;
  color: var(--color-warning);
  background: #fff4e8;
  font-size: 12px;
  font-weight: 800;
}

.converter-grid {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(180px, 1fr) 72px minmax(180px, 1fr);
  gap: 14px;
  align-items: end;
}

.field {
  display: grid;
  gap: 7px;
  color: #53636e;
  font-size: 12px;
  font-weight: 700;
}

.field-wide {
  grid-column: 1 / -1;
}

.field input,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid #cbd5da;
  border-radius: var(--radius-small);
  color: var(--color-ink);
  background: #fff;
  outline: none;
}

.field input:focus,
.field select:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px rgb(18 106 115 / 10%);
}

.swap-button {
  min-height: 44px;
  display: flex;
  gap: 5px;
  justify-content: center;
  align-items: center;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-small);
  background: #f6f9fa;
  cursor: pointer;
  font-size: 15px;
}

.swap-button span {
  font-size: 11px;
  font-weight: 700;
}

.conversion-result {
  min-height: 112px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 22px;
  padding: 20px 24px;
  border-radius: 12px;
  color: var(--color-brand-deep);
  background: var(--color-brand-soft);
}

.conversion-result span {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.conversion-result strong {
  font-size: clamp(22px, 4vw, 34px);
  line-height: 1.2;
}

.conversion-result small {
  font-size: 15px;
}

.conversion-result.is-empty {
  color: var(--color-muted);
  background: #f4f6f7;
}

.conversion-result.is-error {
  color: #8c342c;
  background: #fff0ed;
}

.conversion-result.is-error strong {
  font-size: 16px;
}

@media (max-width: 760px) {
  .panel-header {
    flex-direction: column;
  }

  .converter-grid {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: auto;
  }

  .swap-button {
    width: 100%;
  }
}
</style>
