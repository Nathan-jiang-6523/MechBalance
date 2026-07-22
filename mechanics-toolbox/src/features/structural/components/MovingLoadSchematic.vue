<script setup lang="ts">
import { computed, useId } from 'vue'

import type {
  InfluenceLineResponse,
  MovingLoadRequest,
  MovingLoadResultData,
} from '../../../core/structural/contracts'
import {
  DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
  getStructuralQuantityId,
  getStructuralUnit,
  type StructuralQuantityKey,
} from '../../../core/structural/units'
import { convertFromSI, getUnitDefinition, type UnitPresetId } from '../../../core/units'

const props = withDefaults(defineProps<{
  request: MovingLoadRequest
  result?: MovingLoadResultData | undefined
  unitPresetId?: UnitPresetId
}>(), {
  unitPresetId: DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
})

const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const titleId = `moving-load-title-${uid}`
const descriptionId = `moving-load-description-${uid}`
const motionMarkerId = `moving-motion-${uid}`
const loadMarkerId = `moving-load-${uid}`
const SVG_LEFT = 70
const SVG_RIGHT = 890
const BEAM_Y = 174

const responseLabels: Readonly<Record<InfluenceLineResponse['type'], string>> = {
  'left-reaction': 'A 支座反力 Rₐ',
  'right-reaction': 'B 支座反力 Rᵦ',
  'section-shear': '截面剪力 V(a)',
  'section-moment': '截面弯矩 M(a)',
  displacement: '截面位移 v(a)',
}

function display(value: number, quantity: StructuralQuantityKey): string {
  if (!Number.isFinite(value)) return '无效'
  const quantityId = getStructuralQuantityId(quantity)
  const unitId = getStructuralUnit(quantity, props.unitPresetId)
  const converted = convertFromSI(value, quantityId, unitId)
  return `${Number(converted.toPrecision(6))} ${getUnitDefinition(quantityId, unitId).symbol}`
}

const offsets = computed(() => {
  const values = [0]
  for (const spacing of props.request.movingLoad.adjacentSpacings) {
    values.push(values[values.length - 1]! + spacing)
  }
  return values
})

const resultPositions = computed(() => new Map(
  (props.result?.axlePositions ?? []).map(({ axleId, position }) => [axleId, position.value]),
))

const axlePositions = computed(() => {
  const span = props.request.beam.span
  const groupLength = offsets.value[offsets.value.length - 1] ?? 0
  const direction = props.request.movingLoad.direction
  const nominalFront = direction === 'left-to-right'
    ? span / 2 + groupLength / 2
    : span / 2 - groupLength / 2
  return props.request.movingLoad.axles.map((axle, index) => {
    const offset = offsets.value[index] ?? 0
    const nominal = direction === 'left-to-right' ? nominalFront - offset : nominalFront + offset
    const position = resultPositions.value.get(axle.id) ?? nominal
    return {
      ...axle,
      position,
      effectiveLoad: axle.load * props.request.movingLoad.dynamicFactor,
      onBridge: position >= 0 && position <= span,
    }
  })
})

const worldBounds = computed(() => {
  const values = [0, props.request.beam.span, ...axlePositions.value.map(({ position }) => position)]
    .filter(Number.isFinite)
  if (values.length === 0) return { min: -1, max: 1 }
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = Math.max(maxValue - minValue, 1)
  const margin = Math.max(range * 0.08, 0.25)
  return { min: minValue - margin, max: maxValue + margin }
})

function screenX(position: number): number {
  const { min, max } = worldBounds.value
  if (!Number.isFinite(position) || max <= min) return (SVG_LEFT + SVG_RIGHT) / 2
  return SVG_LEFT + (position - min) / (max - min) * (SVG_RIGHT - SVG_LEFT)
}

const bridgeStartX = computed(() => screenX(0))
const bridgeEndX = computed(() => screenX(props.request.beam.span))
const responsePosition = computed(() => {
  const response = props.request.response
  if ('position' in response) return response.position
  return response.type === 'right-reaction' ? props.request.beam.span : 0
})
const responseX = computed(() => screenX(responsePosition.value))
const responseLabel = computed(() => responseLabels[props.request.response.type])
const hasSectionTarget = computed(() => 'position' in props.request.response)
const directionLabel = computed(() => props.request.movingLoad.direction === 'left-to-right'
  ? '从左向右（A → B）'
  : '从右向左（B → A）')
