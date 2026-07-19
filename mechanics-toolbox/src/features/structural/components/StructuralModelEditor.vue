<script setup lang="ts">
import { computed } from 'vue'

import type {
  BeamPropertySource,
  FrameUniformLoad,
  StructuralIssue,
  StructuralLoad,
  StructuralModel2D,
  TrussPropertySource,
} from '../../../core/structural/contracts'
import {
  getStructuralQuantityId,
  getStructuralUnit,
  type StructuralQuantityKey,
} from '../../../core/structural/units'
import { convertFromSI, getUnitDefinition, normalizeToSI, type UnitPresetId } from '../../../core/units'

const props = defineProps<{
  modelValue: StructuralModel2D
  unitPresetId: UnitPresetId
  issues: readonly StructuralIssue[]
}>()

const emit = defineEmits<{
  'update:modelValue': [model: StructuralModel2D]
}>()

type CollectionKey = 'nodes' | 'elements' | 'constraints' | 'materials' | 'sections' | 'loads'
type PropertySource = BeamPropertySource | TrussPropertySource

interface NumericDescriptor {
  readonly field: string
  readonly label: string
  readonly quantity: StructuralQuantityKey
  readonly optional?: boolean
}

const nodeNumbers: readonly NumericDescriptor[] = [
  { field: 'x', label: 'x', quantity: 'coordinate' },
  { field: 'y', label: 'y', quantity: 'coordinate' },
]
const materialNumbers: readonly NumericDescriptor[] = [
  { field: 'E', label: 'E', quantity: 'elasticModulus' },
  { field: 'alpha', label: 'α', quantity: 'thermalExpansionCoefficient', optional: true },
  { field: 'density', label: 'ρ', quantity: 'density', optional: true },
]
const sectionNumbers: readonly NumericDescriptor[] = [
  { field: 'A', label: 'A', quantity: 'area' },
  { field: 'I', label: 'I', quantity: 'secondMomentOfArea', optional: true },
  { field: 'extremeFiberY', label: 'yₑ', quantity: 'length', optional: true },
]

function unitSymbol(quantity: StructuralQuantityKey): string {
  const quantityId = getStructuralQuantityId(quantity)
  const unitId = getStructuralUnit(quantity, props.unitPresetId)
  return getUnitDefinition(quantityId, unitId).symbol
}

function displayValue(value: unknown, quantity: StructuralQuantityKey): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return String(convertFromSI(value, getStructuralQuantityId(quantity), getStructuralUnit(quantity, props.unitPresetId)))
}

function valueFromEvent(event: Event, quantity: StructuralQuantityKey, optional = false): number | undefined {
  const raw = (event.target as HTMLInputElement).value.trim()
  if (raw === '' && optional) return undefined
  const display = Number(raw)
  if (!Number.isFinite(display)) return Number.NaN
  return normalizeToSI(display, getStructuralQuantityId(quantity), getStructuralUnit(quantity, props.unitPresetId))
}

function rawValue(row: object, field: string): unknown {
  return (row as unknown as Readonly<Record<string, unknown>>)[field]
}

function emitPatch(patch: Readonly<Record<string, unknown>>): void {
  emit('update:modelValue', { ...props.modelValue, ...patch } as StructuralModel2D)
}

function rows(key: CollectionKey): readonly object[] {
  return props.modelValue[key] as readonly object[]
}

function replaceRows(key: CollectionKey, nextRows: readonly object[]): void {
  emitPatch({ [key]: nextRows })
}

function patchRow(key: CollectionKey, index: number, field: string, value: unknown): void {
  const next = [...rows(key)]
  const row = { ...next[index] } as Record<string, unknown>
  if (value === undefined) delete row[field]
  else row[field] = value
  next[index] = row
  replaceRows(key, next)
}

function patchNumericRow(key: CollectionKey, index: number, descriptor: NumericDescriptor, event: Event): void {
  patchRow(key, index, descriptor.field, valueFromEvent(event, descriptor.quantity, descriptor.optional))
}

