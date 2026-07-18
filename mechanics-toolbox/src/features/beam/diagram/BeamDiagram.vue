<script setup lang="ts">
import { computed, useId } from 'vue'

import type { BeamLoad, BeamSupport } from '../../../core/beam/types'

const props = defineProps<{
  lengthM: number
  support: BeamSupport
  loads: BeamLoad[]
}>()

const SVG_LEFT = 64
const SVG_RIGHT = 610
const BEAM_Y = 145
const LEGEND_X = 668

const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const axisArrowId = `beam-axis-arrow-${uid}`
const dimensionArrowId = `beam-dimension-arrow-${uid}`
const forceArrowId = `beam-force-arrow-${uid}`
const momentArrowId = `beam-moment-arrow-${uid}`
const uniformArrowId = `beam-uniform-arrow-${uid}`

const safeLengthM = computed(() =>
  Number.isFinite(props.lengthM) && props.lengthM > 0 ? props.lengthM : 1,
)

function xAt(positionM: number): number {
  if (!Number.isFinite(positionM)) return SVG_LEFT
  const ratio = Math.min(1, Math.max(0, positionM / safeLengthM.value))
  return SVG_LEFT + ratio * (SVG_RIGHT - SVG_LEFT)
}

function pointPosition(load: BeamLoad): number | null {
  return load.type === 'uniformLoad' ? null : load.positionM
}

function duplicateOffset(load: BeamLoad, index: number): number {
  const position = pointPosition(load)
  if (position === null) return 0

  let duplicateIndex = 0
  for (let i = 0; i < index; i += 1) {
    const earlier = props.loads[i]
    if (earlier && pointPosition(earlier) === position) duplicateIndex += 1
  }

  const offsets = [0, -10, 10, -20, 20, -30, 30]
  return offsets[duplicateIndex] ?? (duplicateIndex % 2 === 0 ? 36 : -36)
}

function signOf(value: number): 'positive' | 'negative' | 'zero' {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'zero'
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude >= 1e6 || magnitude < 1e-3) return value.toExponential(3)
  return Number(value.toPrecision(4)).toString()
}

function formatSigned(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value)
}

function formatForce(valueN: number): string {
  return Math.abs(valueN) >= 1_000
    ? `${formatSigned(valueN / 1_000)} kN`
    : `${formatSigned(valueN)} N`
}

function formatMoment(valueNm: number): string {
  return Math.abs(valueNm) >= 1_000
    ? `${formatSigned(valueNm / 1_000)} kN·m`
    : `${formatSigned(valueNm)} N·m`
}

function formatUniformLoad(valueNPerM: number): string {
  return Math.abs(valueNPerM) >= 1_000
    ? `${formatSigned(valueNPerM / 1_000)} kN/m`
    : `${formatSigned(valueNPerM)} N/m`
}

function formatPosition(valueM: number): string {
  return `${formatNumber(valueM)} m`
}

function legendText(load: BeamLoad): string {
  if (load.type === 'pointForce') {
    return `F=${formatForce(load.forceN)}，x=${formatPosition(load.positionM)}`
  }
  if (load.type === 'pointMoment') {
    return `M=${formatMoment(load.momentNm)}，x=${formatPosition(load.positionM)}`
  }
  return `q=${formatUniformLoad(load.intensityNPerM)}，${formatPosition(load.startM)}～${formatPosition(load.endM)}`
}

function forceLine(load: BeamLoad, index: number): { x: number; y1: number; y2: number } {
  const x = xAt(load.type === 'uniformLoad' ? load.startM : load.positionM) + duplicateOffset(load, index)
  if (load.type !== 'pointForce' || load.forceN >= 0) return { x, y1: BEAM_Y - 5, y2: 52 }
  return { x, y1: 52, y2: BEAM_Y - 5 }
}

