<script setup lang="ts">
import type { ThinCylinderEndCondition } from '../../../core/plate-shell'

defineProps<{
  boundary: ThinCylinderEndCondition | null
}>()
</script>

<template>
  <figure class="diagram" data-testid="thin-cylinder-diagram">
    <figcaption>中面半径与正方向</figcaption>
    <svg viewBox="0 0 520 290" role="img" aria-label="薄壁圆筒内外压、轴向及环向正方向示意图">
      <defs>
        <marker id="tw-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" class="arrow-head" />
        </marker>
        <pattern id="tw-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" class="hatch-line" />
        </pattern>
      </defs>

      <path d="M110 72 C70 72 70 218 110 218 L405 218 C445 218 445 72 405 72 Z" class="shell" />
      <path d="M110 90 C87 90 87 200 110 200 L405 200 C428 200 428 90 405 90 Z" class="inside" />
      <ellipse cx="110" cy="145" rx="30" ry="73" class="end-ring" />
      <ellipse v-if="boundary === 'closed'" cx="405" cy="145" rx="30" ry="73" class="closed-end" />
      <ellipse v-else cx="405" cy="145" rx="30" ry="55" class="open-end" />
      <line x1="65" y1="145" x2="470" y2="145" class="axis" marker-end="url(#tw-arrow)" />
      <text x="476" y="150">+z</text>

      <line x1="260" y1="145" x2="260" y2="78" class="dimension" marker-end="url(#tw-arrow)" />
      <text x="268" y="112">rₘ</text>
      <line x1="315" y1="89" x2="315" y2="72" class="dimension" marker-end="url(#tw-arrow)" />
      <text x="323" y="84">t</text>

      <line x1="160" y1="132" x2="160" y2="92" class="pressure internal" marker-end="url(#tw-arrow)" />
      <text x="148" y="126">pᵢ</text>
      <line x1="205" y1="42" x2="205" y2="70" class="pressure external" marker-end="url(#tw-arrow)" />
      <text x="194" y="35">pₒ</text>

      <path d="M272 205 C315 246 372 230 384 191" class="hoop-arrow" marker-end="url(#tw-arrow)" />
      <text x="328" y="254">+θ</text>
      <text x="88" y="274">{{ boundary === 'closed' ? '封闭承压端盖' : boundary === 'open' ? '开口端，无端盖传力' : '端部状态待选择' }}</text>
    </svg>
    <p>示意图非比例绘制；结果位置：远离端部与载荷引入区的中面。</p>
  </figure>
</template>

<style scoped>
.diagram { min-width: 0; margin: 0; padding: 18px; border: 1px solid var(--color-line); border-radius: var(--radius-large); background: #fbfdfd; box-shadow: var(--shadow-panel); }
.diagram figcaption { color: #30454e; font-size: 14px; font-weight: 800; }
.diagram svg { display: block; width: 100%; min-height: 240px; margin-top: 8px; }
.shell { fill: #dceff0; stroke: #17636b; stroke-width: 3; }
.inside { fill: #fff; stroke: #57949a; stroke-width: 2; }
.end-ring, .open-end { fill: #fff; stroke: #17636b; stroke-width: 3; }
.closed-end { fill: url(#tw-hatch); stroke: #17636b; stroke-width: 3; }
.hatch-line { stroke: #8bb4b8; stroke-width: 2; }
.axis { stroke: #697c84; stroke-width: 1.5; stroke-dasharray: 7 5; }
.dimension { stroke: #17636b; stroke-width: 1.8; }
.pressure { stroke-width: 2.5; }
.internal { stroke: #b64835; }
.external { stroke: #79579b; }
.hoop-arrow { fill: none; stroke: #c17824; stroke-width: 2.5; }
.arrow-head { fill: #17636b; }
text { fill: #425b65; font: 700 14px sans-serif; }
.diagram p { margin: 5px 0 0; color: var(--color-muted); font-size: 11px; line-height: 1.5; }
@media (max-width: 560px) { .diagram { padding: 13px; } .diagram svg { min-height: 190px; } }
</style>
