<script setup lang="ts">
import { computed, useId } from 'vue'

import type {
  FrameUniformLoad,
  StructuralElement2D,
  StructuralLoad,
  StructuralModel2D,
  StructuralNode2D,
} from '../../../core/structural/contracts'
import {
  DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
  getStructuralQuantityId,
  getStructuralUnit,
  type StructuralQuantityKey,
} from '../../../core/structural/units'
import { convertFromSI, getUnitDefinition, type UnitPresetId } from '../../../core/units'

export interface StructureDiagramNodeDisplacement {
  readonly nodeId: string
  readonly u: number
  readonly v: number
}

export interface StructureDiagramDeformation {
  /** Display-only multiplier supplied by caller; never interpreted as true scale. */
  readonly scale: number
  readonly nodeDisplacements: readonly StructureDiagramNodeDisplacement[]
}

export interface StructureDiagramLayers {
  readonly nodeLabels: boolean
  readonly elementLabels: boolean
  readonly localAxes: boolean
  readonly supports: boolean
  readonly loads: boolean
  readonly results: boolean
}

const DEFAULT_LAYERS: StructureDiagramLayers = {
  nodeLabels: true,
  elementLabels: true,
  localAxes: true,
  supports: true,
  loads: true,
  results: true,
}

const props = withDefaults(defineProps<{
  model: StructuralModel2D
  deformation?: StructureDiagramDeformation
  unitPresetId?: UnitPresetId
  layers?: Partial<StructureDiagramLayers>
}>(), {
  unitPresetId: DEFAULT_STRUCTURAL_UNIT_PRESET_ID,
})

const SVG_WIDTH = 960
const PLOT = { left: 72, right: 690, top: 58, bottom: 430 } as const
const LEGEND_X = 728
const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const titleId = `structure-diagram-title-${uid}`
const axisMarkerId = `structure-axis-${uid}`
const loadMarkerId = `structure-load-${uid}`
const localMarkerId = `structure-local-${uid}`
const visibleLayers = computed<StructureDiagramLayers>(() => ({ ...DEFAULT_LAYERS, ...props.layers }))

interface WorldNode extends StructuralNode2D {
  readonly deformedX?: number
  readonly deformedY?: number
}

interface ScreenPoint {
  readonly x: number
  readonly y: number
}

const deformationByNode = computed(() => new Map(
  (props.deformation?.nodeDisplacements ?? []).map((value) => [value.nodeId, value]),
))

const worldNodes = computed<readonly WorldNode[]>(() => props.model.nodes.map((node) => {
  const displacement = deformationByNode.value.get(node.id)
  if (!props.deformation || !displacement) return node
  return {
    ...node,
    deformedX: node.x + displacement.u * props.deformation.scale,
    deformedY: node.y + displacement.v * props.deformation.scale,
  }
}))

const bounds = computed(() => {
  const points = worldNodes.value.flatMap((node) => [
    { x: node.x, y: node.y },
    ...(node.deformedX === undefined || node.deformedY === undefined
      ? []
      : [{ x: node.deformedX, y: node.deformedY }]),
  ])
  if (points.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, scale: 1 }
  const minX = Math.min(...points.map(({ x }) => x))
  const maxX = Math.max(...points.map(({ x }) => x))
  const minY = Math.min(...points.map(({ y }) => y))
  const maxY = Math.max(...points.map(({ y }) => y))
  const width = maxX - minX
  const height = maxY - minY
  const scales = [
    ...(width > 0 ? [(PLOT.right - PLOT.left) / width] : []),
    ...(height > 0 ? [(PLOT.bottom - PLOT.top) / height] : []),
  ]
  return { minX, maxX, minY, maxY, scale: scales.length === 0 ? 1 : Math.min(...scales) }
})

function screenPoint(x: number, y: number): ScreenPoint {
  const { minX, maxX, minY, maxY, scale } = bounds.value
  const contentWidth = (maxX - minX) * scale
  const contentHeight = (maxY - minY) * scale
  return {
    x: (PLOT.left + PLOT.right - contentWidth) / 2 + (x - minX) * scale,
    y: (PLOT.top + PLOT.bottom + contentHeight) / 2 - (y - minY) * scale,
  }
}

