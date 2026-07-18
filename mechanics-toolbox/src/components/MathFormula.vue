<script setup lang="ts">
import katex from 'katex'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  formula: string
  displayMode?: boolean
}>(), {
  displayMode: true,
})

const rendered = computed(() => katex.renderToString(props.formula, {
  displayMode: props.displayMode,
  throwOnError: false,
  strict: 'warn',
  trust: false,
  output: 'htmlAndMathml',
}))
</script>

<template>
  <div
    class="math-formula"
    :class="{ 'is-display': displayMode }"
    data-testid="math-formula"
    v-html="rendered"
  />
</template>

<style scoped>
.math-formula {
  max-width: 100%;
  color: #30454e;
  font-size: 1em;
}

.math-formula.is-display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 5px 2px;
  scrollbar-width: thin;
}

.math-formula :deep(.katex-display) {
  margin: .35em 0;
  text-align: left;
}

.math-formula :deep(.katex-display > .katex) {
  text-align: left;
}
</style>
