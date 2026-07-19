<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import {
  isStructuralIssueCode,
  type InfluenceLineRequest,
  type MovingLoadRequest,
  type StructuralAnalysisRequest,
  type StructuralIssue,
  type StructuralModel2D,
  type StructuralScreenResult,
} from '../../core/structural'
import {
  getStructuralQuantityId,
  getStructuralUnit,
  STRUCTURAL_UNIT_SYSTEMS,
  type StructuralQuantityKey,
} from '../../core/structural/units'
import {
  convertFromSI,
  getUnitDefinition,
  normalizeToSI,
  type UnitPresetId,
} from '../../core/units'
import { runStructuralCalculation } from './calculation'
import StructureDiagram, {
  type StructureDiagramDeformation,
  type StructureDiagramLayers,
} from './components/StructureDiagram.vue'
import StructuralModelEditor from './components/StructuralModelEditor.vue'
import StructuralResults from './components/StructuralResults.vue'
import { getStructuralExample, STRUCTURAL_EXAMPLES, type StructuralExample } from './examples'
import StructuralWorkspace from './StructuralWorkspace.vue'
import type { StructuralModuleId } from './types'

type AvailableModuleId = StructuralAnalysisRequest['analysis']
type WorkspaceState = 'idle' | 'dirty-valid' | 'dirty-invalid' | 'solving' | 'success' | 'warning' | 'error'

const DEFAULT_EXAMPLE_BY_MODULE: Readonly<Record<AvailableModuleId, StructuralExample['id']>> = {
  beam: 'BEAM-A01',
  truss: 'TRUSS-A01',
  frame: 'FRAME-A01',
  'influence-line': 'IL-A03',
  'moving-load': 'ML-A01',
}

const unitPresetId = ref<UnitPresetId>('engineering')
const exampleId = ref<StructuralExample['id']>('BEAM-A01')
const request = ref<StructuralAnalysisRequest>(getStructuralExample(exampleId.value))
const result = ref<StructuralScreenResult | null>(null)
const issues = ref<readonly StructuralIssue[]>([])
const state = ref<WorkspaceState>('idle')
const hasSuccessfulCalculation = ref(false)
const diagramLayers = reactive<StructureDiagramLayers>({
  nodeLabels: true,
  elementLabels: true,
  localAxes: true,
  supports: true,
  loads: true,
  results: true,
})
let recalculateTimer: ReturnType<typeof setTimeout> | undefined

const currentModel = computed((): StructuralModel2D | null =>
  request.value.analysis === 'beam' || request.value.analysis === 'truss' || request.value.analysis === 'frame'
    ? request.value
    : null,
)
const influenceRequest = computed((): InfluenceLineRequest | null =>
  request.value.analysis === 'influence-line' ? request.value : null)
const movingRequest = computed((): MovingLoadRequest | null =>
  request.value.analysis === 'moving-load' ? request.value : null)
const currentExamples = computed(() => STRUCTURAL_EXAMPLES.filter(({ request: candidate }) =>
  candidate.analysis === request.value.analysis))
const currentExample = computed(() => STRUCTURAL_EXAMPLES.find(({ id }) => id === exampleId.value))
const deformation = computed((): StructureDiagramDeformation | undefined => {
  if (!result.value || result.value.status === 'error') return undefined
  const data = result.value.structural
  if (!('displacements' in data)) return undefined
  return {
    scale: 50,
    nodeDisplacements: data.displacements.map(({ nodeId, u, v }) => ({
      nodeId, u: u.value, v: v.value,
    })),
  }
})

function unitSymbol(quantity: StructuralQuantityKey): string {
  const quantityId = getStructuralQuantityId(quantity)
  return getUnitDefinition(quantityId, getStructuralUnit(quantity, unitPresetId.value)).symbol
}

function unitPresetLabel(presetId: UnitPresetId): string {
  return presetId === 'engineering' ? 't–mm–MPa–N–s' : 'SI（kg–m–Pa–N–s）'
}

function displayValue(value: number, quantity: StructuralQuantityKey): number {
  return convertFromSI(value, getStructuralQuantityId(quantity), getStructuralUnit(quantity, unitPresetId.value))
}

function inputValue(event: Event, quantity: StructuralQuantityKey): number {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return Number.NaN
  return normalizeToSI(value, getStructuralQuantityId(quantity), getStructuralUnit(quantity, unitPresetId.value))
}

function containsNonfinite(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value)
  if (Array.isArray(value)) return value.some(containsNonfinite)
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value).some(containsNonfinite)
}