const nodeViews = computed(() => worldNodes.value.map((node, index) => {
  const isSupported = props.model.constraints.some(({ nodeId }) => nodeId === node.id)
  return {
    ...node,
    ...screenPoint(node.x, node.y),
    labelDx: isSupported ? 12 : [10, 10, -10, -10][index % 4]!,
    labelDy: isSupported ? -12 : [-10, 16, -10, 16][index % 4]!,
    ...(node.deformedX === undefined || node.deformedY === undefined
      ? {}
      : { deformed: screenPoint(node.deformedX, node.deformedY) }),
  }
}))

const nodeViewById = computed(() => new Map(nodeViews.value.map((node) => [node.id, node])))

interface ElementView {
  readonly id: string
  readonly type: StructuralElement2D['type']
  readonly nodeI: string
  readonly nodeJ: string
  readonly i: ScreenPoint
  readonly j: ScreenPoint
  readonly midpoint: ScreenPoint
  readonly c: number
  readonly s: number
  readonly localXEnd: ScreenPoint
  readonly localYEnd: ScreenPoint
  readonly deformedI?: ScreenPoint
  readonly deformedJ?: ScreenPoint
  readonly length: number
}

function elementView(element: StructuralElement2D): ElementView | null {
  const nodeI = props.model.nodes.find(({ id }) => id === element.nodeI)
  const nodeJ = props.model.nodes.find(({ id }) => id === element.nodeJ)
  const viewI = nodeViewById.value.get(element.nodeI)
  const viewJ = nodeViewById.value.get(element.nodeJ)
  if (!nodeI || !nodeJ || !viewI || !viewJ) return null
  const dx = nodeJ.x - nodeI.x
  const dy = nodeJ.y - nodeI.y
  const length = Math.hypot(dx, dy)
  const c = length === 0 ? 1 : dx / length
  const s = length === 0 ? 0 : dy / length
  const midpoint = { x: (viewI.x + viewJ.x) / 2, y: (viewI.y + viewJ.y) / 2 }
  return {
    id: element.id,
    type: element.type,
    nodeI: element.nodeI,
    nodeJ: element.nodeJ,
    i: viewI,
    j: viewJ,
    midpoint,
    c,
    s,
    length,
    localXEnd: { x: midpoint.x + 34 * c, y: midpoint.y - 34 * s },
    localYEnd: { x: midpoint.x - 28 * s, y: midpoint.y - 28 * c },
    ...(viewI.deformed && viewJ.deformed
      ? { deformedI: viewI.deformed, deformedJ: viewJ.deformed }
      : {}),
  }
}

const elementViews = computed(() => props.model.elements
  .map(elementView)
  .filter((value): value is ElementView => value !== null))
const elementViewById = computed(() => new Map(elementViews.value.map((element) => [element.id, element])))

type SupportType = 'fixed' | 'pin' | 'roller-x' | 'roller-y' | 'rotation'
type FixedSupportOrientation = 'left' | 'right' | 'top' | 'bottom'

function fixedSupportOrientation(node: StructuralNode2D): FixedSupportOrientation {
  const inward = props.model.elements.reduce((sum, element) => {
    if (element.nodeI !== node.id && element.nodeJ !== node.id) return sum
    const otherId = element.nodeI === node.id ? element.nodeJ : element.nodeI
    const other = props.model.nodes.find(({ id }) => id === otherId)
    if (!other) return sum
    const dx = other.x - node.x
    const dy = other.y - node.y
    const length = Math.hypot(dx, dy)
    if (length === 0) return sum
    return { x: sum.x + dx / length, y: sum.y + dy / length }
  }, { x: 0, y: 0 })
  if (Math.abs(inward.x) >= Math.abs(inward.y) && Math.abs(inward.x) > 1e-12) {
    return inward.x > 0 ? 'left' : 'right'
  }
  if (Math.abs(inward.y) > 1e-12) return inward.y > 0 ? 'bottom' : 'top'
  return 'left'
}

