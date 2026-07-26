<script setup lang="ts">
import { computed } from 'vue'
import MathFormula from '../../components/MathFormula.vue'
import type { SectionCalculatorKind } from '../../core/sections'
import {
  SECTION_FORMULA_CATALOG,
  SECTION_FORMULA_VERSION,
} from './sectionFormulaCatalog'

const props = defineProps<{
  kind: SectionCalculatorKind
}>()

const content = computed(() => SECTION_FORMULA_CATALOG[props.kind])
</script>

<template>
  <section class="section-formulas" aria-label="截面计算公式">
    <details data-testid="section-formula-details">
      <summary>
        <span>计算公式</span>
        <small>{{ content.title }}</small>
      </summary>

      <div class="formula-body">
        <article
          v-for="item in content.formulas"
          :key="item.id"
          class="formula-card"
          :data-formula-id="item.id"
        >
          <div class="formula-heading">
            <strong>{{ item.label }}</strong>
            <span>{{ item.id }} · {{ SECTION_FORMULA_VERSION }}</span>
          </div>
          <MathFormula :formula="item.latex" />
        </article>

        <article class="formula-card" data-formula-id="P1-SEC-COMMON-001">
          <div class="formula-heading">
            <strong>通用派生量</strong>
            <span>P1-SEC-COMMON-001 · {{ SECTION_FORMULA_VERSION }}</span>
          </div>
          <MathFormula
            :formula="String.raw`J_p=I_x+I_y,\qquad i_x=\sqrt{\frac{I_x}{A}},\quad i_y=\sqrt{\frac{I_y}{A}},\qquad W=\frac{I}{e}`"
          />
        </article>

        <ul class="formula-notes">
          <li v-for="note in content.notes" :key="note">{{ note }}</li>
          <li>W 按形心轴到对应正、负极缘的距离 e 分别计算。</li>
          <li>未列出 Jt 的截面表示手册未提供扭转模型，不能用 Jp 代替。</li>
        </ul>
      </div>
    </details>
  </section>
</template>

<style scoped>
.section-formulas {
  min-width: 0;
  margin-top: 20px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-medium);
  background: #fbfcfc;
}

summary {
  min-height: 48px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 13px 16px;
  cursor: pointer;
  color: #30454e;
  font-weight: 700;
}

summary small {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 500;
}

.formula-body {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid var(--color-line);
}

.formula-card {
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid #e0e7ea;
  border-radius: 9px;
  background: #f8fafb;
}

.formula-heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: baseline;
  margin-bottom: 6px;
}

.formula-heading strong {
  font-size: 13px;
}

.formula-heading span {
  color: var(--color-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}

.formula-notes {
  margin: 2px 0 0;
  padding-left: 20px;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 580px) {
  summary,
  .formula-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  summary {
    gap: 3px;
  }
}
</style>
