<script setup lang="ts">
import type { LameCylinderAxialCondition } from '../../../core/plate-shell'

defineProps<{ boundary: LameCylinderAxialCondition | null }>()
</script>

<template>
  <figure class="diagram" data-testid="lame-cylinder-diagram">
    <figcaption>厚壁圆筒截面与压力正方向</figcaption>
    <svg viewBox="0 0 430 330" role="img" aria-label="厚壁圆筒内外半径、求值半径与压力方向示意图">
      <defs>
        <marker id="lm-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" class="arrow-head" />
        </marker>
        <pattern id="lm-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" class="hatch" />
        </pattern>
      </defs>
      <circle cx="215" cy="155" r="112" class="wall" />
      <circle cx="215" cy="155" r="54" class="bore" />
      <line x1="215" y1="155" x2="326" y2="155" class="radius outer" marker-end="url(#lm-arrow)" />
      <line x1="215" y1="155" x2="215" y2="102" class="radius inner" marker-end="url(#lm-arrow)" />
      <line x1="215" y1="155" x2="288" y2="97" class="radius evaluation" marker-end="url(#lm-arrow)" />
      <text x="275" y="148">rₒ</text>
      <text x="222" y="126">rᵢ</text>
      <text x="259" y="112">r</text>

      <line x1="165" y1="155" x2="187" y2="155" class="pressure pi" marker-end="url(#lm-arrow)" />
      <text x="135" y="149">pᵢ</text>
      <line x1="359" y1="155" x2="331" y2="155" class="pressure po" marker-end="url(#lm-arrow)" />
      <text x="365" y="149">pₒ</text>
      <circle cx="215" cy="155" r="4" class="center" />
      <text x="84" y="294">{{ boundary === 'open' ? '开口端' : boundary === 'closed' ? '封闭承压端' : boundary === 'plane-strain' ? '平面应变 εz=0' : '轴向状态待选择' }}</text>
    </svg>
    <p>压力箭头指向材料表面；`σr(ri)=-pi`、`σr(ro)=-po`。示意图非比例绘制。</p>
  </figure>
</template>

<style scoped>
.diagram { min-width: 0; margin: 0; padding: 18px; border: 1px solid var(--color-line); border-radius: var(--radius-large); background: #fbfdfd; box-shadow: var(--shadow-panel); }
.diagram figcaption { color: #30454e; font-size: 14px; font-weight: 800; }
.diagram svg { display: block; width: 100%; max-height: 390px; margin-top: 5px; }
.wall { fill: url(#lm-hatch); stroke: #17636b; stroke-width: 3; }
.bore { fill: #fff; stroke: #17636b; stroke-width: 3; }
.hatch { stroke: #9ac0c3; stroke-width: 3; }
.radius { stroke-width: 2; }
.outer { stroke: #17636b; }.inner { stroke: #b64835; }.evaluation { stroke: #8b6425; stroke-dasharray: 6 4; }
.pressure { stroke-width: 3; }.pi { stroke: #b64835; }.po { stroke: #79579b; }
.arrow-head, .center { fill: #17636b; }
text { fill: #425b65; font: 700 15px sans-serif; }
.diagram p { margin: 2px 0 0; color: var(--color-muted); font-size: 11px; line-height: 1.5; }
@media(max-width:560px){.diagram{padding:13px}.diagram svg{max-height:300px}}
</style>