function fixedSupportTransform(orientation: FixedSupportOrientation, x: number, y: number): string | undefined {
  const angle = { left: 0, right: 180, top: 90, bottom: -90 }[orientation]
  return angle === 0 ? undefined : `rotate(${angle} ${x} ${y})`
}

const supports = computed(() => props.model.nodes.flatMap((node) => {
  const dofs = new Set(props.model.constraints.filter(({ nodeId }) => nodeId === node.id).map(({ dof }) => dof))
  const view = nodeViewById.value.get(node.id)
  if (!view || dofs.size === 0) return []
  let type: SupportType
  if (dofs.has('u') && dofs.has('v') && dofs.has('theta')) type = 'fixed'
  else if (dofs.has('u') && dofs.has('v')) type = 'pin'
  else if (dofs.has('v')) type = 'roller-y'
  else if (dofs.has('u')) type = 'roller-x'
  else type = 'rotation'
  return [{
    nodeId: node.id,
    type,
    x: view.x,
    y: view.y,
    orientation: type === 'fixed' ? fixedSupportOrientation(node) : undefined,
  }]
}))

interface ArrowView {
  readonly key: string
  readonly loadId: string
  readonly kind: string
  readonly direction: string
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

function arrowInto(point: ScreenPoint, dx: number, dy: number, key: string, loadId: string, kind: string, direction: string): ArrowView {
  return { key, loadId, kind, direction, x1: point.x - dx * 38, y1: point.y - dy * 38, x2: point.x, y2: point.y }
}

const nodalArrows = computed<readonly ArrowView[]>(() => props.model.loads.flatMap((load) => {
  if (load.type !== 'nodal') return []
  const node = nodeViewById.value.get(load.nodeId)
  if (!node) return []
  const arrows: ArrowView[] = []
  if (load.fx) arrows.push(arrowInto(node, Math.sign(load.fx), 0, `${load.id}-fx`, load.id, 'Fx', load.fx > 0 ? 'global+x' : 'global-x'))
  if (load.fy) arrows.push(arrowInto(node, 0, -Math.sign(load.fy), `${load.id}-fy`, load.id, 'Fy', load.fy > 0 ? 'global+y' : 'global-y'))
  return arrows
}))

const nodalMoments = computed(() => props.model.loads.flatMap((load) => {
  if (load.type !== 'nodal' || !('mz' in load) || !load.mz) return []
  const node = nodeViewById.value.get(load.nodeId)
  return node ? [{ id: load.id, x: node.x, y: node.y, positive: load.mz > 0 }] : []
}))

function distributedArrows(load: FrameUniformLoad | Extract<StructuralLoad, { type: 'beam-uniform' }>): ArrowView[] {
  const element = elementViewById.value.get(load.elementId)
  if (!element || element.length <= 0) return []
  const interval = 'interval' in load && load.interval ? load.interval : { a: 0, b: element.length }
  const ratios = Array.from({ length: 5 }, (_, index) => interval.a / element.length
    + (interval.b - interval.a) / element.length * index / 4)
  const components = load.type === 'beam-uniform'
    ? [{ value: load.qY, kind: 'qY', dx: -element.s, dy: -element.c }]
    : [
        { value: load.qX ?? 0, kind: 'qX', dx: element.c, dy: -element.s },
        { value: load.qY ?? 0, kind: 'qY', dx: -element.s, dy: -element.c },
      ]
  return components.flatMap(({ value, kind, dx, dy }) => value === 0 ? [] : ratios.map((ratio, index) => {
    const point = {
      x: element.i.x + (element.j.x - element.i.x) * ratio,
      y: element.i.y + (element.j.y - element.i.y) * ratio,
    }
    const sign = Math.sign(value)
    return arrowInto(point, dx * sign, dy * sign, `${load.id}-${kind}-${index}`, load.id, kind, `${kind}${sign > 0 ? '+' : '-'}`)
  }))
}

const memberArrows = computed<readonly ArrowView[]>(() => props.model.loads.flatMap((load) => {
  if (load.type === 'beam-uniform' || load.type === 'frame-uniform') return distributedArrows(load)
  if (load.type !== 'truss-self-weight') return []
  const element = elementViewById.value.get(load.elementId)
  return element ? [arrowInto(element.midpoint, 0, 1, `${load.id}-gravity`, load.id, 'self-weight', 'global-y')] : []
}))

function loadLegend(load: StructuralLoad): string {
  const display = (value: number, quantity: StructuralQuantityKey): string => {
    const quantityId = getStructuralQuantityId(quantity)
    const unitId = getStructuralUnit(quantity, props.unitPresetId)
    const converted = convertFromSI(value, quantityId, unitId)
    return `${Number(converted.toPrecision(6))} ${getUnitDefinition(quantityId, unitId).symbol}`
  }
  const displayInterval = (a: number, b: number): string => {
    const quantityId = getStructuralQuantityId('length')
    const unitId = getStructuralUnit('length', props.unitPresetId)
    const left = Number(convertFromSI(a, quantityId, unitId).toPrecision(6))
    const right = Number(convertFromSI(b, quantityId, unitId).toPrecision(6))
    return `[${left}, ${right}] ${getUnitDefinition(quantityId, unitId).symbol}`
  }
  if (load.type === 'nodal') {
    const values = [
      ...('fx' in load && load.fx !== undefined ? [`Fx=${display(load.fx, 'force')}`] : []),
      ...('fy' in load && load.fy !== undefined ? [`Fy=${display(load.fy, 'force')}`] : []),
      ...('mz' in load && load.mz !== undefined ? [`Mz=${display(load.mz, 'moment')}`] : []),
    ]
    return `${load.id}: 节点 ${load.nodeId}; ${values.join(', ')}`
  }
  if (load.type === 'beam-uniform') return `${load.id}: 单元 ${load.elementId}; qy=${display(load.qY, 'lineLoad')}（局部）`
  if (load.type === 'frame-uniform') {
    const interval = load.interval
      ? `; ${displayInterval(load.interval.a, load.interval.b)}`
      : '; 全长'
    return `${load.id}: 单元 ${load.elementId}; qx=${display(load.qX ?? 0, 'lineLoad')}, qy=${display(load.qY ?? 0, 'lineLoad')}（局部）${interval}`
  }
  if (load.type === 'uniform-temperature') return `${load.id}: 单元 ${load.elementId}; ΔT=${display(load.deltaT, 'temperatureDifference')}`
  if (load.type === 'initial-strain') return `${load.id}: 单元 ${load.elementId}; ε₀=${display(load.strain, 'strain')}`
  return `${load.id}: 单元 ${load.elementId}; 自重 g=${display(load.gravity, 'acceleration')}（全局 -y）`
}

const unitPresetLabel = computed(() => props.unitPresetId === 'si' ? 'SI' : '工程单位')

const legendHeight = computed(() => Math.max(520, 96 + props.model.loads.length * 48))
const viewBox = computed(() => `0 0 ${SVG_WIDTH} ${legendHeight.value}`)
</script>

<template>
  <figure class="structure-diagram-shell">
    <div
      class="structure-diagram-scroll"
      role="region"
      aria-label="结构、支座、坐标轴及载荷示意图"
    >
      <svg
        class="structure-diagram"
        :viewBox="viewBox"
        role="img"
        :aria-labelledby="titleId"
        data-safe-left="16"
        data-safe-right="944"
      >
        <title :id="titleId">结构输入示意：全局 x 向右、y 向上；单元局部 x 从 i 节点指向 j 节点</title>
        <defs>
          <marker :id="axisMarkerId" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#52636d" />
          </marker>
          <marker :id="localMarkerId" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#19717b" />
          </marker>
          <marker :id="loadMarkerId" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#b64835" />
          </marker>
        </defs>