const maximumControl = computed(() => props.result?.controls.find(({ kind }) => kind === 'maximum'))
const minimumControl = computed(() => props.result?.controls.find(({ kind }) => kind === 'minimum'))
const accessibleDescription = computed(() => [
  `跨度 ${display(props.request.beam.span, 'length')} 的简支梁。`,
  `${props.request.movingLoad.axles.length} 个车轴${directionLabel.value}移动。`,
  `目标响应为${responseLabel.value}。`,
  props.result ? '图中显示绝对控制工况的车轴位置。' : '图中轴组居中，仅表达轴载、轴距和行进方向。',
].join(''))
</script>

<template>
  <figure
    class="moving-load-schematic"
    data-testid="moving-load-schematic"
    :data-direction="request.movingLoad.direction"
    :data-mode="result ? 'governing-control' : 'configuration'"
  >
    <header>
      <div>
        <span>{{ result ? '控制工况图' : '轴组配置图' }}</span>
        <h3 :id="titleId">移动轴组、桥跨与目标响应</h3>
      </div>
      <strong>{{ responseLabel }}</strong>
    </header>

    <div class="schematic-scroll">
      <svg viewBox="0 0 960 300" role="img" :aria-labelledby="`${titleId} ${descriptionId}`">
        <title>移动荷载轴组与简支梁示意</title>
        <desc :id="descriptionId">{{ accessibleDescription }}</desc>
        <defs>
          <marker :id="motionMarkerId" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
          <marker :id="loadMarkerId" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>

        <text x="480" y="22" text-anchor="middle" class="motion-label">行进方向：{{ directionLabel }}</text>
        <line
          class="motion-line"
          :x1="request.movingLoad.direction === 'left-to-right' ? 250 : 710"
          y1="38"
          :x2="request.movingLoad.direction === 'left-to-right' ? 710 : 250"
          y2="38"
          :marker-end="`url(#${motionMarkerId})`"
        />

        <line class="approach" x1="45" :x2="bridgeStartX" :y1="BEAM_Y" :y2="BEAM_Y" />
        <line class="approach" :x1="bridgeEndX" x2="915" :y1="BEAM_Y" :y2="BEAM_Y" />
        <line class="beam" :x1="bridgeStartX" :x2="bridgeEndX" :y1="BEAM_Y" :y2="BEAM_Y" />

        <g class="support support-a" :transform="`translate(${bridgeStartX} ${BEAM_Y})`" data-support="pin">
          <path d="M0,0 L-15,25 L15,25 Z" />
          <line x1="-23" y1="31" x2="23" y2="31" />
          <text x="0" y="53" text-anchor="middle">A · 铰支</text>
        </g>
        <g class="support support-b" :transform="`translate(${bridgeEndX} ${BEAM_Y})`" data-support="roller">
          <path d="M0,0 L-15,22 L15,22 Z" />
          <circle cx="-8" cy="28" r="4" />
          <circle cx="8" cy="28" r="4" />
          <line x1="-23" y1="35" x2="23" y2="35" />
          <text x="0" y="57" text-anchor="middle">B · 滚支</text>
        </g>

        <g
          v-for="axle in axlePositions"
          :key="axle.id"
          class="moving-axle"
          :class="{ outside: !axle.onBridge }"
          :data-axle-id="axle.id"
          :data-position="axle.position"
          :data-on-bridge="axle.onBridge"
          :transform="`translate(${screenX(axle.position)} 0)`"
        >
          <text x="0" y="62" text-anchor="middle">{{ axle.id }}</text>
          <text x="0" y="78" text-anchor="middle">φP={{ display(axle.effectiveLoad, 'force') }}</text>
          <line x1="0" y1="85" x2="0" :y2="BEAM_Y - 3" :marker-end="`url(#${loadMarkerId})`" />
        </g>

        <g
          v-for="(spacing, index) in request.movingLoad.adjacentSpacings"
          :key="`spacing-${index}`"
          class="spacing"
          :data-spacing-index="index"
        >
          <line :x1="screenX(axlePositions[index]!.position)" y1="110" :x2="screenX(axlePositions[index + 1]!.position)" y2="110" />
          <line :x1="screenX(axlePositions[index]!.position)" y1="104" :x2="screenX(axlePositions[index]!.position)" y2="116" />
          <line :x1="screenX(axlePositions[index + 1]!.position)" y1="104" :x2="screenX(axlePositions[index + 1]!.position)" y2="116" />
          <text :x="(screenX(axlePositions[index]!.position) + screenX(axlePositions[index + 1]!.position)) / 2" y="105" text-anchor="middle">s{{ index + 1 }}={{ display(spacing, 'length') }}</text>
        </g>

        <g class="response-target" :data-response-type="request.response.type" :transform="`translate(${responseX} 0)`">
          <line v-if="hasSectionTarget" class="target-cut" x1="0" y1="125" x2="0" y2="225" />
          <circle v-else class="target-ring" cx="0" :cy="BEAM_Y" r="27" />
          <text x="0" y="244" text-anchor="middle">目标：{{ responseLabel }}</text>
        </g>

        <line class="dimension" :x1="bridgeStartX" y1="270" :x2="bridgeEndX" y2="270" />
        <line class="dimension" :x1="bridgeStartX" y1="263" :x2="bridgeStartX" y2="277" />
        <line class="dimension" :x1="bridgeEndX" y1="263" :x2="bridgeEndX" y2="277" />
        <text x="480" y="292" text-anchor="middle" class="dimension-label">L={{ display(request.beam.span, 'length') }}</text>
      </svg>
    </div>

    <div class="schematic-facts">
      <div><span>轴组</span><strong>{{ request.movingLoad.axles.length }} 轴 · {{ directionLabel }}</strong></div>
      <div><span>动力系数</span><strong>φ={{ request.movingLoad.dynamicFactor }}</strong></div>
      <div><span>搜索方法</span><strong>事件点 + 驻点</strong></div>
      <div v-if="maximumControl"><span>最大值控制</span><strong>{{ maximumControl.controllingAxleId ?? '边界' }} · 前轴 {{ display(maximumControl.position.value, 'length') }}</strong></div>
      <div v-if="minimumControl"><span>最小值控制</span><strong>{{ minimumControl.controllingAxleId ?? '边界' }} · 前轴 {{ display(minimumControl.position.value, 'length') }}</strong></div>
    </div>
    <figcaption>
      {{ result ? '车轴位置来自绝对值较大的已验证控制工况；桥外车轴以灰色显示。' : '计算前轴组居中，仅表示载荷、轴距与方向，不代表控制位置。' }}
      本模块只给出事件点与驻点求得的极值，不伪造完整包络曲线。
    </figcaption>
  </figure>