function removeRow(key: CollectionKey, index: number): void {
  replaceRows(key, rows(key).filter((_, rowIndex) => rowIndex !== index))
}

function nextId(items: readonly object[], prefix: string): string {
  const ids = new Set(items.map((item) => String(rawValue(item, 'id') ?? '')))
  let index = items.length + 1
  while (ids.has(`${prefix}${index}`)) index += 1
  return `${prefix}${index}`
}

function addNode(): void {
  replaceRows('nodes', [...props.modelValue.nodes, { id: nextId(props.modelValue.nodes, 'N'), x: 0, y: 0 }])
}

function addMaterial(): void {
  replaceRows('materials', [...props.modelValue.materials, {
    id: nextId(props.modelValue.materials, 'M'), E: 200e9,
  }])
}

function addSection(): void {
  replaceRows('sections', [...props.modelValue.sections, {
    id: nextId(props.modelValue.sections, 'S'), A: 1e-3,
    ...(props.modelValue.analysis === 'truss' ? {} : { I: 1e-6 }),
  }])
}

function inlineProperties(): PropertySource {
  return props.modelValue.analysis === 'truss'
    ? { source: 'inline', E: 200e9, A: 1e-3 }
    : { source: 'inline', E: 200e9, A: 1e-3, I: 1e-6 }
}

function libraryProperties(): PropertySource {
  return {
    source: 'library',
    materialId: props.modelValue.materials[0]?.id ?? '',
    sectionId: props.modelValue.sections[0]?.id ?? '',
  }
}

function addElement(): void {
  const id = nextId(props.modelValue.elements, 'E')
  const nodeI = props.modelValue.nodes[0]?.id ?? ''
  const nodeJ = props.modelValue.nodes[1]?.id ?? nodeI
  const base = { id, nodeI, nodeJ }
  const element = props.modelValue.analysis === 'beam'
    ? { type: 'beam' as const, ...base }
    : { type: props.modelValue.analysis, ...base, properties: inlineProperties() }
  replaceRows('elements', [...props.modelValue.elements, element])
}

function addConstraint(): void {
  replaceRows('constraints', [...props.modelValue.constraints, {
    nodeId: props.modelValue.nodes[0]?.id ?? '', dof: 'u', value: 0,
  }])
}

function patchElementProperty(index: number, field: string, value: unknown): void {
  const element = props.modelValue.elements[index]
  if (!element || element.type === 'beam') return
  const properties = { ...element.properties } as Record<string, unknown>
  if (value === undefined) delete properties[field]
  else properties[field] = value
  patchRow('elements', index, 'properties', properties)
}

function switchElementPropertySource(index: number, source: 'inline' | 'library'): void {
  patchRow('elements', index, 'properties', source === 'inline' ? inlineProperties() : libraryProperties())
}

function patchElementPropertyNumber(index: number, descriptor: NumericDescriptor, event: Event): void {
  patchElementProperty(index, descriptor.field, valueFromEvent(event, descriptor.quantity, descriptor.optional))
}

function patchUniformProperty(field: string, value: unknown): void {
  if (props.modelValue.analysis !== 'beam') return
  const properties = { ...props.modelValue.uniformProperties } as Record<string, unknown>
  if (value === undefined) delete properties[field]
  else properties[field] = value
  emitPatch({ uniformProperties: properties })
}

function switchUniformPropertySource(source: 'inline' | 'library'): void {
  if (props.modelValue.analysis !== 'beam') return
  emitPatch({ uniformProperties: source === 'inline' ? inlineProperties() : libraryProperties() })
}

const loadTypeOptions = computed<readonly StructuralLoad['type'][]>(() => {
  if (props.modelValue.analysis === 'beam') return ['nodal', 'beam-uniform']
  if (props.modelValue.analysis === 'truss') {
    return ['nodal', 'uniform-temperature', 'initial-strain', 'truss-self-weight']
  }
  return ['nodal', 'frame-uniform', 'uniform-temperature', 'initial-strain']
})

