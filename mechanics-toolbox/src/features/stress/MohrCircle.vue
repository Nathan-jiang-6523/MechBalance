<script setup lang="ts">
import { computed } from 'vue'
import type { PlaneStressResult } from '../../core/stress'
import { formatEngineeringValue } from '../../core/numeric'

const props = defineProps<{ result: PlaneStressResult }>()

interface LabelPlacement {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
}

const geometry = computed(() => {
  const result = props.result
  const radius = result.mohrRadiusPa
  const cx = 260
  const cy = 146
  const plotRadius = radius > 0 ? 94 : 0
  const scale = radius > 0 ? plotRadius / radius : 0
  const mapX = (stressPa: number) => cx + (stressPa - result.mohrCenterPa) * scale
  const pointAx = mapX(result.sigmaXPa)
  const pointAy = cy - result.tauXyPa * scale
  const pointBx = mapX(result.sigmaYPa)
  const pointBy = cy + result.tauXyPa * scale
  const stressScale = Math.max(
    Math.abs(result.sigmaXPa),
    Math.abs(result.sigmaYPa),
    radius,
    1,
  )
  const axisAligned = radius > 0 && Math.abs(result.tauXyPa) <= 1e-12 * stressScale

  const placePointLabel = (
    x: number,
    y: number,
    point: 'A' | 'B',
  ): LabelPlacement => {
    const nearVerticalDiameter = Math.abs(x - cx) < 18
    const leftSide = x < cx
    const anchor = nearVerticalDiameter
      ? point === 'A' ? 'start' : 'end'
      : leftSide ? 'end' : 'start'
    const labelX = x + (anchor === 'start' ? 9 : -9)
    const nearStressAxis = Math.abs(y - cy) < 27
    const labelY = nearStressAxis ? cy - 12 : y < cy ? y - 10 : y + 19
    return { x: labelX, y: labelY, anchor }
  }

  const zeroX = radius > 0 ? mapX(0) : Number.NaN
  return {
    cx,
    cy,
    plotRadius,
    zeroX,
    zeroVisible: Number.isFinite(zeroX) && zeroX >= 38 && zeroX <= 482,
    pointAx,
    pointAy,
    pointBx,
    pointBy,
    axisAligned,
    sigma1PointName: result.sigmaXPa >= result.sigmaYPa ? 'A' : 'B',
    sigma2PointName: result.sigmaXPa >= result.sigmaYPa ? 'B' : 'A',
    pointALabel: placePointLabel(pointAx, pointAy, 'A'),
    pointBLabel: placePointLabel(pointBx, pointBy, 'B'),
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
      <line
        v-if="geometry.zeroVisible"
        :x1="geometry.zeroX"
        y1="260"
        :x2="geometry.zeroX"
        y2="24"
        class="axis axis-muted"
        marker-end="url(#stress-arrow)"
      />
      <text x="492" :y="geometry.cy - 9" text-anchor="end" class="axis-label" data-mohr-label>+σ</text>
      <text x="38" y="31" class="axis-label" data-mohr-label>+τ（向上）</text>

      <circle
        v-if="result.mohrRadiusPa > 0"
        :cx="geometry.cx"
        :cy="geometry.cy"
        :r="geometry.plotRadius"
        class="circle"
      />
      <line
        v-if="result.mohrRadiusPa > 0"
        :x1="geometry.pointAx"
        :y1="geometry.pointAy"
        :x2="geometry.pointBx"
        :y2="geometry.pointBy"
        class="diameter"
      />

      <template v-if="result.mohrRadiusPa > 0">
        <template v-if="geometry.axisAligned">
          <circle :cx="geometry.sigma2X" :cy="geometry.cy" r="5" class="principal" />
          <circle :cx="geometry.sigma1X" :cy="geometry.cy" r="5" class="principal" />
          <text
            :x="geometry.sigma2X - 12"
            :y="geometry.cy - 11"
            text-anchor="end"
            class="combined-label"
            data-mohr-label
            data-mohr-combined
          >{{ geometry.sigma2PointName }} = σ2 = {{ mpa(result.sigma2Pa) }} MPa</text>
          <text
            :x="geometry.sigma1X + 12"
            :y="geometry.cy - 11"
            text-anchor="start"
            class="combined-label"
            data-mohr-label
            data-mohr-combined
          >{{ geometry.sigma1PointName }} = σ1 = {{ mpa(result.sigma1Pa) }} MPa</text>
        </template>
        <template v-else>
          <circle :cx="geometry.pointAx" :cy="geometry.pointAy" r="5" class="point point-a" />
          <circle :cx="geometry.pointBx" :cy="geometry.pointBy" r="5" class="point point-b" />
          <text
            :x="geometry.pointALabel.x"
            :y="geometry.pointALabel.y"
            :text-anchor="geometry.pointALabel.anchor"
            class="point-label"
            data-mohr-label
            data-mohr-point-label
          >A(σx, τxy)</text>
          <text
            :x="geometry.pointBLabel.x"
            :y="geometry.pointBLabel.y"
            :text-anchor="geometry.pointBLabel.anchor"
            class="point-label"
            data-mohr-label
            data-mohr-point-label
          >B(σy, −τxy)</text>

          <circle :cx="geometry.sigma2X" :cy="geometry.cy" r="4" class="principal" />
          <circle :cx="geometry.sigma1X" :cy="geometry.cy" r="4" class="principal" />
          <text :x="geometry.sigma2X" :y="geometry.cy + 22" text-anchor="middle" class="value-label" data-mohr-label data-mohr-principal-label>σ2 {{ mpa(result.sigma2Pa) }}</text>
          <text :x="geometry.sigma1X" :y="geometry.cy + 22" text-anchor="middle" class="value-label" data-mohr-label data-mohr-principal-label>σ1 {{ mpa(result.sigma1Pa) }}</text>
        </template>
      </template>
      <template v-else>
        <circle :cx="geometry.cx" :cy="geometry.cy" r="5" class="degenerate" />
        <text :x="geometry.cx" :y="geometry.cy - 13" text-anchor="middle" class="point-label" data-mohr-label>A = B（σx = σy，τxy = 0）</text>
        <text :x="geometry.cx" :y="geometry.cy + 22" text-anchor="middle" class="value-label" data-mohr-label>σ1 = σ2 = {{ mpa(result.sigma1Pa) }} MPa</text>
      </template>
      <text :x="geometry.cx" y="282" text-anchor="middle" class="relation-label" data-mohr-label>
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
.combined-label { fill: #34444c; font-size: 10px; font-weight: 800; }
.value-label { fill: #34444c; font-size: 10px; font-weight: 700; }
.relation-label { fill: #566a72; font-size: 10px; }

@media (max-width: 600px) {
  .mohr-card { overflow-x: auto; }
  figcaption { min-width: 420px; flex-direction: column; }
}
</style>
