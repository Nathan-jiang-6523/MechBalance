<script setup lang="ts">
import { computed, ref } from 'vue'
import { STRUCTURAL_MODULES, STRUCTURAL_STATUS_LABELS, STRUCTURAL_THEORY_CATALOG } from './catalog'
import StructuralTheory from './components/StructuralTheory.vue'
import type { StructuralModuleDescriptor, StructuralModuleId } from './types'

const props = withDefaults(defineProps<{
  moduleId?: StructuralModuleId
  showModuleSelector?: boolean
  compact?: boolean
}>(), {
  showModuleSelector: true,
  compact: false,
})

const emit = defineEmits<{
  'module-change': [moduleId: StructuralModuleId]
}>()

const internalActiveModuleId = ref<StructuralModuleId>('beam')
const activeModuleId = computed(() => props.moduleId ?? internalActiveModuleId.value)
const activeModule = computed(() =>
  STRUCTURAL_MODULES.find(({ id }) => id === activeModuleId.value)!,
)
const activeTheory = computed(() => STRUCTURAL_THEORY_CATALOG[activeModuleId.value])

function isSelectable(module: StructuralModuleDescriptor): boolean {
  return module.status === 'available' || module.status === 'beta'
}

function selectModule(module: StructuralModuleDescriptor): void {
  if (!isSelectable(module)) return
  internalActiveModuleId.value = module.id
  emit('module-change', module.id)
}
</script>

<template>
  <section class="structural-workspace" aria-labelledby="structural-workspace-title">
    <header v-if="!compact" class="structural-intro">
      <div>
        <span>P2 · 结构力学</span>
        <h2 id="structural-workspace-title">结构分析工作台</h2>
        <p>选择已通过内核 Gate 的分析模块；计划中能力保持禁用。</p>
      </div>
      <strong>2D · 线弹性 · 小变形</strong>
    </header>

    <section v-if="showModuleSelector" class="module-selector" aria-labelledby="structural-module-title">
      <div class="selector-heading">
        <div>
          <h3 id="structural-module-title">分析模块</h3>
          <p>状态表示当前可用级别，不代表后置能力已纳入 P2。</p>
        </div>
        <div class="status-legend" aria-label="模块状态说明">
          <span v-for="(label, status) in STRUCTURAL_STATUS_LABELS" :key="status" :data-status="status">
            {{ label }}
          </span>
        </div>
      </div>

      <div class="module-grid">
        <button
          v-for="module in STRUCTURAL_MODULES"
          :key="module.id"
          type="button"
          class="module-card"
          :class="{ 'is-active': module.id === activeModuleId }"
          :disabled="!isSelectable(module)"
          :aria-pressed="module.id === activeModuleId"
          :data-module-id="module.id"
          :data-status="module.status"
          @click="selectModule(module)"
        >
          <span class="module-index">{{ module.index }}</span>
          <span class="module-copy">
            <strong>{{ module.title }}</strong>
            <small>{{ module.summary }}</small>
          </span>
          <span class="module-status">{{ STRUCTURAL_STATUS_LABELS[module.status] }}</span>
        </button>
      </div>
    </section>

    <section class="module-stage" aria-live="polite" data-testid="structural-module-stage">
      <div>
        <span>{{ STRUCTURAL_STATUS_LABELS[activeModule.status] }}</span>
        <h3>{{ activeModule.title }}</h3>
        <p>{{ activeModule.summary }}</p>
      </div>
      <p class="stage-note">内核已就绪；在下方编辑模型、核对结构图并计算结果。</p>
    </section>

    <slot name="workspace" :module-id="activeModuleId" />

    <StructuralTheory v-if="activeTheory" :content="activeTheory" />
  </section>
</template>

<style scoped>
.structural-workspace {
  min-width: 0;
  display: grid;
  gap: 20px;
}

.structural-intro {
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

.structural-intro span,
.module-stage > div > span {
  color: var(--color-brand);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .06em;
}

.structural-intro h2 {
  margin: 5px 0 7px;
  font-size: clamp(19px, 2vw, 25px);
}

.structural-intro p,
.selector-heading p,
.module-stage p {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.6;
}

.structural-intro strong {
  flex: 0 0 auto;
  color: #72572d;
  font-size: 12px;
}

.module-selector {
  padding: 18px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-large);
  background: var(--color-panel);
  box-shadow: var(--shadow-panel);
}

.selector-heading {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.selector-heading h3,
.module-stage h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.status-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.status-legend span,
.module-status {
  padding: 4px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

[data-status="available"] .module-status,
.status-legend [data-status="available"] {
  color: var(--color-success);
  background: #edf8f1;
}

[data-status="beta"] .module-status,
.status-legend [data-status="beta"] {
  color: var(--color-warning);
  background: #fff5e8;
}

[data-status="planned"] .module-status,
.status-legend [data-status="planned"] {
  color: var(--color-muted);
  background: #edf1f3;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.module-card {
  min-width: 0;
  min-height: 92px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 14px;
  border: 1px solid #d7e0e4;
  border-radius: 10px;
  color: var(--color-ink);
  background: #fbfcfc;
  text-align: left;
}

.module-card:not(:disabled) {
  cursor: pointer;
}

.module-card:not(:disabled):hover,
.module-card.is-active {
  border-color: #8fbfc2;
  background: #eff8f8;
}

.module-card.is-active {
  box-shadow: inset 3px 0 0 var(--color-brand);
}

.module-card:disabled {
  cursor: not-allowed;
  opacity: .62;
}

.module-index {
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 800;
}

.module-copy {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.module-copy strong {
  font-size: 14px;
}

.module-copy small {
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.module-stage {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  padding: 16px 18px;
  border: 1px solid #c9ddde;
  border-radius: 10px;
  background: #edf7f7;
}

.stage-note {
  max-width: 390px;
  text-align: right;
}

@media (max-width: 760px) {
  .structural-intro,
  .selector-heading,
  .module-stage {
    flex-direction: column;
  }

  .status-legend {
    justify-content: flex-start;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }

  .stage-note {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 430px) {
  .module-card {
    grid-template-columns: 26px minmax(0, 1fr);
  }

  .module-status {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
