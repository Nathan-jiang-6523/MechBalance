<script setup lang="ts">
import { computed, useId } from 'vue'

import type { InfluenceLineRequest, InfluenceLineResponse } from '../../../core/structural/contracts'
import {
  DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
  getStructuralQuantityId,
  getStructuralUnit,
} from '../../../core/structural/units'
import { convertFromSI, getUnitDefinition, type UnitPresetId } from '../../../core/units'

const props = withDefaults(defineProps<{
  request: InfluenceLineRequest
  unitPresetId?: UnitPresetId
}>(), {
  unitPresetId: DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
})

const titleId = useId()
const descriptionId = useId()
const beamStart = 70
const beamEnd = 650
const beamLength = beamEnd - beamStart

const responseLabels: Readonly<Record<InfluenceLineResponse['type'], string>> = {
  'left-reaction': 'A 支座竖向反力 Rₐ',
  'right-reaction': 'B 支座竖向反力 Rᵦ',
  'section-shear': '目标截面剪力 V(a)',
  'section-moment': '目标截面弯矩 M(a)',
  displacement: '目标截面竖向位移 v(a)',
}

const response = computed(() => props.request.response)
const hasSectionPosition = computed(() => 'position' in response.value)
const targetPosition = computed(() => {
  if ('position' in response.value) return response.value.position
  return response.value.type === 'right-reaction' ? props.request.beam.span : 0
})
const geometryValid = computed(() => Number.isFinite(props.request.beam.span)
  && props.request.beam.span > 0
  && Number.isFinite(targetPosition.value))
const targetRatio = computed(() => {
  if (!geometryValid.value) return 0.5
  return Math.min(1, Math.max(0, targetPosition.value / props.request.beam.span))
})
const targetX = computed(() => beamStart + targetRatio.value * beamLength)
const responseLabel = computed(() => responseLabels[response.value.type])
const targetKind = computed(() => hasSectionPosition.value ? 'section' : 'support')

function displayLength(value: number): string {
  if (!Number.isFinite(value)) return '无效'
  const quantityId = getStructuralQuantityId('length')
  const unitId = getStructuralUnit('length', props.unitPresetId)
  const converted = convertFromSI(value, quantityId, unitId)
  return `${Number(converted.toPrecision(6))} ${getUnitDefinition(quantityId, unitId).symbol}`
}

const spanLabel = computed(() => displayLength(props.request.beam.span))
const targetPositionLabel = computed(() => displayLength(targetPosition.value))
const remainingLengthLabel = computed(() => displayLength(props.request.beam.span - targetPosition.value))
const accessibleDescription = computed(() => hasSectionPosition.value
  ? `简支梁跨度 ${spanLabel.value}。单位荷载从 A 向 B 沿全跨移动，固定读取 ${targetPositionLabel.value} 处的${responseLabel.value}。`
  : `简支梁跨度 ${spanLabel.value}。单位荷载从 A 向 B 沿全跨移动，读取${responseLabel.value}。`)
</script>

<template>
  <figure
    class="influence-schematic"
    data-testid="influence-line-schematic"
    :data-response-type="response.type"
    :data-target-kind="targetKind"
  >
    <header>
      <div>
        <span>本次计算位置</span>
        <h3 :id="titleId">单位荷载移动，红色位置固定读取响应</h3>
      </div>
      <strong>{{ responseLabel }}</strong>
    </header>

    <div class="schematic-scroll">
      <svg
        viewBox="0 0 720 250"
        role="img"
        :aria-labelledby="`${titleId} ${descriptionId}`"
      >
        <title>{{ responseLabel }}影响线计算示意</title>
        <desc :id="descriptionId">{{ accessibleDescription }}</desc>
        <defs>
          <marker id="influence-motion-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
          <marker id="influence-load-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>

        <text class="motion-label" x="360" y="25" text-anchor="middle">单位荷载 P=1 沿 z 从 A 移动到 B</text>
        <line class="motion-path" x1="92" y1="43" x2="628" y2="43" />
        <g class="unit-load" transform="translate(180 0)">
          <text x="0" y="64" text-anchor="middle">P=1（位置 z 可变）</text>
          <line x1="0" y1="70" x2="0" y2="112" />
        </g>

        <line class="beam" :x1="beamStart" y1="124" :x2="beamEnd" y2="124" />

        <g class="support support-a" :transform="`translate(${beamStart} 124)`" data-support="pin">
          <path d="M0,0 L-15,25 L15,25 Z" />
          <line x1="-23" y1="31" x2="23" y2="31" />
          <text x="0" y="52" text-anchor="middle">A · 铰支</text>
        </g>
        <g class="support support-b" :transform="`translate(${beamEnd} 124)`" data-support="roller">
          <path d="M0,0 L-15,22 L15,22 Z" />
          <circle cx="-8" cy="28" r="4" />
          <circle cx="8" cy="28" r="4" />
          <line x1="-23" y1="35" x2="23" y2="35" />
          <text x="0" y="56" text-anchor="middle">B · 滚支</text>
        </g>

        <g
          class="target-marker"
          :class="targetKind"
          :transform="`translate(${targetX} 0)`"
          :data-position="targetPosition"
          :data-ratio="targetRatio"
        >
          <line v-if="hasSectionPosition" class="target-cut" x1="0" y1="75" x2="0" y2="166" />
          <circle v-else class="target-support-ring" cx="0" cy="124" r="25" />
          <path class="target-pointer" d="M-7,75 L0,86 L7,75 Z" />
          <text class="target-label" x="0" y="68" text-anchor="middle">
            {{ hasSectionPosition ? '固定目标截面 a' : '固定目标支座' }}
          </text>
          <template v-if="response.type === 'section-shear'">
            <text class="side-label" x="-10" y="108" text-anchor="end">a⁻ · left</text>
            <text class="side-label" x="10" y="108">a⁺ · right</text>
          </template>
        </g>

        <line class="dimension" :x1="beamStart" y1="211" :x2="beamEnd" y2="211" />
        <line class="dimension-tick" :x1="beamStart" y1="202" :x2="beamStart" y2="220" />
        <line class="dimension-tick" :x1="beamEnd" y1="202" :x2="beamEnd" y2="220" />
        <text class="dimension-label" x="360" y="237" text-anchor="middle">总跨度 L = {{ spanLabel }}</text>
      </svg>
    </div>

    <div class="mobile-overview" role="img" :aria-label="accessibleDescription">
      <div class="mobile-motion">P=1 沿全跨移动：A&nbsp; → &nbsp;B</div>
      <div class="mobile-beam-row">
        <div class="mobile-support"><span>△</span><strong>A</strong></div>
        <div class="mobile-beam-track">
          <div
            class="mobile-target-marker"
            :class="targetKind"
            :style="{ left: `${targetRatio * 100}%` }"
          >
            <span>{{ hasSectionPosition ? '目标 a' : '目标' }}</span>
          </div>
        </div>
        <div class="mobile-support"><span>○</span><strong>B</strong></div>
      </div>
      <strong class="mobile-response">固定读取：{{ responseLabel }}{{ hasSectionPosition ? `，a = ${targetPositionLabel}` : '' }}</strong>
    </div>

    <div class="schematic-facts" aria-label="影响线计算位置说明">
      <div><span>移动变量</span><strong>单位荷载位置 z：0 → L</strong></div>
      <div v-if="hasSectionPosition"><span>固定目标</span><strong>a = {{ targetPositionLabel }}</strong></div>
      <div v-if="hasSectionPosition"><span>右侧长度</span><strong>L-a = {{ remainingLengthLabel }}</strong></div>
      <div><span>本次输出</span><strong>{{ responseLabel }}影响线</strong></div>
    </div>
    <figcaption>
      横轴是单位荷载位置 z，不是截面位置。红线 a 固定；荷载移到各个 z 时，读取红线处响应并连成影响线。
    </figcaption>
  </figure>