        <g class="plot-zone" data-zone="plot" :data-analysis="model.analysis">
          <g class="global-axes" aria-label="全局坐标轴：x 向右，y 向上">
            <line x1="28" y1="474" x2="82" y2="474" :marker-end="`url(#${axisMarkerId})`" />
            <line x1="28" y1="474" x2="28" y2="420" :marker-end="`url(#${axisMarkerId})`" />
            <text x="88" y="479">x</text>
            <text x="22" y="410">y</text>
            <text x="28" y="492" text-anchor="middle">全局</text>
          </g>

          <line
            v-for="element in elementViews"
            :key="element.id"
            class="element-line"
            :data-element-id="element.id"
            :data-element-type="element.type"
            :data-node-i="element.nodeI"
            :data-node-j="element.nodeJ"
            :x1="element.i.x"
            :y1="element.i.y"
            :x2="element.j.x"
            :y2="element.j.y"
          />

          <g
            v-if="visibleLayers.localAxes"
            v-for="element in elementViews"
            :key="`${element.id}-axes`"
            class="local-axes"
            :data-element-id="element.id"
            :data-c="element.c"
            :data-s="element.s"
            aria-label="单元局部坐标轴"
          >
            <line
              :x1="element.midpoint.x"
              :y1="element.midpoint.y"
              :x2="element.localXEnd.x"
              :y2="element.localXEnd.y"
              :marker-end="`url(#${localMarkerId})`"
            />
            <line
              :x1="element.midpoint.x"
              :y1="element.midpoint.y"
              :x2="element.localYEnd.x"
              :y2="element.localYEnd.y"
              :marker-end="`url(#${localMarkerId})`"
            />
            <text :x="element.localXEnd.x + 5" :y="element.localXEnd.y - 4">xₗ</text>
            <text :x="element.localYEnd.x + 5" :y="element.localYEnd.y - 4">yₗ</text>
          </g>