function resultIssues(screenResult: StructuralScreenResult): readonly StructuralIssue[] {
  if (screenResult.status !== 'error') return []
  return screenResult.messages.flatMap((message): StructuralIssue[] => {
    if (!isStructuralIssueCode(message.code)) return []
    return [{
      code: message.code,
      severity: message.severity === 'warning' ? 'warning' : 'error',
      message: message.message,
      ...(message.field === undefined ? {} : { field: message.field }),
    }]
  })
}

function calculate(): void {
  if (recalculateTimer) clearTimeout(recalculateTimer)
  state.value = 'solving'
  const next = runStructuralCalculation(request.value)
  result.value = next
  issues.value = resultIssues(next)
  state.value = next.status
  if (next.status === 'success' || next.status === 'warning') hasSuccessfulCalculation.value = true
}

function markEdited(next: StructuralAnalysisRequest): void {
  request.value = next
  result.value = null
  issues.value = []
  const invalid = containsNonfinite(next)
  state.value = invalid ? 'dirty-invalid' : 'dirty-valid'
  if (invalid) {
    if (recalculateTimer) clearTimeout(recalculateTimer)
    return
  }
  if (!hasSuccessfulCalculation.value) return
  if (recalculateTimer) clearTimeout(recalculateTimer)
  recalculateTimer = setTimeout(calculate, 300)
}

function selectExample(id: StructuralExample['id']): void {
  exampleId.value = id
  request.value = getStructuralExample(id)
  result.value = null
  issues.value = []
  state.value = 'idle'
  hasSuccessfulCalculation.value = false
  if (recalculateTimer) clearTimeout(recalculateTimer)
}

function selectModule(moduleId: StructuralModuleId): void {
  if (!(moduleId in DEFAULT_EXAMPLE_BY_MODULE)) return
  selectExample(DEFAULT_EXAMPLE_BY_MODULE[moduleId as AvailableModuleId])
}

function patchInfluence(patch: Partial<InfluenceLineRequest>): void {
  if (request.value.analysis !== 'influence-line') return
  markEdited({ ...request.value, ...patch })
}

function patchInfluenceResponsePosition(event: Event): void {
  if (request.value.analysis !== 'influence-line' || !('position' in request.value.response)) return
  markEdited({
    ...request.value,
    response: { ...request.value.response, position: inputValue(event, 'length') },
  })
}

function patchMoving(patch: Partial<MovingLoadRequest>): void {
  if (request.value.analysis !== 'moving-load') return
  markEdited({ ...request.value, ...patch })
}

function patchMovingLoad(event: Event, axleIndex: number): void {
  if (request.value.analysis !== 'moving-load') return
  const axles = request.value.movingLoad.axles.map((axle, index) => index === axleIndex
    ? { ...axle, load: inputValue(event, 'force') }
    : axle) as unknown as MovingLoadRequest['movingLoad']['axles']
  patchMoving({ movingLoad: { ...request.value.movingLoad, axles } })
}

function patchMovingSpacing(event: Event, spacingIndex: number): void {
  if (request.value.analysis !== 'moving-load') return
  const adjacentSpacings = request.value.movingLoad.adjacentSpacings.map((spacing, index) =>
    index === spacingIndex ? inputValue(event, 'length') : spacing)
  patchMoving({ movingLoad: { ...request.value.movingLoad, adjacentSpacings } })
}

onBeforeUnmount(() => {
  if (recalculateTimer) clearTimeout(recalculateTimer)
})
</script>