</template>

<style scoped>
.influence-schematic { min-width: 0; margin: 0; padding: 14px; border: 1px solid #c7d6da; border-radius: 10px; background: #f8fbfc; }
header { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
header span, .schematic-facts span { color: #5d7078; font-size: 12px; font-weight: 800; letter-spacing: .03em; }
h3 { margin: 3px 0 0; color: #263b44; font-size: 15px; }
header > strong { padding: 7px 10px; border-radius: 999px; color: #8d2623; background: #fdebea; font-size: 12px; text-align: center; }
.schematic-scroll { min-width: 0; margin-top: 8px; overflow-x: auto; }
svg { display: block; width: 100%; min-width: 620px; height: auto; }
svg text { font-family: inherit; font-size: 12px; }
marker path { fill: #2c7180; }
.motion-label { fill: #405860; font-weight: 800; }
.motion-path { stroke: #2c7180; stroke-width: 2; stroke-dasharray: 7 5; marker-end: url(#influence-motion-arrow); }
.unit-load text { fill: #405860; font-weight: 750; }
.unit-load line { stroke: #2c7180; stroke-width: 2.5; marker-end: url(#influence-load-arrow); }
.beam { stroke: #243d47; stroke-width: 7; stroke-linecap: round; }
.support path { fill: #e7eef0; stroke: #405860; stroke-width: 2; }
.support circle { fill: #fff; stroke: #405860; stroke-width: 2; }
.support line { stroke: #405860; stroke-width: 2; }
.support text { fill: #405860; font-weight: 800; }
.target-cut { stroke: #c43e38; stroke-width: 3; stroke-dasharray: 6 4; }
.target-pointer { fill: #c43e38; }
.target-support-ring { fill: none; stroke: #c43e38; stroke-width: 3; }
.target-label { fill: #a42f2b; font-weight: 850; }
.side-label { fill: #a42f2b; font-weight: 750; }
.dimension, .dimension-tick { stroke: #7b8f97; stroke-width: 1.5; }
.dimension-label { fill: #526870; font-weight: 750; }
.schematic-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.schematic-facts div { display: grid; gap: 3px; padding: 9px 10px; border-radius: 7px; background: #edf3f5; }
.schematic-facts strong { color: #314a54; font-size: 12px; }
figcaption { margin-top: 10px; color: #526870; font-size: 12px; line-height: 1.65; }
.mobile-overview { display: none; }
@media (max-width: 620px) {
  header { flex-direction: column; }
  header > strong { align-self: flex-start; }
  .schematic-scroll { display: none; }
  .mobile-overview { display: grid; gap: 10px; margin: 14px 0; padding: 12px 10px; border: 1px solid #c7d6da; border-radius: 8px; background: #fff; }
  .mobile-motion { color: #2c7180; font-size: 12px; font-weight: 850; text-align: center; }
  .mobile-beam-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) 30px; gap: 5px; align-items: center; }
  .mobile-support { display: grid; color: #405860; font-size: 12px; text-align: center; }
  .mobile-support span { font-size: 20px; line-height: 1; }
  .mobile-beam-track { position: relative; height: 66px; border-top: 5px solid #243d47; }
  .mobile-target-marker { position: absolute; top: -10px; bottom: 5px; width: 0; border-left: 3px dashed #c43e38; }
  .mobile-target-marker span { position: absolute; top: 13px; left: 0; width: max-content; transform: translateX(-50%); color: #a42f2b; font-size: 12px; font-weight: 850; }
  .mobile-response { color: #8d2623; font-size: 12px; text-align: center; }
}
</style>