const loadTypeLabels: Readonly<Record<StructuralLoad['type'], string>> = {
  nodal: '节点荷载',
  'beam-uniform': '梁均布荷载',
  'frame-uniform': '刚架分布荷载',
  'uniform-temperature': '均匀温差',
  'initial-strain': '初应变',
  'truss-self-weight': '桁架自重',
}

function defaultLoad(type: StructuralLoad['type'], id: string): StructuralLoad {
  const nodeId = props.modelValue.nodes[0]?.id ?? ''
  const elementId = props.modelValue.elements[0]?.id ?? ''
  if (type === 'nodal') return { type, id, nodeId, fy: 0 }
  if (type === 'beam-uniform') return { type, id, elementId, qY: 0 }
  if (type === 'frame-uniform') return { type, id, elementId, qY: 0 }
  if (type === 'uniform-temperature') return { type, id, elementId, deltaT: 0 }
  if (type === 'initial-strain') return { type, id, elementId, strain: 0 }
  return { type, id, elementId, gravity: 9.80665 }
}

function addLoad(type: StructuralLoad['type']): void {
  const id = nextId(props.modelValue.loads, 'L')
  replaceRows('loads', [...props.modelValue.loads, defaultLoad(type, id)])
}

function switchLoadType(index: number, type: StructuralLoad['type']): void {
  const id = props.modelValue.loads[index]?.id ?? nextId(props.modelValue.loads, 'L')
  const replacement = defaultLoad(type, id)
  const next = [...props.modelValue.loads]
  next[index] = replacement as never
  replaceRows('loads', next)
}

function patchLoadNumber(index: number, field: string, quantity: StructuralQuantityKey, event: Event, optional = false): void {
  patchRow('loads', index, field, valueFromEvent(event, quantity, optional))
}

function toggleLoadInterval(index: number, enabled: boolean): void {
  const load = props.modelValue.loads[index]
  if (!load || load.type !== 'frame-uniform') return
  patchRow('loads', index, 'interval', enabled ? { a: 0, b: 1 } : undefined)
}

function patchLoadInterval(index: number, field: 'a' | 'b', event: Event): void {
  const load = props.modelValue.loads[index]
  if (!load || load.type !== 'frame-uniform' || !load.interval) return
  patchRow('loads', index, 'interval', {
    ...load.interval,
    [field]: valueFromEvent(event, 'length'),
  })
}