<template>
  <StructuralWorkspace @module-change="selectModule">
    <template #workspace>
      <section class="calculator-stage" aria-labelledby="p2-calculator-title">
        <header class="calculator-toolbar">
          <div>
            <span>输入与计算</span>
            <h3 id="p2-calculator-title">{{ currentExample?.title }}</h3>
          </div>
          <label>
            验收算例
            <select :value="exampleId" @change="selectExample(($event.target as HTMLSelectElement).value as StructuralExample['id'])">
              <option v-for="example in currentExamples" :key="example.id" :value="example.id">
                {{ example.id }} · {{ example.title }}
              </option>
            </select>
          </label>
          <fieldset class="unit-preset-control" data-testid="structural-unit-preset">
            <legend>单位制</legend>
            <button
              v-for="preset in STRUCTURAL_UNIT_SYSTEMS"
              :key="preset.id"
              type="button"
              :aria-pressed="unitPresetId === preset.id"
              :data-unit-preset="preset.id"
              @click="unitPresetId = preset.id"
            >{{ unitPresetLabel(preset.id) }}</button>
          </fieldset>
          <div class="state-chip" :data-state="state">{{ state }}</div>
        </header>

        <div v-if="currentModel" class="model-layout">
          <StructuralModelEditor
            :model-value="currentModel"
            :unit-preset-id="unitPresetId"
            :issues="issues"
            @update:model-value="markEdited"
          />
          <section class="diagram-panel" aria-labelledby="p2-diagram-title">
            <div>
              <h3 id="p2-diagram-title">结构与载荷示意</h3>
              <p>全局/局部轴、节点、单元、支座与载荷方向均按内核约定绘制。</p>
            </div>
            <fieldset class="diagram-layer-controls" aria-label="图层显示">
              <legend>图层显示</legend>
              <label><input v-model="diagramLayers.nodeLabels" type="checkbox" data-layer-toggle="node-labels" />节点号</label>
              <label><input v-model="diagramLayers.elementLabels" type="checkbox" data-layer-toggle="element-labels" />单元号</label>
              <label><input v-model="diagramLayers.localAxes" type="checkbox" data-layer-toggle="local-axes" />局部轴</label>
              <label><input v-model="diagramLayers.supports" type="checkbox" data-layer-toggle="supports" />支座</label>
              <label><input v-model="diagramLayers.loads" type="checkbox" data-layer-toggle="loads" />载荷</label>
              <label><input v-model="diagramLayers.results" type="checkbox" data-layer-toggle="results" />结果</label>
            </fieldset>
            <StructureDiagram v-if="deformation" :model="currentModel" :deformation="deformation" :unit-preset-id="unitPresetId" :layers="diagramLayers" />
            <StructureDiagram v-else :model="currentModel" :unit-preset-id="unitPresetId" :layers="diagramLayers" />
          </section>
        </div>

        <section v-else-if="influenceRequest" class="simple-editor" aria-label="影响线输入">
          <label>跨度 L / {{ unitSymbol('length') }}
            <input type="number" :value="displayValue(influenceRequest.beam.span, 'length')" @input="patchInfluence({ beam: { ...influenceRequest.beam, span: inputValue($event, 'length') } })" />
          </label>
          <label v-if="'position' in influenceRequest.response">截面位置 a / {{ unitSymbol('length') }}
            <input type="number" :value="displayValue(influenceRequest.response.position, 'length')" @input="patchInfluenceResponsePosition" />
          </label>
          <p>剪力影响线在截面处保留 left/right 两侧极限，不平滑跳变。</p>
        </section>

        <section v-else-if="movingRequest" class="simple-editor" aria-label="移动荷载输入">
          <label>跨度 L / {{ unitSymbol('length') }}
            <input type="number" :value="displayValue(movingRequest.beam.span, 'length')" @input="patchMoving({ beam: { ...movingRequest.beam, span: inputValue($event, 'length') } })" />
          </label>
          <label>动力系数 φ / {{ unitSymbol('dimensionless') }}
            <input type="number" :value="movingRequest.movingLoad.dynamicFactor" @input="patchMoving({ movingLoad: { ...movingRequest.movingLoad, dynamicFactor: Number(($event.target as HTMLInputElement).value) } })" />
          </label>
          <label v-for="(axle, index) in movingRequest.movingLoad.axles" :key="axle.id">
            轴载 {{ axle.id }} / {{ unitSymbol('force') }}
            <input type="number" :value="displayValue(axle.load, 'force')" @input="patchMovingLoad($event, index)" />
          </label>
          <label v-for="(spacing, index) in movingRequest.movingLoad.adjacentSpacings" :key="index">
            相邻轴距 {{ index + 1 }} / {{ unitSymbol('length') }}
            <input type="number" :value="displayValue(spacing, 'length')" @input="patchMovingSpacing($event, index)" />
          </label>
          <p>只输出已确认的最大/最小控制值与控制轴位置，不生成未确认的完整包络曲线。</p>
        </section>

        <div class="calculate-row">
          <button type="button" class="calculate-button" :disabled="state === 'solving'" @click="calculate">
            {{ hasSuccessfulCalculation ? '重新计算' : '计算结构响应' }}
          </button>
          <p>首次必须手动计算；首次成功后，有效编辑将在约 300 ms 后自动重算。</p>
        </div>

        <StructuralResults v-if="result" :result="result" :unit-preset-id="unitPresetId" />
        <div v-else class="result-placeholder" :data-state="state">
          <strong>{{ state === 'idle' ? '等待首次计算' : '输入已更改，旧结果已清除' }}</strong>
          <span>{{ state === 'dirty-invalid' ? '当前含非法数值；修正后再计算。' : '核对单位、约束和载荷后执行计算。' }}</span>
        </div>
      </section>
    </template>
  </StructuralWorkspace>
