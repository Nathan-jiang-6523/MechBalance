<script setup lang="ts">
import { formatSignificant } from '../../../core/numeric'
import MathFormula from '../../../components/MathFormula.vue'
import type { StructuralMatrixView, StructuralTheoryContent } from '../types'

withDefaults(defineProps<{
  content: StructuralTheoryContent
  matrices?: readonly StructuralMatrixView[]
}>(), {
  matrices: () => [],
})
</script>

<template>
  <section class="structural-theory" aria-label="结构理论与矩阵">
    <details data-testid="structural-theory-details">
      <summary>
        <span>公式、假设与矩阵</span>
        <small>{{ content.title }}</small>
      </summary>

      <div class="theory-body">
        <section class="theory-section" aria-labelledby="structural-assumptions-title">
          <h3 id="structural-assumptions-title">理论假设与边界</h3>
          <ul>
            <li v-for="assumption in content.assumptions" :key="assumption">{{ assumption }}</li>
            <li v-for="boundary in content.boundaries" :key="boundary" class="boundary-item">
              {{ boundary }}
            </li>
          </ul>
        </section>

        <section class="theory-section" aria-labelledby="structural-formulas-title">
          <h3 id="structural-formulas-title">公式与版本</h3>
          <article
            v-for="formula in content.formulas"
            :key="formula.id"
            class="formula-card"
            :data-formula-id="formula.id"
          >
            <div class="formula-heading">
              <strong>{{ formula.label }}</strong>
              <span>{{ formula.id }} · {{ formula.version }}</span>
            </div>
            <MathFormula :formula="formula.latex" />
          </article>
        </section>

        <section class="theory-section" aria-labelledby="structural-matrix-title">
          <h3 id="structural-matrix-title">矩阵与混合单位</h3>
          <ul class="unit-notes">
            <li v-for="note in content.mixedUnitNotes" :key="note">{{ note }}</li>
          </ul>

          <p v-if="matrices.length === 0" class="matrix-placeholder">
            当前模型求解后，可在此展开查看对应矩阵。
          </p>
          <article v-for="matrix in matrices" :key="matrix.id" class="matrix-card">
            <h4>{{ matrix.title }}</h4>
            <div class="matrix-scroll">
              <table :aria-label="matrix.title" :data-matrix-id="matrix.id">
                <thead>
                  <tr>
                    <th scope="col">DOF</th>
                    <th v-for="label in matrix.columnLabels" :key="label" scope="col">
                      {{ label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in matrix.values" :key="matrix.rowLabels[rowIndex] ?? rowIndex">
                    <th scope="row">{{ matrix.rowLabels[rowIndex] ?? rowIndex + 1 }}</th>
                    <td v-for="(value, columnIndex) in row" :key="columnIndex">
                      {{ formatSignificant(value) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </details>
  </section>
</template>

<style scoped>
.structural-theory {
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-medium);
  background: var(--color-panel);
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

.theory-body {
  display: grid;
  gap: 18px;
  padding: 0 16px 18px;
  border-top: 1px solid var(--color-line);
}

.theory-section {
  min-width: 0;
  padding-top: 16px;
}

.theory-section h3,
.matrix-card h4 {
  margin: 0 0 10px;
  color: var(--color-ink);
}

.theory-section h3 {
  font-size: 15px;
}

.theory-section ul {
  margin: 0;
  padding-left: 20px;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.7;
}

.boundary-item::marker {
  color: var(--color-warning);
}

.formula-card,
.matrix-card {
  margin-top: 10px;
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

.matrix-placeholder {
  margin: 10px 0 0;
  color: var(--color-muted);
  font-size: 12px;
}

.matrix-card h4 {
  font-size: 13px;
}

.matrix-scroll {
  max-width: 100%;
  overflow-x: auto;
}

table {
  min-width: 420px;
  border-collapse: collapse;
  color: #334851;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

th,
td {
  padding: 7px 9px;
  border: 1px solid #dce5e8;
  text-align: right;
  white-space: nowrap;
}

th {
  color: var(--color-brand-deep);
  background: #edf5f5;
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