          <text
            v-if="visibleLayers.elementLabels"
            v-for="element in elementViews"
            :key="`${element.id}-label`"
            class="element-label"
            :x="element.midpoint.x + 46 * element.s"
            :y="element.midpoint.y + 46 * element.c"
          >{{ element.id }} · {{ element.nodeI }}→{{ element.nodeJ }}</text>

          <g v-if="visibleLayers.supports" v-for="support in supports" :key="support.nodeId" class="support" :data-support="support.type" :data-node-id="support.nodeId" :data-orientation="support.orientation">
            <template v-if="support.type === 'fixed'">
              <g class="fixed-symbol" :transform="fixedSupportTransform(support.orientation!, support.x, support.y)">
                <line :x1="support.x - 4" :x2="support.x - 4" :y1="support.y - 25" :y2="support.y + 25" class="fixed-wall" />
                <path :d="`M ${support.x - 20} ${support.y - 18} l 16 -10 M ${support.x - 20} ${support.y} l 16 -10 M ${support.x - 20} ${support.y + 18} l 16 -10`" />
              </g>
            </template>
            <template v-else-if="support.type === 'pin' || support.type === 'roller-y'">
              <path :d="`M ${support.x} ${support.y + 3} l -16 25 h 32 Z`" />
              <template v-if="support.type === 'roller-y'">
                <circle :cx="support.x - 8" :cy="support.y + 33" r="4" />
                <circle :cx="support.x + 8" :cy="support.y + 33" r="4" />
              </template>
            </template>
            <template v-else-if="support.type === 'roller-x'">
              <path :d="`M ${support.x - 3} ${support.y} l -25 -16 v 32 Z`" />
              <circle :cx="support.x - 33" :cy="support.y - 8" r="4" />
              <circle :cx="support.x - 33" :cy="support.y + 8" r="4" />
            </template>
            <circle v-else :cx="support.x" :cy="support.y" r="13" class="rotation-restraint" />
          </g>

          <g v-for="node in nodeViews" :key="node.id" class="node" :data-node-id="node.id">
            <circle :cx="node.x" :cy="node.y" r="5" />
            <text v-if="visibleLayers.nodeLabels" class="node-label" :x="node.x + node.labelDx" :y="node.y + node.labelDy">{{ node.id }}</text>
          </g>

          <g v-if="visibleLayers.loads" v-for="arrow in [...nodalArrows, ...memberArrows]" :key="arrow.key" class="load-arrow" :data-load-id="arrow.loadId" :data-load-kind="arrow.kind" :data-direction="arrow.direction">
            <line :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2" :marker-end="`url(#${loadMarkerId})`" />
          </g>