function momentPath(load: BeamLoad, index: number): string {
  if (load.type !== 'pointMoment') return ''
  const x = xAt(load.positionM) + duplicateOffset(load, index)
  return load.momentNm >= 0
    ? `M ${x + 22} 119 A 27 27 0 1 0 ${x - 22} 119`
    : `M ${x - 22} 119 A 27 27 0 1 1 ${x + 22} 119`
}

function uniformArrowPositions(load: BeamLoad): number[] {
  if (load.type !== 'uniformLoad') return []
  const startX = xAt(Math.min(load.startM, load.endM))
  const endX = xAt(Math.max(load.startM, load.endM))
  const span = Math.max(0, endX - startX)
  const count = Math.max(2, Math.min(9, Math.floor(span / 55) + 1))
  return Array.from({ length: count }, (_, index) =>
    count === 1 ? startX : startX + (span * index) / (count - 1),
  )
}

function uniformRailY(index: number): number {
  return 53 + (index % 4) * 8
}
</script>

<template>
  <div class="beam-diagram-scroll" role="region" aria-label="梁、支承及载荷示意图，可横向滚动查看">
    <svg class="beam-diagram" viewBox="0 0 860 300" role="img" aria-labelledby="beam-diagram-title">
      <title id="beam-diagram-title">梁载荷示意：x 轴向右，向上力为正，逆时针力矩为正</title>
      <defs>
        <marker :id="axisArrowId" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#687982" />
        </marker>
        <marker
          :id="dimensionArrowId"
          markerWidth="7"
          markerHeight="7"
          refX="3.5"
          refY="3.5"
          orient="auto-start-reverse"
        >
          <path d="M0,3.5 L7,0 L7,7 Z" fill="#9a5a18" />
        </marker>
        <marker :id="forceArrowId" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#b64835" />
        </marker>
        <marker :id="momentArrowId" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#7d4d9c" />
        </marker>
        <marker :id="uniformArrowId" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#2673a6" />
        </marker>
      </defs>

      <g class="diagram-zone" data-label-zone="diagram" data-zone-max-x="640">
        <line class="beam-line" :x1="SVG_LEFT" :x2="SVG_RIGHT" :y1="BEAM_Y" :y2="BEAM_Y" />

        <g v-if="support === 'simplySupported'" data-support="simplySupported" aria-label="简支梁：左铰右滚">
          <path class="support" :d="`M ${SVG_LEFT} ${BEAM_Y + 2} l -18 29 h 36 Z`" />
          <line class="ground" :x1="SVG_LEFT - 25" :x2="SVG_LEFT + 25" y1="178" y2="178" />
          <path class="support" :d="`M ${SVG_RIGHT} ${BEAM_Y + 2} l -18 25 h 36 Z`" />
          <circle class="roller" :cx="SVG_RIGHT - 10" cy="176" r="4" />
          <circle class="roller" :cx="SVG_RIGHT + 10" cy="176" r="4" />
          <line class="ground" :x1="SVG_RIGHT - 25" :x2="SVG_RIGHT + 25" y1="183" y2="183" />
          <text class="support-label" :x="SVG_LEFT" y="198">铰支</text>
          <text class="support-label" :x="SVG_RIGHT" y="198">滚支</text>
        </g>

        <g v-else-if="support === 'cantileverLeft'" data-support="cantileverLeft" aria-label="左端固定悬臂梁">
          <line class="fixed-wall" :x1="SVG_LEFT" :x2="SVG_LEFT" y1="109" y2="181" />
          <path class="hatch" :d="`M ${SVG_LEFT - 17} 116 l 17 -10 M ${SVG_LEFT - 17} 132 l 17 -10 M ${SVG_LEFT - 17} 148 l 17 -10 M ${SVG_LEFT - 17} 164 l 17 -10 M ${SVG_LEFT - 17} 180 l 17 -10`" />
          <text class="support-label" :x="SVG_LEFT" y="198">固定端</text>
        </g>

        <g v-else data-support="cantileverRight" aria-label="右端固定悬臂梁">
          <line class="fixed-wall" :x1="SVG_RIGHT" :x2="SVG_RIGHT" y1="109" y2="181" />
          <path class="hatch" :d="`M ${SVG_RIGHT} 106 l 17 10 M ${SVG_RIGHT} 122 l 17 10 M ${SVG_RIGHT} 138 l 17 10 M ${SVG_RIGHT} 154 l 17 10 M ${SVG_RIGHT} 170 l 17 10`" />
          <text class="support-label" :x="SVG_RIGHT" y="198">固定端</text>
        </g>

        <template v-for="(load, index) in loads" :key="index">
          <g
            v-if="load.type === 'pointForce'"
            class="load point-force"
            data-load-type="pointForce"
            :data-load-index="index"
            :data-direction="load.forceN > 0 ? 'positive-up' : load.forceN < 0 ? 'negative-down' : 'zero'"
            :aria-label="legendText(load)"
          >
            <line
              v-if="load.forceN !== 0"
              class="point-force-line"
              :x1="forceLine(load, index).x"
              :x2="forceLine(load, index).x"
              :y1="forceLine(load, index).y1"
              :y2="forceLine(load, index).y2"
              :marker-end="`url(#${forceArrowId})`"
            />
            <circle v-else class="zero-load" :cx="forceLine(load, index).x" :cy="BEAM_Y - 7" r="4" />
            <text class="load-index" :x="forceLine(load, index).x + 7" y="46">{{ index + 1 }}</text>
          </g>

          <g
            v-else-if="load.type === 'pointMoment'"
            class="load point-moment"
            data-load-type="pointMoment"
            :data-load-index="index"
            :data-direction="load.momentNm > 0 ? 'positive-ccw' : load.momentNm < 0 ? 'negative-cw' : 'zero'"
            :aria-label="legendText(load)"
          >
            <path
              v-if="load.momentNm !== 0"
              class="moment-arc"
              :d="momentPath(load, index)"
              :marker-end="`url(#${momentArrowId})`"
            />
            <circle
              v-else
              class="zero-load"
              :cx="xAt(load.positionM) + duplicateOffset(load, index)"
              cy="111"
              r="4"
            />
            <text
              class="load-index moment-index"
              :x="xAt(load.positionM) + duplicateOffset(load, index)"
              y="115"
            >{{ index + 1 }}</text>
          </g>

          <g
            v-else
            class="load uniform-load"
            data-load-type="uniformLoad"
            :data-load-index="index"
            :data-direction="load.intensityNPerM > 0 ? 'positive-up' : load.intensityNPerM < 0 ? 'negative-down' : 'zero'"
            :aria-label="legendText(load)"
          >
            <line
              class="uniform-rail"
              :x1="xAt(Math.min(load.startM, load.endM))"
              :x2="xAt(Math.max(load.startM, load.endM))"
              :y1="uniformRailY(index)"
              :y2="uniformRailY(index)"
            />
            <line
              v-for="arrowX in uniformArrowPositions(load)"
              :key="arrowX"
              class="uniform-arrow"
              :x1="arrowX"
              :x2="arrowX"
              :y1="load.intensityNPerM >= 0 ? BEAM_Y - 5 : uniformRailY(index)"
              :y2="load.intensityNPerM >= 0 ? uniformRailY(index) : BEAM_Y - 5"
              :marker-end="load.intensityNPerM === 0 ? undefined : `url(#${uniformArrowId})`"
            />
            <text
              class="load-index uniform-index"
              :x="(xAt(load.startM) + xAt(load.endM)) / 2"
              :y="uniformRailY(index) - 7"
            >{{ index + 1 }}</text>
          </g>
        </template>

        <line class="axis" :x1="SVG_LEFT" :x2="SVG_RIGHT + 20" y1="216" y2="216" :marker-end="`url(#${axisArrowId})`" />
        <text class="axis-label" :x="SVG_LEFT - 4" y="232">0</text>
        <text class="axis-label axis-x-label" :x="SVG_RIGHT + 9" y="232">x（向右）</text>

        <line class="witness" :x1="SVG_LEFT" :x2="SVG_LEFT" :y1="BEAM_Y + 5" y2="279" />
        <line class="witness" :x1="SVG_RIGHT" :x2="SVG_RIGHT" :y1="BEAM_Y + 5" y2="279" />
        <line
          class="dimension-line"
          :x1="SVG_LEFT + 5"
          :x2="SVG_RIGHT - 5"
          y1="274"
          y2="274"
          :marker-start="`url(#${dimensionArrowId})`"
          :marker-end="`url(#${dimensionArrowId})`"
        />
        <text class="dimension-label" :x="(SVG_LEFT + SVG_RIGHT) / 2" y="266">L = {{ formatPosition(lengthM) }}</text>
      </g>

      <line class="legend-separator" x1="646" x2="646" y1="12" y2="286" />
      <g class="legend-zone" data-label-zone="legend" data-zone-min-x="668">
        <text class="legend-title" :x="LEGEND_X" y="20">载荷（正号按全局约定）</text>
        <text
          v-for="(load, index) in loads"
          :key="`legend-${index}`"
          class="legend-item"
          :class="`legend-${load.type}`"
          :x="LEGEND_X"
          :y="43 + index * 22"
          :data-load-index="index"
        >{{ index + 1 }}. {{ legendText(load) }}</text>
        <text v-if="loads.length === 0" class="legend-empty" :x="LEGEND_X" y="47">暂无载荷</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.beam-diagram-scroll {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-gutter: stable;
}

