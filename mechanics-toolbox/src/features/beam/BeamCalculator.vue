<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { runBeamCalculation, type BeamCalculationBundle } from './calculation'
import BeamDiagram from './diagram/BeamDiagram.vue'
import { buildBeamModel } from './input/adapter'
import BeamInputPanel from './input/BeamInputPanel.vue'
import { createDefaultBeamInputDraft, type BeamInputDraft } from './input/input-types'
import BeamResults from './results/BeamResults.vue'

const draft = ref<BeamInputDraft>(createDefaultBeamInputDraft())
const calculation = ref<BeamCalculationBundle | null>(null)
const calculationErrors = ref<string[]>([])
const hasCalculated = ref(false)
let recalculateTimer: ReturnType<typeof setTimeout> | undefined

const previewModel = computed(() => {
  const built = buildBeamModel(draft.value)
  return built.ok ? built.value : calculation.value?.builtModel ?? null
})

function calculate(input: BeamInputDraft = draft.value): void {
  const built = buildBeamModel(input)
  if (!built.ok) {
    calculation.value = null
    calculationErrors.value = built.errors.map(({ message }) => message)
    return
  }

  const result = runBeamCalculation(built.value)
  if (!result.ok) {
    calculation.value = null
    calculationErrors.value = result.errors
    return
  }

  calculationErrors.value = []
  calculation.value = result.value
  hasCalculated.value = true
}

watch(
  draft,
  () => {
    if (!hasCalculated.value) return
    if (recalculateTimer) clearTimeout(recalculateTimer)
    recalculateTimer = setTimeout(() => calculate(), 250)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (recalculateTimer) clearTimeout(recalculateTimer)
})
</script>

<template>
  <section class="beam-calculator" aria-labelledby="beam-calculator-title">
    <div class="beam-intro">
      <div>
        <span>P1 · 首款综合计算器</span>
        <h2 id="beam-calculator-title">截面性质 + 简支/悬臂梁综合计算</h2>
        <p>底层按 Euler–Bernoulli 梁四阶方程分段求解，同时输出反力、内力、变形、应力与极值。</p>
      </div>
      <strong>默认单位：mm · N · MPa</strong>
    </div>

    <div class="beam-input-layout">
      <BeamInputPanel v-model="draft" @calculate="calculate" />
      <section class="diagram-card" aria-labelledby="beam-diagram-heading">
        <div>
          <h3 id="beam-diagram-heading">输入示意</h3>
          <p>全局约定：x 向右；集中力向上为正；集中力矩逆时针为正。</p>
        </div>
        <BeamDiagram
          v-if="previewModel"
          :length-m="previewModel.lengthM"
          :support="previewModel.support"
          :loads="previewModel.loads"
        />
        <p v-else class="diagram-placeholder">当前输入不完整，修正红色字段后恢复示意图。</p>
      </section>
    </div>

    <div v-if="calculationErrors.length" class="calculation-error" role="alert">
      <strong>本次计算未完成</strong>
      <ul>
        <li v-for="message in calculationErrors" :key="message">{{ message }}</li>
      </ul>
    </div>

    <BeamResults
      v-if="calculation"
      :solution="calculation.solution"
      :extrema="calculation.extrema"
      :samples="calculation.samples"
      :span-length-m="calculation.builtModel.lengthM"
      :section-height-m="calculation.builtModel.sectionHeightM"
      :stress-summary="calculation.stressSummary"
    />

    <div v-else-if="!calculationErrors.length" class="result-placeholder">
      <strong>等待首次计算</strong>
      <span>检查单位、支承、截面与载荷后，点击“计算梁响应”。</span>
    </div>
  </section>
</template>

<style scoped>
.beam-calculator {
  display: grid;
  gap: 22px;
}

.beam-intro {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding: 18px 22px;
  border: 1px solid var(--color-line);
  border-left: 4px solid var(--color-brand);
  border-radius: 10px;
  background: #f7faf9;
}

.beam-intro span {
  color: var(--color-brand);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
}

.beam-intro h2 {
  margin: 5px 0 7px;
  font-size: clamp(19px, 2vw, 25px);
}

.beam-intro p {
  max-width: 760px;
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.6;
}

.beam-intro strong {
  flex: 0 0 auto;
  color: #72572d;
  font-size: 12px;
}

.beam-input-layout {
  display: grid;
  gap: 18px;
}

.diagram-card {
  min-width: 0;
  padding: 18px 20px 12px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-large);
  background: var(--color-panel);
  box-shadow: var(--shadow-panel);
}

.diagram-card h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.diagram-card p {
  margin: 0;
  color: var(--color-muted);
  font-size: 11px;
}

.diagram-placeholder,
.result-placeholder,
.calculation-error {
  padding: 20px;
  border-radius: 10px;
}

.diagram-placeholder,
.result-placeholder {
  border: 1px dashed #b8c8cd;
  color: var(--color-muted);
  background: #f8fafb;
}

.result-placeholder {
  display: grid;
  gap: 5px;
  text-align: center;
}

.result-placeholder strong {
  color: #40545d;
}

.calculation-error {
  color: #8f342d;
  background: #fff0ed;
}

.calculation-error ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

@media (max-width: 700px) {
  .beam-intro {
    flex-direction: column;
  }
}
</style>
