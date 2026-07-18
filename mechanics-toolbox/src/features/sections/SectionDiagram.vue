<script setup lang="ts">
import type { SectionKind } from '../../core/sections'

defineProps<{ kind: SectionKind }>()
</script>

<template>
  <svg class="section-diagram" viewBox="0 0 280 190" role="img">
    <title>当前截面输入示意，x 轴向右，y 轴向上</title>
    <defs>
      <marker id="axis-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 Z" fill="#687982" />
      </marker>
      <marker id="dimension-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse">
        <path d="M0,3 L6,0 L6,6 Z" fill="#9a5a18" />
      </marker>
    </defs>

    <g class="shape">
      <rect v-if="kind === 'rectangle'" x="70" y="35" width="140" height="120" rx="2" />

      <template v-else-if="kind === 'hollowRectangle'">
        <path d="M55 30H225V160H55Z M80 53V137H200V53Z" fill-rule="evenodd" />
      </template>

      <circle v-else-if="kind === 'solidCircle'" cx="140" cy="95" r="65" />

      <template v-else>
        <path
          d="M140 25a70 70 0 1 1 0 140a70 70 0 1 1 0-140 M140 51a44 44 0 1 0 0 88a44 44 0 1 0 0-88"
          fill-rule="evenodd"
        />
      </template>
    </g>

    <line class="axis" x1="32" y1="95" x2="250" y2="95" marker-end="url(#axis-arrow)" />
    <line class="axis" x1="140" y1="174" x2="140" y2="14" marker-end="url(#axis-arrow)" />
    <text x="254" y="100">x</text>
    <text x="146" y="17">y</text>

    <template v-if="kind === 'rectangle'">
      <line class="witness" x1="70" y1="155" x2="70" y2="176" />
      <line class="witness" x1="210" y1="155" x2="210" y2="176" />
      <line class="dimension-line" x1="74" y1="172" x2="206" y2="172" />
      <text class="dimension" x="137" y="187">b</text>
      <line class="witness" x1="210" y1="35" x2="231" y2="35" />
      <line class="witness" x1="210" y1="155" x2="231" y2="155" />
      <line class="dimension-line" x1="227" y1="39" x2="227" y2="151" />
      <text class="dimension" x="234" y="99">h</text>
    </template>
    <template v-else-if="kind === 'hollowRectangle'">
      <line class="witness" x1="55" y1="160" x2="55" y2="178" />
      <line class="witness" x1="225" y1="160" x2="225" y2="178" />
      <line class="dimension-line" x1="59" y1="174" x2="221" y2="174" />
      <text class="dimension" x="132" y="188">B / b</text>
      <line class="witness" x1="225" y1="30" x2="246" y2="30" />
      <line class="witness" x1="225" y1="160" x2="246" y2="160" />
      <line class="dimension-line" x1="242" y1="34" x2="242" y2="156" />
      <text class="dimension" x="248" y="99">H / h</text>
    </template>
    <template v-else-if="kind === 'solidCircle'">
      <line class="dimension-line" x1="96" y1="51" x2="184" y2="139" />
      <text class="dimension" x="166" y="73">d</text>
    </template>
    <template v-else>
      <line class="dimension-line" x1="93" y1="48" x2="187" y2="142" />
      <line class="dimension-line inner" x1="109" y1="64" x2="171" y2="126" />
      <text class="dimension" x="174" y="71">D</text>
      <text class="dimension" x="151" y="111">d</text>
    </template>
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

text {
  fill: #52636d;
  font-size: 11px;
  font-weight: 700;
}

.dimension {
  fill: #9a5a18;
}

.dimension-line {
  stroke: #9a5a18;
  stroke-width: 1;
  marker-start: url(#dimension-arrow);
  marker-end: url(#dimension-arrow);
}

.dimension-line.inner {
  stroke-dasharray: 3 2;
}

.witness {
  stroke: #9a5a18;
  stroke-width: 0.8;
}
</style>