</template>

<style scoped>
.calculator-stage { min-width: 0; display: grid; gap: 18px; }
.calculator-toolbar { display: grid; grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(160px, auto)) auto; gap: 14px; align-items: end; padding: 16px 18px; border: 1px solid var(--color-line); border-radius: 11px; background: var(--color-panel); }
.calculator-toolbar span { color: var(--color-brand); font-size: 12px; font-weight: 800; letter-spacing: .06em; }
.calculator-toolbar h3 { margin: 4px 0 0; font-size: 17px; }
.calculator-toolbar label, .simple-editor label { display: grid; gap: 5px; color: var(--color-muted); font-size: 12px; font-weight: 700; }
select, input { min-height: 44px; max-width: 100%; padding: 8px 10px; border: 1px solid #b9c7cc; border-radius: 7px; color: var(--color-ink); background: #fff; font: inherit; }
.unit-preset-control { display: grid; grid-template-columns: repeat(2, minmax(132px, 1fr)); gap: 4px; margin: 0; padding: 0; border: 0; }
.unit-preset-control legend { margin-bottom: 5px; color: var(--color-muted); font-size: 12px; font-weight: 700; }
.unit-preset-control button { min-height: 44px; padding: 7px 9px; border: 1px solid #b9c7cc; color: #40545d; background: #fff; font: inherit; font-size: 12px; font-weight: 750; cursor: pointer; }
.unit-preset-control button:first-of-type { border-radius: 7px 0 0 7px; }.unit-preset-control button:last-of-type { border-radius: 0 7px 7px 0; }
.unit-preset-control button[aria-pressed="true"] { border-color: var(--color-brand); color: #fff; background: var(--color-brand); }
.state-chip { min-width: 94px; padding: 8px 10px; border-radius: 999px; color: #40545d; background: #edf1f3; text-align: center; font-size: 12px; font-weight: 800; }
.state-chip[data-state="success"] { color: var(--color-success); background: #e8f6ed; }.state-chip[data-state="warning"] { color: #795700; background: #fff5d8; }.state-chip[data-state="error"], .state-chip[data-state="dirty-invalid"] { color: #9c2f2b; background: #fdebea; }
.model-layout { min-width: 0; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(360px, .85fr); gap: 16px; align-items: start; }
.diagram-panel { min-width: 0; padding: 16px; overflow: hidden; border: 1px solid var(--color-line); border-radius: 11px; background: var(--color-panel); }
.diagram-panel h3 { margin: 0 0 4px; font-size: 15px; }.diagram-panel p, .simple-editor p, .calculate-row p { margin: 0; color: var(--color-muted); font-size: 12px; line-height: 1.6; }
.diagram-layer-controls { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 12px 0 4px; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: 8px; }
.diagram-layer-controls legend { padding: 0 5px; color: var(--color-muted); font-size: 12px; font-weight: 800; }
.diagram-layer-controls label { display: inline-flex; min-height: 44px; align-items: center; gap: 6px; color: #40545d; font-size: 12px; font-weight: 700; }
.diagram-layer-controls input { width: 18px; min-height: 18px; margin: 0; padding: 0; }
.simple-editor { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; padding: 18px; border: 1px solid var(--color-line); border-radius: 11px; background: var(--color-panel); }.simple-editor p { grid-column: 1 / -1; }
.calculate-row { display: flex; gap: 14px; align-items: center; }.calculate-button { min-height: 46px; padding: 11px 20px; border: 0; border-radius: 8px; color: #fff; background: var(--color-brand); font-weight: 800; cursor: pointer; }.calculate-button:disabled { opacity: .55; cursor: wait; }
.result-placeholder { display: grid; gap: 5px; padding: 24px; border: 1px dashed #b8c8cd; border-radius: 10px; color: var(--color-muted); background: #f8fafb; text-align: center; }.result-placeholder strong { color: #40545d; }
@media (max-width: 1100px) { .calculator-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }.model-layout { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .calculator-toolbar { grid-template-columns: 1fr; }.calculate-row { align-items: stretch; flex-direction: column; }.calculate-button { width: 100%; } }
</style>
