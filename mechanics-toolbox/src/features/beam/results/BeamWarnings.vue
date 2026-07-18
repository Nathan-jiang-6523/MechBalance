<script setup lang="ts">
import { computed } from 'vue'
import { buildBeamWarnings } from './presentation'

const props = withDefaults(
  defineProps<{
    spanLengthM: number
    sectionHeightM: number
    maximumDeflectionM: number
    warnings?: readonly string[]
  }>(),
  { warnings: () => [] },
)

const items = computed(() =>
  buildBeamWarnings(
    props.spanLengthM,
    props.sectionHeightM,
    props.maximumDeflectionM,
    props.warnings,
  ),
)
</script>

<template>
  <details class="warning-panel" :class="{ 'has-warning': items.length > 0 }" :open="items.length > 0">
    <summary>
      <span>适用性与计算警告</span>
      <strong>{{ items.length ? `${items.length} 项` : '无活动警告' }}</strong>
    </summary>
    <ul v-if="items.length">
      <li v-for="(item, index) in items" :key="`${item.code}-${index}`" :class="item.severity">
        <strong>{{ item.severity === 'strong' ? '强警告' : '提示' }}</strong>
        <span>{{ item.message }}</span>
      </li>
    </ul>
    <p v-else>当前输入未触发细长比或大挠度阈值警告。</p>
  </details>
</template>

<style scoped>
.warning-panel {
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: #f8fafb;
}

.warning-panel.has-warning {
  border-color: #e0a15b;
  background: #fff8ef;
}

summary {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 15px;
  cursor: pointer;
  color: #53636e;
  font-size: 12px;
  font-weight: 800;
}

summary strong {
  color: var(--color-warning);
}

ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 15px 15px;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #684825;
  background: #fff;
  font-size: 12px;
  line-height: 1.55;
}

li.strong {
  color: #8f342d;
  background: #fff0ed;
}

li strong {
  white-space: nowrap;
}

p {
  margin: 0;
  padding: 0 15px 15px;
  color: var(--color-muted);
  font-size: 12px;
}

@media (max-width: 580px) {
  li {
    grid-template-columns: 1fr;
  }
}
</style>
