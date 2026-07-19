<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { solvePlateBuckling, solveShellBuckling, type PlateBucklingBoundary, type PlateBucklingResult, type ShellBucklingBoundary, type ShellBucklingResult } from '../../../core/plate-shell'
import { evaluateNumericExpression } from '../../../core/numeric'
import { convertPresetValue, getPresetUnit, getUnitDefinition, normalizeToSI, type QuantityId, type UnitPresetId } from '../../../core/units'
import BucklingDiagram from './BucklingDiagram.vue'
import BucklingResults from './BucklingResults.vue'

type Kind = 'plate' | 'shell'
type Field = 'a' | 'b' | 'pt' | 'l' | 'r' | 'st' | 'e' | 'nu' | 'nx'
interface Draft extends Record<Field, string> { kind: Kind | null; plateBoundary: PlateBucklingBoundary | null; shellBoundary: ShellBucklingBoundary | null }
const DEFAULTS: Draft = { kind: null, plateBoundary: null, shellBoundary: null, a: '1000', b: '1000', pt: '20', l: '1000', r: '500', st: '5', e: '200000', nu: '.3', nx: '1000' }
const draft = reactive<Draft>({ ...DEFAULTS })
const preset = ref<UnitPresetId>('engineering')
const result = ref<PlateBucklingResult | ShellBucklingResult | null>(null)
const error = ref('')
const convertible: ReadonlyArray<readonly [Field, QuantityId]> = [['a','length'],['b','length'],['pt','length'],['l','length'],['r','length'],['st','length'],['e','elasticModulus'],['nx','lineLoad']]
const units = computed(() => ({ length: unitSymbol('length'), modulus: unitSymbol('elasticModulus'), line: unitSymbol('lineLoad') }))
const boundarySelected = computed(() => draft.kind === 'plate' ? draft.plateBoundary !== null : draft.kind === 'shell' ? draft.shellBoundary !== null : false)
function unitSymbol(quantity: QuantityId): string { const id = getPresetUnit(quantity, preset.value); return getUnitDefinition(quantity, id).symbol }
function clear(): void { result.value = null; error.value = '' }
function number(field: Field): number { return evaluateNumericExpression(draft[field]) }
function si(field: Field, quantity: QuantityId): number { return normalizeToSI(number(field), quantity, getPresetUnit(quantity, preset.value)) }
function switchPreset(next: UnitPresetId): void {
  for (const [field, quantity] of convertible) try { const converted = convertPresetValue(number(field), quantity, preset.value, next); if (converted !== null) draft[field] = String(Number(converted.toPrecision(12))) } catch {}
  preset.value = next
}
function calculate(): void {
  clear()
  try {
    if (!draft.kind) throw new Error('必须显式选择计算对象')
    const material = { elasticModulusPa: si('e', 'elasticModulus'), poissonRatio: number('nu') }
    if (draft.kind === 'plate') {
      if (!draft.plateBoundary) throw new Error('必须显式选择板屈曲边界')
      result.value = solvePlateBuckling({ calculatorId: 'plate-buckling', boundary: draft.plateBoundary, lengthXM: si('a','length'), widthYM: si('b','length'), thicknessM: si('pt','length'), material, appliedCompressionNPerM: si('nx','lineLoad'), maximumLongitudinalHalfWaves: 200 })
    } else {
      if (!draft.shellBoundary) throw new Error('必须显式选择圆柱壳屈曲边界')
      result.value = solveShellBuckling({ calculatorId: 'shell-buckling', boundary: draft.shellBoundary, lengthM: si('l','length'), meanRadiusM: si('r','length'), thicknessM: si('st','length'), material, appliedCompressionNPerM: si('nx','lineLoad'), maximumAxialHalfWaves: 200, maximumCircumferentialWaves: 200 })
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '计算失败' }
}
function reset(): void { Object.assign(draft, DEFAULTS); preset.value = 'engineering'; clear() }
</script>

<template>
  <section class="calculator">
    <header><div><p>P3 · Gate P3-4</p><h2>板与圆柱壳屈曲初算</h2><span>只输出理想线弹性理论临界值；压缩量取正。</span></div><div class="units"><button :class="{active:preset==='engineering'}" @click="switchPreset('engineering')">t–mm–s–N–MPa</button><button :class="{active:preset==='si'}" @click="switchPreset('si')">SI（kg–m–s–N–Pa）</button></div></header>
    <div class="layout">
      <form @submit.prevent="calculate">
        <fieldset><legend>1. 计算对象（必选）</legend><label><input v-model="draft.kind" type="radio" value="plate" @change="clear">矩形板</label><label><input v-model="draft.kind" type="radio" value="shell" @change="clear">圆柱壳</label></fieldset>
        <fieldset v-if="draft.kind === 'plate'"><legend>2. 板边界（必选）</legend><label><input v-model="draft.plateBoundary" type="radio" value="ssss-uniaxial" @change="clear">四边简支、x 向均匀压缩</label></fieldset>
        <fieldset v-if="draft.kind === 'shell'"><legend>2. 壳边界（必选）</legend><label><input v-model="draft.shellBoundary" type="radio" value="simply-supported-axial" @change="clear">简支无加劲圆柱壳、均匀轴压</label></fieldset>
        <template v-if="draft.kind === 'plate'"><h3>3. 板几何</h3><label>长度 a<div><input v-model="draft.a" aria-label="屈曲板长度 a" @input="clear"><b>{{ units.length }}</b></div></label><label>宽度 b<div><input v-model="draft.b" aria-label="屈曲板宽度 b" @input="clear"><b>{{ units.length }}</b></div></label><label>厚度 t<div><input v-model="draft.pt" aria-label="屈曲板厚度" @input="clear"><b>{{ units.length }}</b></div></label></template>
        <template v-if="draft.kind === 'shell'"><h3>3. 壳几何</h3><label>长度 L<div><input v-model="draft.l" aria-label="屈曲壳长度" @input="clear"><b>{{ units.length }}</b></div></label><label>平均半径 r<div><input v-model="draft.r" aria-label="屈曲壳平均半径" @input="clear"><b>{{ units.length }}</b></div></label><label>厚度 t<div><input v-model="draft.st" aria-label="屈曲壳厚度" @input="clear"><b>{{ units.length }}</b></div></label></template>
        <template v-if="draft.kind"><h3>4. 材料与载荷</h3><label>弹性模量 E<div><input v-model="draft.e" aria-label="屈曲弹性模量" @input="clear"><b>{{ units.modulus }}</b></div></label><label>泊松比 ν<div><input v-model="draft.nu" aria-label="屈曲泊松比" @input="clear"><b>—</b></div></label><label>施加压缩膜力 Nx<div><input v-model="draft.nx" aria-label="施加压缩膜力" @input="clear"><b>{{ units.line }}</b></div></label></template>
        <section><button>计算屈曲临界值</button><button type="button" @click="reset">重置</button></section>
      </form>
      <BucklingDiagram :kind="draft.kind" :boundary-selected="boundarySelected" />
    </div>
    <div v-if="error" role="alert" class="error">{{ error }}</div>
    <BucklingResults v-if="result" :result="result" :unit-preset="preset" />
  </section>
</template>

<style scoped>
.calculator{display:grid;gap:18px}.calculator>header{display:flex;justify-content:space-between;padding:20px;border:1px solid var(--color-line);border-left:4px solid var(--color-brand);border-radius:12px;background:#f7faf9}header p{margin:0;color:var(--color-brand);font-size:10px}h2{margin:4px 0}.units{display:flex;gap:5px}.units button,form section button{padding:9px;border:1px solid var(--color-line);border-radius:8px;background:#fff}.units .active,form section button:first-child{color:#fff;background:var(--color-brand)}.layout{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:start}form{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:20px;border:1px solid var(--color-line);border-radius:var(--radius-large);background:#fff}fieldset,h3,form section{grid-column:1/-1}fieldset{display:flex;gap:20px}label{display:grid;gap:5px;font-size:12px}label>div{display:grid;grid-template-columns:1fr auto;border:1px solid #cad5da;border-radius:8px;overflow:hidden}input{min-width:0;padding:10px;border:0}b{padding:10px;background:#f7f9fa;font-size:10px}form section{display:flex;gap:8px}.error{padding:14px;color:#8f342d;background:#fff0ed}@media(max-width:900px){.calculator>header{flex-direction:column}.units{flex-direction:column}.layout{grid-template-columns:1fr}}@media(max-width:560px){form{grid-template-columns:1fr}fieldset,h3,form section{grid-column:auto}fieldset,form section{flex-direction:column}}
</style>
