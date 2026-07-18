<script setup lang="ts">
import { computed } from 'vue'
import type { PlaneStressResult } from '../../core/stress'
import { formatEngineeringValue } from '../../core/numeric'

const props = defineProps<{ result: PlaneStressResult }>()

const geometry = computed(() => {
  const result = props.result
  const radius = result.mohrRadiusPa
  let domainMinimum = Math.min(result.sigma2Pa, 0)
  let domainMaximum = Math.max(result.sigma1Pa, 0)
  if (domainMaximum === domainMinimum) {
    domainMinimum -= 1
    domainMaximum += 1
  }
  const span = domainMaximum - domainMinimum
  const domainCenter = (domainMinimum + domainMaximum) / 2
  const scale = Math.min(390 / (span * 1.16), radius > 0 ? 92 / radius : Number.POSITIVE_INFINITY)
  const cy = 142
  const mapX = (stressPa: number) => 260 + (stressPa - domainCenter) * scale
  const cx = mapX(result.mohrCenterPa)
  const plotRadius = radius * scale
  const pointAx = mapX(result.sigmaXPa)
  const pointAy = cy - result.tauXyPa * scale
  const pointBx = mapX(result.sigmaYPa)
  const pointBy = cy + result.tauXyPa * scale
  return {
    cx,
    cy,
    plotRadius,
    zeroX: mapX(0),
    pointAx,
    pointAy,
    pointBx,
    pointBy,
    sigma1X: mapX(result.sigma1Pa),
    sigma2X: mapX(result.sigma2Pa),
  }
})

function mpa(value: number): string {
  return formatEngineeringValue(value / 1e6)
}

const doubledAngle = computed(() =>
  props.result.principalAngleRad === null
    ? '任意'
    : `${formatEngineeringValue((2 * props.result.principalAngleRad * 180) / Math.PI)}°`,
)
</script>

<template>
  <figure class="mohr-card" aria-labelledby="mohr-title">
    <figcaption id="mohr-title">
      <strong>平面应力莫尔圆</strong>
      <span>τ 轴向上；物理逆时针 θ → 圆上顺时针 2θ</span>
    </figcaption>
    <svg viewBox="0 0 520 300" role="img" aria-label="平面应力莫尔圆与原始应力点">
      <defs>
        <marker id="stress-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#65747c" />
        </marker>
      </defs>
      <line x1="30" :y1="geometry.cy" x2="495" :y2="geometry.cy" class="axis" marker-end="url(#stress-arrow)" />
      <line :x1="geometry.zeroX" y1="260" :x2="geometry.zeroX" y2="24" class="axis axis-muted" marker-end="url(#stress-arrow)" />
      <text x="492" :y="geometry.cy - 9" text-anchor="end" class="axis-label">σ</text>
      <text :x="geometry.zeroX + 9" y="31" class="axis-label">τ（σ=0）</text>

      <circle
        v-if="result.mohrRadiusPa > 0"
        :cx="geometry.cx"
        :cy="geometry.cy"
        :r="geometry.plotRadius"
        class="circle"
      />
      <circle v-else :cx="geometry.cx" :cy="geometry.cy" r="5" class="degenerate" />
      <line
        v-if="result.mohrRadiusPa > 0"
        :x1="geometry.pointAx"
        :y1="geometry.pointAy"
        :x2="geometry.pointBx"
        :y2="geometry.pointBy"
        class="diameter"
      />

      <circle :cx="geometry.pointAx" :cy="geometry.pointAy" r="5" class="point point-a" />
      <circle :cx="geometry.pointBx" :cy="geometry.pointBy" r="5" class="point point-b" />
      <text :x="geometry.pointAx + 9" :y="geometry.pointAy - 8" class="point-label">A(σx, τxy)</text>
      <text :x="geometry.pointBx + 9" :y="geometry.pointBy + 18" class="point-label">B(σy, −τxy)</text>

      <circle :cx="geometry.sigma2X" :cy="geometry.cy" r="4" class="principal" />
      <circle :cx="geometry.sigma1X" :cy="geometry.cy" r="4" class="principal" />
      <text :x="geometry.sigma2X" :y="geometry.cy + 19" text-anchor="middle" class="value-label">σ2 {{ mpa(result.sigma2Pa) }}</text>
      <text :x="geometry.sigma1X" :y="geometry.cy + 19" text-anchor="middle" class="value-label">σ1 {{ mpa(result.sigma1Pa) }}</text>
      <text :x="geometry.cx" y="282" text-anchor="middle" class="relation-label">
        C = {{ mpa(result.mohrCenterPa) }} MPa · R = {{ mpa(result.mohrRadiusPa) }} MPa · 2θp = {{ doubledAngle }}
      </text>
    </svg>
  </figure>
</template>

<style scoped>
.mohr-card {
  margin: 0;
  padding: 14px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: #fff;
}

figcaption {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

figcaption strong { font-size: 13px; }
figcaption span { color: var(--color-muted); font-size: 10px; }
svg { width: 100%; min-width: 420px; display: block; }
.axis { stroke: #65747c; stroke-width: 1.2; }
.axis-muted { stroke-dasharray: 4 4; opacity: .45; }
.axis-label { fill: #4d5c64; font-size: 12px; font-weight: 800; }
.circle { fill: rgb(18 106 115 / 7%); stroke: var(--color-brand); stroke-width: 2; }
.diameter { stroke: #d37b34; stroke-width: 1.4; stroke-dasharray: 5 3; }
.point { stroke: #fff; stroke-width: 2; }
.point-a { fill: #d05a4e; }
.point-b { fill: #416f9c; }
.principal, .degenerate { fill: var(--color-brand-deep); }
.point-label { fill: #4d5c64; font-size: 10px; font-weight: 700; }
.value-label { fill: #34444c; font-size: 10px; font-weight: 700; }
.relation-label { fill: #566a72; font-size: 10px; }

@media (max-width: 600px) {
  .mohr-card { overflow-x: auto; }
  figcaption { min-width: 420px; flex-direction: column; }
}
</style>