.beam-diagram {
  display: block;
  width: 100%;
  min-width: 760px;
  height: auto;
  color: #31464e;
}

.beam-diagram :is(line, path, circle) {
  vector-effect: non-scaling-stroke;
}

.beam-line {
  stroke: #174f58;
  stroke-width: 6;
  stroke-linecap: round;
}

.support {
  fill: #d9eeee;
  stroke: #11646d;
  stroke-width: 2;
}

.ground,
.fixed-wall,
.hatch {
  fill: none;
  stroke: #11646d;
  stroke-width: 2;
}

.fixed-wall {
  stroke-width: 6;
}

.roller {
  fill: #fff;
  stroke: #11646d;
  stroke-width: 1.5;
}

text {
  fill: #52636d;
  font-family: inherit;
  font-size: 12px;
  font-weight: 650;
  paint-order: stroke;
  stroke: #f8fbfb;
  stroke-linejoin: round;
  stroke-width: 3px;
}

.support-label,
.axis-label,
.dimension-label,
.load-index {
  text-anchor: middle;
}

.axis {
  stroke: #687982;
  stroke-width: 1.2;
}

.axis-label {
  font-size: 11px;
}

.axis-x-label {
  text-anchor: start;
}

.witness {
  stroke: #9a5a18;
  stroke-width: 0.8;
  stroke-dasharray: 3 3;
}

.dimension-line {
  stroke: #9a5a18;
  stroke-width: 1;
}

.dimension-label {
  fill: #9a5a18;
}

.point-force-line {
  stroke: #b64835;
  stroke-width: 2.2;
}

.moment-arc {
  fill: none;
  stroke: #7d4d9c;
  stroke-width: 2.2;
}

.uniform-rail,
.uniform-arrow {
  stroke: #2673a6;
  stroke-width: 1.8;
}

.zero-load {
  fill: #fff;
  stroke: #7a858a;
  stroke-width: 2;
}

.load-index {
  font-size: 10px;
}

.moment-index {
  fill: #7d4d9c;
}

.uniform-index {
  fill: #2673a6;
}

.legend-separator {
  stroke: #c8d5d8;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.legend-title {
  fill: #31464e;
  font-size: 12px;
}

.legend-item,
.legend-empty {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.legend-pointForce {
  fill: #9b392b;
}

.legend-pointMoment {
  fill: #6f428d;
}

.legend-uniformLoad {
  fill: #1f628d;
}

@media (max-width: 720px) {
  .beam-diagram {
    min-width: 720px;
  }
}
</style>