</template>

<style scoped>
.moving-load-schematic { min-width: 0; margin: 0; padding: 14px; border: 1px solid #c7d6da; border-radius: 10px; background: #f8fbfc; }
header { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
header span, .schematic-facts span { color: #5d7078; font-size: 12px; font-weight: 800; letter-spacing: .03em; }
h3 { margin: 3px 0 0; color: #263b44; font-size: 15px; }
header > strong { padding: 7px 10px; border-radius: 999px; color: #8d2623; background: #fdebea; font-size: 12px; text-align: center; }
.schematic-scroll { width: 100%; min-width: 0; margin-top: 8px; overflow: hidden; }
svg { display: block; width: 100%; height: auto; }
svg text { fill: #405860; font-family: inherit; font-size: 12px; font-weight: 750; paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
marker path { fill: #2c7180; }
.motion-label { font-weight: 850; }
.motion-line { stroke: #2c7180; stroke-width: 2; stroke-dasharray: 7 5; }
.approach { stroke: #91a3aa; stroke-width: 3; stroke-dasharray: 7 5; }
.beam { stroke: #243d47; stroke-width: 7; stroke-linecap: round; }
.support path { fill: #e7eef0; stroke: #405860; stroke-width: 2; }
.support circle { fill: #fff; stroke: #405860; stroke-width: 2; }
.support line { stroke: #405860; stroke-width: 2; }
.moving-axle line { stroke: #b64835; stroke-width: 2.5; }
.moving-axle text { fill: #9f352c; }
.moving-axle.outside { opacity: .45; }
.spacing line, .dimension { stroke: #758a92; stroke-width: 1.4; }
.spacing text, .dimension-label { fill: #526870; }
.target-cut { stroke: #c43e38; stroke-width: 3; stroke-dasharray: 6 4; }
.target-ring { fill: none; stroke: #c43e38; stroke-width: 3; }
.response-target text { fill: #a42f2b; font-weight: 850; }
.schematic-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 8px; margin-top: 8px; }
.schematic-facts div { display: grid; gap: 3px; padding: 9px 10px; border-radius: 7px; background: #edf3f5; }
.schematic-facts strong { color: #314a54; font-size: 12px; }
figcaption { margin-top: 10px; color: #526870; font-size: 12px; line-height: 1.65; }
@media (max-width: 620px) {
  header { flex-direction: column; }
  header > strong { align-self: flex-start; }
  .schematic-scroll { overflow-x: auto; }
  svg { min-width: 620px; }
}
</style>