function fieldDomId(field: string): string {
  return `structural-field-${field.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function issueTargetField(field: string): string {
  if (props.modelValue.analysis === 'beam') {
    const match = /^elements\[0\]\.(E|A|I)$/.exec(field)
    if (match) return `uniformProperties.${match[1]}`
  }
  const excludedRelease = /^(elements\[\d+\])\.(releaseIMz|releaseJMz|internalHinge|nodeIRotationReleased|nodeJRotationReleased)$/.exec(field)
  if (excludedRelease) return excludedRelease[1]!
  return field
}

function fieldIssues(field: string): readonly StructuralIssue[] {
  return props.issues.filter((issue) => issue.field === field)
}

function fieldInvalid(field: string): boolean {
  return fieldIssues(field).some(({ severity }) => severity === 'error')
}

function propertyOf(element: object): PropertySource | undefined {
  return rawValue(element, 'properties') as PropertySource | undefined
}
</script>

<template>
  <form :id="fieldDomId('model')" class="structural-model-editor" @submit.prevent aria-label="结构模型编辑器">
    <header class="editor-header">
      <div>
        <h3>结构模型输入</h3>
        <p>模型值始终保存为 canonical SI；当前仅改变显示单位。</p>
      </div>
      <output class="preset-indicator" data-testid="unit-preset">{{ unitPresetId }}</output>
    </header>

    <aside v-if="issues.length" class="issue-summary" aria-label="模型问题" aria-live="polite">
      <strong>需处理 {{ issues.length }} 项</strong>
      <ul>
        <li v-for="(issue, index) in issues" :key="`${issue.code}-${index}`" :data-issue-field="issue.field" :data-severity="issue.severity">
          <a v-if="issue.field" :href="`#${fieldDomId(issueTargetField(issue.field))}`">{{ issue.message }}</a>
          <span v-else>{{ issue.message }}</span>
        </li>
      </ul>
    </aside>

    <section :id="fieldDomId('nodes')" class="editor-section" aria-labelledby="nodes-heading">
      <div class="section-heading"><h4 id="nodes-heading">节点</h4><button type="button" data-add="nodes" @click="addNode">新增节点</button></div>
      <div class="table-scroll"><table><thead><tr><th>ID</th><th v-for="field in nodeNumbers" :key="field.field">{{ field.label }}</th><th>操作</th></tr></thead>
        <tbody><tr v-for="(node, index) in modelValue.nodes" :id="fieldDomId(`nodes[${index}]`)" :key="node.id">
          <td><input :id="fieldDomId(`nodes[${index}].id`)" :value="node.id" :data-field="`nodes[${index}].id`" @input="patchRow('nodes', index, 'id', ($event.target as HTMLInputElement).value)" /></td>
          <td v-for="field in nodeNumbers" :key="field.field"><label><input type="number" :id="fieldDomId(`nodes[${index}].${field.field}`)" :data-field="`nodes[${index}].${field.field}`" :value="displayValue(rawValue(node, field.field), field.quantity)" :aria-invalid="fieldInvalid(`nodes[${index}].${field.field}`)" @input="patchNumericRow('nodes', index, field, $event)" /><span class="unit">{{ unitSymbol(field.quantity) }}</span></label></td>
          <td><button type="button" :data-remove="`nodes[${index}]`" @click="removeRow('nodes', index)">删除</button></td>
        </tr></tbody>
      </table></div>
    </section>

    <section :id="fieldDomId('materials')" class="editor-section" aria-labelledby="materials-heading">
      <div class="section-heading"><h4 id="materials-heading">材料</h4><button type="button" data-add="materials" @click="addMaterial">新增材料</button></div>
      <div class="table-scroll"><table><thead><tr><th>ID</th><th v-for="field in materialNumbers" :key="field.field">{{ field.label }}</th><th>操作</th></tr></thead>
        <tbody><tr v-for="(material, index) in modelValue.materials" :id="fieldDomId(`materials[${index}]`)" :key="material.id">
          <td><input :id="fieldDomId(`materials[${index}].id`)" :value="material.id" :data-field="`materials[${index}].id`" @input="patchRow('materials', index, 'id', ($event.target as HTMLInputElement).value)" /></td>
          <td v-for="field in materialNumbers" :key="field.field"><label><input type="number" :id="fieldDomId(`materials[${index}].${field.field}`)" :data-field="`materials[${index}].${field.field}`" :aria-invalid="fieldInvalid(`materials[${index}].${field.field}`)" :value="displayValue(rawValue(material, field.field), field.quantity)" @input="patchNumericRow('materials', index, field, $event)" /><span class="unit">{{ unitSymbol(field.quantity) }}</span></label></td>
          <td><button type="button" :data-remove="`materials[${index}]`" @click="removeRow('materials', index)">删除</button></td>
        </tr></tbody>
      </table></div>
    </section>

    <section :id="fieldDomId('sections')" class="editor-section" aria-labelledby="sections-heading">
      <div class="section-heading"><h4 id="sections-heading">截面</h4><button type="button" data-add="sections" @click="addSection">新增截面</button></div>
      <div class="table-scroll"><table><thead><tr><th>ID</th><th v-for="field in sectionNumbers" :key="field.field">{{ field.label }}</th><th>操作</th></tr></thead>
        <tbody><tr v-for="(section, index) in modelValue.sections" :id="fieldDomId(`sections[${index}]`)" :key="section.id">
          <td><input :id="fieldDomId(`sections[${index}].id`)" :value="section.id" :data-field="`sections[${index}].id`" @input="patchRow('sections', index, 'id', ($event.target as HTMLInputElement).value)" /></td>
          <td v-for="field in sectionNumbers" :key="field.field"><label><input type="number" :id="fieldDomId(`sections[${index}].${field.field}`)" :data-field="`sections[${index}].${field.field}`" :aria-invalid="fieldInvalid(`sections[${index}].${field.field}`)" :value="displayValue(rawValue(section, field.field), field.quantity)" @input="patchNumericRow('sections', index, field, $event)" /><span class="unit">{{ unitSymbol(field.quantity) }}</span></label></td>
          <td><button type="button" :data-remove="`sections[${index}]`" @click="removeRow('sections', index)">删除</button></td>
        </tr></tbody>
      </table></div>
    </section>

    <section v-if="modelValue.analysis === 'beam'" :id="fieldDomId('uniformProperties')" class="editor-section uniform-properties" aria-labelledby="uniform-properties-heading">
      <div class="section-heading"><h4 id="uniform-properties-heading">梁统一属性</h4></div>
      <label>来源 <select :value="modelValue.uniformProperties.source" data-field="uniformProperties.source" @change="switchUniformPropertySource(($event.target as HTMLSelectElement).value as 'inline' | 'library')"><option value="inline">直接输入</option><option value="library">材料/截面库</option></select></label>
      <div v-if="modelValue.uniformProperties.source === 'library'" class="inline-fields">
        <label>材料 ID <input :id="fieldDomId('uniformProperties.materialId')" :value="modelValue.uniformProperties.materialId" data-field="uniformProperties.materialId" :aria-invalid="fieldInvalid('uniformProperties.materialId')" @input="patchUniformProperty('materialId', ($event.target as HTMLInputElement).value)" /></label>
        <label>截面 ID <input :id="fieldDomId('uniformProperties.sectionId')" :value="modelValue.uniformProperties.sectionId" data-field="uniformProperties.sectionId" :aria-invalid="fieldInvalid('uniformProperties.sectionId')" @input="patchUniformProperty('sectionId', ($event.target as HTMLInputElement).value)" /></label>
      </div>
      <div v-else class="inline-fields">
        <label v-for="field in [...materialNumbers, ...sectionNumbers]" :key="field.field">{{ field.label }} <input type="number" :id="fieldDomId(`uniformProperties.${field.field}`)" :data-field="`uniformProperties.${field.field}`" :aria-invalid="fieldInvalid(`uniformProperties.${field.field}`) || fieldInvalid(`elements[0].${field.field}`)" :value="displayValue(rawValue(modelValue.uniformProperties, field.field), field.quantity)" @input="patchUniformProperty(field.field, valueFromEvent($event, field.quantity, field.optional))" /><span class="unit">{{ unitSymbol(field.quantity) }}</span></label>
      </div>
    </section>

    <section :id="fieldDomId('elements')" class="editor-section" aria-labelledby="elements-heading">
      <div class="section-heading"><h4 id="elements-heading">单元</h4><button type="button" data-add="elements" @click="addElement">新增单元</button></div>
      <div class="card-list"><article v-for="(element, index) in modelValue.elements" :id="fieldDomId(`elements[${index}]`)" :key="element.id" class="editor-card" :data-row="`elements[${index}]`">
        <div class="inline-fields"><label>ID <input :id="fieldDomId(`elements[${index}].id`)" :value="element.id" :data-field="`elements[${index}].id`" @input="patchRow('elements', index, 'id', ($event.target as HTMLInputElement).value)" /></label><label>i 节点 <input :id="fieldDomId(`elements[${index}].nodeI`)" :value="element.nodeI" :data-field="`elements[${index}].nodeI`" @input="patchRow('elements', index, 'nodeI', ($event.target as HTMLInputElement).value)" /></label><label>j 节点 <input :id="fieldDomId(`elements[${index}].nodeJ`)" :value="element.nodeJ" :data-field="`elements[${index}].nodeJ`" @input="patchRow('elements', index, 'nodeJ', ($event.target as HTMLInputElement).value)" /></label></div>
        <template v-if="element.type !== 'beam' && propertyOf(element)">
          <label>属性来源 <select :value="propertyOf(element)!.source" :data-field="`elements[${index}].properties.source`" @change="switchElementPropertySource(index, ($event.target as HTMLSelectElement).value as 'inline' | 'library')"><option value="inline">直接输入</option><option value="library">材料/截面库</option></select></label>
          <div v-if="propertyOf(element)!.source === 'library'" class="inline-fields">
            <label>材料 ID <input :id="fieldDomId(`elements[${index}].properties.materialId`)" :value="(propertyOf(element) as Extract<PropertySource, { source: 'library' }>).materialId" :data-field="`elements[${index}].properties.materialId`" :aria-invalid="fieldInvalid(`elements[${index}].properties.materialId`)" @input="patchElementProperty(index, 'materialId', ($event.target as HTMLInputElement).value)" /></label>
            <label>截面 ID <input :id="fieldDomId(`elements[${index}].properties.sectionId`)" :value="(propertyOf(element) as Extract<PropertySource, { source: 'library' }>).sectionId" :data-field="`elements[${index}].properties.sectionId`" :aria-invalid="fieldInvalid(`elements[${index}].properties.sectionId`)" @input="patchElementProperty(index, 'sectionId', ($event.target as HTMLInputElement).value)" /></label>
          </div>
          <div v-else class="inline-fields">
            <label v-for="field in [...materialNumbers, ...sectionNumbers].filter(({ field }) => element.type === 'frame' || ['E', 'A', 'alpha', 'density'].includes(field))" :key="field.field">{{ field.label }} <input type="number" :id="fieldDomId(`elements[${index}].properties.${field.field}`)" :data-field="`elements[${index}].properties.${field.field}`" :aria-invalid="fieldInvalid(`elements[${index}].properties.${field.field}`)" :value="displayValue(rawValue(propertyOf(element)!, field.field), field.quantity)" @input="patchElementPropertyNumber(index, field, $event)" /><span class="unit">{{ unitSymbol(field.quantity) }}</span></label>
          </div>
        </template>
        <button type="button" :data-remove="`elements[${index}]`" @click="removeRow('elements', index)">删除单元</button>
      </article></div>
    </section>

    <section :id="fieldDomId('constraints')" class="editor-section" aria-labelledby="constraints-heading">
      <div class="section-heading"><h4 id="constraints-heading">约束</h4><button type="button" data-add="constraints" @click="addConstraint">新增约束</button></div>
      <div class="card-list"><article v-for="(constraint, index) in modelValue.constraints" :id="fieldDomId(`constraints[${index}]`)" :key="`${constraint.nodeId}-${constraint.dof}-${index}`" class="editor-card"><label>节点 <input :id="fieldDomId(`constraints[${index}].nodeId`)" :value="constraint.nodeId" :data-field="`constraints[${index}].nodeId`" @input="patchRow('constraints', index, 'nodeId', ($event.target as HTMLInputElement).value)" /></label><label>DOF <select :value="constraint.dof" :data-field="`constraints[${index}].dof`" @change="patchRow('constraints', index, 'dof', ($event.target as HTMLSelectElement).value)"><option value="u">u</option><option value="v">v</option><option v-if="modelValue.analysis !== 'truss'" value="theta">θ</option></select></label><span class="constraint-value">指定值 = 0 {{ unitSymbol(constraint.dof === 'theta' ? 'rotation' : 'displacement') }}</span><button type="button" :data-remove="`constraints[${index}]`" @click="removeRow('constraints', index)">删除</button></article></div>
    </section>

    <section :id="fieldDomId('loads')" class="editor-section" aria-labelledby="loads-heading">
      <div class="section-heading"><h4 id="loads-heading">荷载</h4><div class="add-loads"><button v-for="type in loadTypeOptions" :key="type" type="button" :data-add-load="type" @click="addLoad(type)">新增{{ loadTypeLabels[type] }}</button></div></div>
      <div class="card-list"><article v-for="(load, index) in modelValue.loads" :id="fieldDomId(`loads[${index}]`)" :key="load.id" class="editor-card load-card" :data-load-type="load.type">
        <div class="inline-fields"><label>ID <input :id="fieldDomId(`loads[${index}].id`)" :value="load.id" :data-field="`loads[${index}].id`" @input="patchRow('loads', index, 'id', ($event.target as HTMLInputElement).value)" /></label><label>类型 <select :value="load.type" :data-field="`loads[${index}].type`" @change="switchLoadType(index, ($event.target as HTMLSelectElement).value as StructuralLoad['type'])"><option v-for="type in loadTypeOptions" :key="type" :value="type">{{ loadTypeLabels[type] }}</option></select></label></div>
        <label v-if="load.type === 'nodal'">节点 ID <input :value="load.nodeId" :data-field="`loads[${index}].nodeId`" @input="patchRow('loads', index, 'nodeId', ($event.target as HTMLInputElement).value)" /></label>
        <label v-else>单元 ID <input :value="load.elementId" :data-field="`loads[${index}].elementId`" @input="patchRow('loads', index, 'elementId', ($event.target as HTMLInputElement).value)" /></label>
        <div v-if="load.type === 'nodal'" class="inline-fields">
          <label>Fx <input type="number" :data-field="`loads[${index}].fx`" :value="displayValue('fx' in load ? load.fx : undefined, 'force')" @input="patchLoadNumber(index, 'fx', 'force', $event, true)" /><span class="unit">{{ unitSymbol('force') }}</span></label>
          <label>Fy <input type="number" :data-field="`loads[${index}].fy`" :value="displayValue('fy' in load ? load.fy : undefined, 'force')" @input="patchLoadNumber(index, 'fy', 'force', $event, true)" /><span class="unit">{{ unitSymbol('force') }}</span></label>
          <label v-if="modelValue.analysis !== 'truss'">Mz <input type="number" :data-field="`loads[${index}].mz`" :value="displayValue('mz' in load ? load.mz : undefined, 'moment')" @input="patchLoadNumber(index, 'mz', 'moment', $event, true)" /><span class="unit">{{ unitSymbol('moment') }}</span></label>
        </div>
        <label v-else-if="load.type === 'beam-uniform'">qY <input type="number" :data-field="`loads[${index}].qY`" :value="displayValue(load.qY, 'lineLoad')" @input="patchLoadNumber(index, 'qY', 'lineLoad', $event)" /><span class="unit">{{ unitSymbol('lineLoad') }}</span></label>
        <template v-else-if="load.type === 'frame-uniform'">
          <div class="inline-fields"><label>qX <input type="number" :data-field="`loads[${index}].qX`" :value="displayValue(load.qX, 'lineLoad')" @input="patchLoadNumber(index, 'qX', 'lineLoad', $event, true)" /><span class="unit">{{ unitSymbol('lineLoad') }}</span></label><label>qY <input type="number" :data-field="`loads[${index}].qY`" :value="displayValue(load.qY, 'lineLoad')" @input="patchLoadNumber(index, 'qY', 'lineLoad', $event, true)" /><span class="unit">{{ unitSymbol('lineLoad') }}</span></label></div>
          <label><input type="checkbox" :checked="Boolean(load.interval)" @change="toggleLoadInterval(index, ($event.target as HTMLInputElement).checked)" />区间荷载</label>
          <div v-if="load.interval" class="inline-fields"><label>a <input type="number" :data-field="`loads[${index}].interval.a`" :value="displayValue(load.interval.a, 'length')" @input="patchLoadInterval(index, 'a', $event)" /><span class="unit">{{ unitSymbol('length') }}</span></label><label>b <input type="number" :data-field="`loads[${index}].interval.b`" :value="displayValue(load.interval.b, 'length')" @input="patchLoadInterval(index, 'b', $event)" /><span class="unit">{{ unitSymbol('length') }}</span></label></div>
        </template>
        <label v-else-if="load.type === 'uniform-temperature'">ΔT <input type="number" :data-field="`loads[${index}].deltaT`" :value="displayValue(load.deltaT, 'temperatureDifference')" @input="patchLoadNumber(index, 'deltaT', 'temperatureDifference', $event)" /><span class="unit">{{ unitSymbol('temperatureDifference') }}</span></label>
        <label v-else-if="load.type === 'initial-strain'">ε₀ <input type="number" :data-field="`loads[${index}].strain`" :value="displayValue(load.strain, 'strain')" @input="patchLoadNumber(index, 'strain', 'strain', $event)" /><span class="unit">{{ unitSymbol('strain') }}</span></label>
        <label v-else>g <input type="number" :id="fieldDomId(`loads[${index}].gravity`)" :data-field="`loads[${index}].gravity`" :aria-invalid="fieldInvalid(`loads[${index}].gravity`)" :value="displayValue(load.gravity, 'acceleration')" @input="patchLoadNumber(index, 'gravity', 'acceleration', $event)" /><span class="unit">{{ unitSymbol('acceleration') }}</span></label>
        <button type="button" :data-remove="`loads[${index}]`" @click="removeRow('loads', index)">删除荷载</button>
      </article></div>
    </section>
  </form>
</template>

<style scoped>
.structural-model-editor { min-width: 0; display: grid; gap: 16px; }
.editor-header, .section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.editor-header h3, .section-heading h4 { margin: 0; }
.editor-header p { margin: 4px 0 0; color: var(--color-muted); font-size: 12px; }
.preset-indicator { padding: 5px 9px; border-radius: 999px; background: #edf7f7; color: var(--color-brand); font-weight: 750; }
.issue-summary { padding: 12px 14px; border: 1px solid #e1b8ad; border-radius: 8px; background: #fff5f1; }
.issue-summary ul { margin: 7px 0 0; padding-left: 20px; }
.issue-summary [data-severity="error"] { color: #9b392b; }
.editor-section { min-width: 0; padding: 14px; border: 1px solid var(--color-line); border-radius: 9px; background: var(--color-panel); }
.section-heading { margin-bottom: 10px; }
.table-scroll { width: 100%; overflow-x: auto; }
table { width: 100%; min-width: 680px; border-collapse: collapse; }
th, td { padding: 7px; border-bottom: 1px solid var(--color-line); text-align: left; vertical-align: top; }
.card-list { display: grid; gap: 9px; }
.editor-card { display: grid; gap: 9px; padding: 10px; border: 1px solid #d8e2e4; border-radius: 7px; }
.inline-fields, .add-loads { display: flex; flex-wrap: wrap; gap: 9px; align-items: end; }
label { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 650; }
input, select, button { font: inherit; }
input, select { min-width: 90px; max-width: 180px; padding: 5px 7px; border: 1px solid #b9c9ce; border-radius: 5px; }
input[aria-invalid="true"] { border-color: #b64835; outline: 1px solid #b64835; }
button { padding: 5px 9px; border: 1px solid #a9bec3; border-radius: 6px; color: #174f58; background: #f5fafa; cursor: pointer; }
.unit { flex: 0 0 auto; color: #6b7d84; font-size: 11px; }
@media (max-width: 700px) {
  .editor-header, .section-heading { flex-direction: column; }
  .editor-section { padding: 10px; }
}
</style>
