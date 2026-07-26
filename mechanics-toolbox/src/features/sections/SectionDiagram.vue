<script setup lang="ts">
import { computed } from 'vue'
import type { SectionCalculatorKind } from '../../core/sections'

const props = defineProps<{ kind: SectionCalculatorKind }>()

const symbols = computed(() => {
  switch (props.kind) {
    case 'rectangle': return 'b × h'
    case 'hollowRectangle': return 'B × H / b × h'
    case 'solidCircle': return 'd'
    case 'circularTube': return 'D / d'
    case 'regularHexagon':
    case 'regularOctagon': return 's 或 R'
    case 'semicircle': return 'd'
    case 'semiAnnulus': return 'D / d'
    case 'circularSector':
    case 'circularSegment': return 'r / α'
    case 'annularSector': return 'R / r / α'
    case 'ellipse': return 'a / b'
    case 'hollowEllipse': return 'a / b / a₁ / b₁'
    case 'squareCircularHole': return 'a / d'
    case 'circleCrossSlot': return 'd / d₁'
    case 'rectangleCrossSlot': return 'b / H / h'
  }
})
</script>

<template>
  <svg class="section-diagram" viewBox="0 0 280 190" role="img">
    <title>当前截面输入示意；x 轴向右，y 轴向上</title>
    <defs>
      <marker id="axis-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 Z" fill="#687982" />
      </marker>
      <marker id="radius-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 Z" fill="#9a5a18" />
      </marker>
    </defs>

    <circle
      v-if="kind === 'regularHexagon'"
      class="circumcircle"
      data-circumcircle
      cx="140"
      cy="95"
      r="70"
    />
    <circle
      v-else-if="kind === 'regularOctagon'"
      class="circumcircle"
      data-circumcircle
      cx="140"
      cy="95"
      r="75"
    />

    <g class="shape">
      <rect v-if="kind === 'rectangle'" x="70" y="35" width="140" height="120" rx="2" />

      <path
        v-else-if="kind === 'hollowRectangle'"
        d="M55 30H225V160H55Z M80 53V137H200V53Z"
        fill-rule="evenodd"
      />

      <circle v-else-if="kind === 'solidCircle'" cx="140" cy="95" r="65" />

      <path
        v-else-if="kind === 'circularTube'"
        d="M140 25a70 70 0 1 1 0 140a70 70 0 1 1 0-140 M140 51a44 44 0 1 0 0 88a44 44 0 1 0 0-88"
        fill-rule="evenodd"
      />

      <polygon
        v-else-if="kind === 'regularHexagon'"
        data-regular-polygon
        points="210,95 175,34.378 105,34.378 70,95 105,155.622 175,155.622"
      />

      <polygon
        v-else-if="kind === 'regularOctagon'"
        data-regular-polygon
        points="168.701,25.709 209.291,66.299 209.291,123.701 168.701,164.291 111.299,164.291 70.709,123.701 70.709,66.299 111.299,25.709"
      />

      <path v-else-if="kind === 'semicircle'" d="M65 130A75 75 0 0 1 215 130Z" />

      <path
        v-else-if="kind === 'semiAnnulus'"
        d="M50 135A90 90 0 0 1 230 135H195A55 55 0 0 0 85 135Z"
        fill-rule="evenodd"
      />

      <path
        v-else-if="kind === 'circularSector'"
        d="M140 145L78 60A90 90 0 0 1 202 60Z"
      />

      <path
        v-else-if="kind === 'circularSegment'"
        d="M65 125A88 88 0 0 1 215 125Z"
      />

      <path
        v-else-if="kind === 'annularSector'"
        d="M140 155L72 62A98 98 0 0 1 208 62Z M140 125L105 77A50 50 0 0 1 175 77Z"
        fill-rule="evenodd"
      />

      <ellipse v-else-if="kind === 'ellipse'" cx="140" cy="95" rx="86" ry="58" />

      <path
        v-else-if="kind === 'hollowEllipse'"
        d="M54 95a86 58 0 1 0 172 0a86 58 0 1 0-172 0 M82 95a58 35 0 1 1 116 0a58 35 0 1 1-116 0"
        fill-rule="evenodd"
      />

      <path
        v-else-if="kind === 'squareCircularHole'"
        d="M65 25H215V165H65Z M140 60a35 35 0 1 0 0 70a35 35 0 1 0 0-70"
        fill-rule="evenodd"
      />

      <path
        v-else-if="kind === 'circleCrossSlot'"
        d="M140 25a70 70 0 1 1 0 140a70 70 0 1 1 0-140 M130 25H150V165H130Z"
        fill-rule="evenodd"
      />

      <template v-else>
        <rect x="65" y="25" width="150" height="48" />
        <rect x="65" y="117" width="150" height="48" />
      </template>
    </g>

    <template v-if="kind === 'regularHexagon'">
      <line
        class="radius-guide"
        data-radius-guide
        x1="140"
        y1="95"
        x2="175"
        y2="34.378"
        marker-end="url(#radius-arrow)"
      />
      <text class="radius-label" x="149" y="60">R</text>
    </template>
    <template v-else-if="kind === 'regularOctagon'">
      <line
        class="radius-guide"
        data-radius-guide
        x1="140"
        y1="95"
        x2="168.701"
        y2="25.709"
        marker-end="url(#radius-arrow)"
      />
      <text class="radius-label" x="148" y="56">R</text>
    </template>

    <line class="axis axis-x" x1="30" y1="95" x2="250" y2="95" marker-end="url(#axis-arrow)" />
    <line class="axis axis-y" x1="140" y1="174" x2="140" y2="14" marker-end="url(#axis-arrow)" />
    <text class="axis-label axis-label-x" x="258" y="88">x</text>
    <text class="axis-label" x="148" y="18">y</text>
    <text
      v-if="kind === 'rectangle' || kind === 'hollowRectangle'"
      class="dimension"
      data-dimension="height"
      x="232"
      y="55"
    >{{ kind === 'rectangle' ? 'h' : 'H / h' }}</text>
    <text class="symbols" x="140" y="184" text-anchor="middle">{{ symbols }}</text>
  </svg>
</template>

<style scoped>
.section-diagram {
  width: 100%;
  max-height: 230px;
}

.shape {
  fill: #d9eeee;
  stroke: #11646d;
  stroke-width: 2;
}

.axis {
  stroke: #687982;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.circumcircle {
  fill: none;
  stroke: #9a5a18;
  stroke-width: 1.2;
  stroke-dasharray: 5 4;
}

.radius-guide {
  stroke: #9a5a18;
  stroke-width: 1.2;
  stroke-dasharray: 4 3;
}

.radius-label {
  fill: #9a5a18;
  paint-order: stroke;
  stroke: #f1f6f6;
  stroke-width: 4px;
}

text {
  fill: #52636d;
  font-size: 11px;
  font-weight: 700;
}

.symbols {
  fill: #9a5a18;
  paint-order: stroke;
  stroke: #f1f6f6;
  stroke-width: 4px;
  stroke-linejoin: round;
}

.dimension {
  fill: #9a5a18;
  paint-order: stroke;
  stroke: #f1f6f6;
  stroke-width: 4px;
}
</style>