          <g v-if="visibleLayers.loads" v-for="moment in nodalMoments" :key="moment.id" class="nodal-moment" :data-load-id="moment.id" :data-direction="moment.positive ? 'positive-ccw' : 'negative-cw'">
            <path
              :d="moment.positive
                ? `M ${moment.x + 19} ${moment.y} A 20 20 0 1 0 ${moment.x - 19} ${moment.y}`
                : `M ${moment.x - 19} ${moment.y} A 20 20 0 1 1 ${moment.x + 19} ${moment.y}`"
              :marker-end="`url(#${loadMarkerId})`"
            />
          </g>

          <template v-if="deformation && visibleLayers.results">
            <line
              v-for="element in elementViews.filter((value) => value.deformedI && value.deformedJ)"
              :key="`${element.id}-deformed`"
              class="deformed-element"
              :data-element-id="element.id"
              :x1="element.deformedI!.x"
              :y1="element.deformedI!.y"
              :x2="element.deformedJ!.x"
              :y2="element.deformedJ!.y"
            />
            <text class="deformation-warning" x="72" y="32">变形示意（非真实比例，显示系数 ×{{ deformation.scale }}）</text>
          </template>
        </g>

        <line v-if="visibleLayers.loads" class="legend-separator" x1="712" x2="712" y1="18" :y2="legendHeight - 18" />
        <g v-if="visibleLayers.loads" class="legend-zone" data-zone="legend" :data-zone-min-x="LEGEND_X">
          <text :x="LEGEND_X" y="34" class="legend-title">输入载荷（{{ unitPresetLabel }}）</text>
          <text v-if="model.loads.length === 0" :x="LEGEND_X" y="62" class="legend-empty">无载荷</text>
          <foreignObject
            v-for="(load, index) in model.loads"
            :key="load.id"
            :x="LEGEND_X"
            :y="48 + index * 48"
            width="216"
            height="44"
            class="legend-object"
            :data-load-id="load.id"
          >
            <div class="legend-item">{{ loadLegend(load) }}</div>
          </foreignObject>
        </g>
      </svg>
    </div>
    <figcaption>节点、单元、支座与载荷方向按输入模型显示；局部 xₗ 从 i 端指向 j 端。</figcaption>
  </figure>
</template>

<style scoped>
.structure-diagram-shell { margin: 0; }
.structure-diagram-scroll {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.structure-diagram { display: block; width: 100%; min-width: 0; height: auto; }
.structure-diagram :is(line, path, circle) { vector-effect: non-scaling-stroke; }
.element-line { stroke: #174f58; stroke-width: 4; stroke-linecap: round; }
.node circle { fill: #fff; stroke: #174f58; stroke-width: 2; }
.local-axes line { stroke: #19717b; stroke-width: 1.2; }
.global-axes line { stroke: #52636d; stroke-width: 1.4; }
.support :is(path, line, circle) { fill: #d9eeee; stroke: #11646d; stroke-width: 1.8; }
.support .fixed-wall { stroke-width: 5; }
.support .rotation-restraint { fill: none; stroke-dasharray: 3 2; }
.load-arrow line, .nodal-moment path { fill: none; stroke: #b64835; stroke-width: 2; }
.deformed-element { stroke: #c47420; stroke-width: 2; stroke-dasharray: 7 4; }
.legend-separator { stroke: #c8d5d8; stroke-width: 1; stroke-dasharray: 4 4; }
text {
  fill: #40545d;
  font-family: inherit;
  font-size: 12px;
  font-weight: 650;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
  stroke-linejoin: round;
}
.node-label { fill: #174f58; }
.element-label { fill: #19717b; text-anchor: middle; }
.legend-title { font-size: 13px; fill: #263f48; }
.legend-item {
  color: #40545d;
  font-family: inherit;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.deformation-warning { fill: #9a5a18; font-size: 13px; }
figcaption { margin-top: .45rem; color: #52636d; font-size: .82rem; }
@media (max-width: 720px) {
  .structure-diagram { min-width: 0; }
}
</style>
