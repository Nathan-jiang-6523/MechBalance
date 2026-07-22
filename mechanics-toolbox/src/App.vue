<script setup lang="ts">
import { computed, ref } from 'vue'
import AxialCalculator from './features/axial/AxialCalculator.vue'
import MaterialPresetEditor from './features/materials/MaterialPresetEditor.vue'
import BeamCalculator from './features/beam/BeamCalculator.vue'
import BucklingCalculator from './features/buckling/BucklingCalculator.vue'
import SectionCalculator from './features/sections/SectionCalculator.vue'
import StressCalculator from './features/stress/StressCalculator.vue'
import StructuralCalculator from './features/structural/StructuralCalculator.vue'
import TorsionCalculator from './features/torsion/TorsionCalculator.vue'
import UnitConverter from './features/unit-converter/UnitConverter.vue'
import { ThinCylinderCalculator } from './features/plate-shell/thin-cylinder'
import { LameCylinderCalculator } from './features/plate-shell/lame-cylinder'
import { CircularPlateCalculator } from './features/plate-shell/circular-plate'
import { RectangularPlateCalculator } from './features/plate-shell/rectangular-plate'
import { BucklingCalculator as PlateShellBucklingCalculator } from './features/plate-shell/buckling'

type ModuleId = 'section' | 'plate-shell' | 'structural'
type AvailableStructuralModuleId = 'beam' | 'influence-line' | 'moving-load' | 'truss' | 'frame'
type ViewId =
  | 'sections'
  | 'units'
  | 'beam'
  | 'axial'
  | 'torsion'
  | 'stress'
  | 'buckling'
  | 'thin-cylinder'
  | 'lame-cylinder'
  | 'circular-plate'
  | 'rectangular-plate'
  | 'plate-shell-buckling'
  | 'structural-beam'
  | 'structural-influence-line'
  | 'structural-moving-load'
  | 'structural-truss'
  | 'structural-frame'

interface NavigationItem {
  index: string
  id: ViewId
  label: string
  status: string
  moduleId?: AvailableStructuralModuleId
}

const modules: ReadonlyArray<{
  id: ModuleId
  index: string
  title: string
  phase: string
  description: string
}> = [
  {
    id: 'section',
    index: '01',
    title: '截面信息计算',
    phase: 'P1 · 材料力学',
    description: '截面性质、梁、轴向、扭转、应力与稳定计算',
  },
  {
    id: 'plate-shell',
    index: '02',
    title: '板壳力学计算',
    phase: 'P3 · 板壳力学',
    description: '薄壁与厚壁圆筒、圆板、矩形板及屈曲计算',
  },
  {
    id: 'structural',
    index: '03',
    title: '结构力学计算',
    phase: 'P2 · 结构力学',
    description: '梁、桁架、刚架、影响线与移动荷载分析',
  },
]

const navigationByModule: Record<ModuleId, ReadonlyArray<NavigationItem>> = {
  section: [
    { index: '01', id: 'sections', label: '截面性质', status: '可用' },
    { index: '02', id: 'units', label: '单位换算', status: '可用' },
    { index: '03', id: 'beam', label: '梁综合计算', status: '可用' },
    { index: '04', id: 'axial', label: '轴向与温变', status: '可用' },
    { index: '05', id: 'torsion', label: '圆轴扭转', status: '可用' },
    { index: '06', id: 'stress', label: '应力与莫尔圆', status: '可用' },
    { index: '07', id: 'buckling', label: '压杆稳定', status: '可用' },
  ],
  'plate-shell': [
    { index: '01', id: 'thin-cylinder', label: '薄壁圆筒', status: '可用' },
    { index: '02', id: 'lame-cylinder', label: '厚壁圆筒', status: '可用' },
    { index: '03', id: 'circular-plate', label: '圆板弯曲', status: '可用' },
    { index: '04', id: 'rectangular-plate', label: '矩形板弯曲', status: '可用' },
    { index: '05', id: 'plate-shell-buckling', label: '板壳屈曲', status: '可用' },
  ],
  structural: [
    { index: '01', id: 'structural-beam', label: '1D 梁', status: '可用', moduleId: 'beam' },
    { index: '02', id: 'structural-influence-line', label: '影响线', status: '可用', moduleId: 'influence-line' },
    { index: '03', id: 'structural-moving-load', label: '移动荷载', status: '可用', moduleId: 'moving-load' },
    { index: '04', id: 'structural-truss', label: '平面桁架', status: '可用', moduleId: 'truss' },
    { index: '05', id: 'structural-frame', label: '平面刚架', status: '可用', moduleId: 'frame' },
  ],
}

const defaultViewByModule: Record<ModuleId, ViewId> = {
  section: 'sections',
  'plate-shell': 'thin-cylinder',
  structural: 'structural-beam',
}

const pageMeta: Record<ViewId, { title: string; breadcrumb: string }> = {
  sections: { title: '截面性质工作台', breadcrumb: '截面信息计算 / 截面性质' },
  units: { title: '常用单位换算', breadcrumb: '截面信息计算 / 单位换算' },
  beam: { title: '梁综合计算工作台', breadcrumb: '截面信息计算 / 梁综合计算' },
  axial: { title: '轴向拉压与温度变形', breadcrumb: '截面信息计算 / 轴向与温变' },
  torsion: { title: '圆轴扭转与功率换算', breadcrumb: '截面信息计算 / 圆轴扭转' },
  stress: { title: '平面应力与强度准则', breadcrumb: '截面信息计算 / 应力与莫尔圆' },
  buckling: { title: '欧拉压杆稳定工作台', breadcrumb: '截面信息计算 / 压杆稳定' },
  'thin-cylinder': { title: '薄壁圆筒膜应力工作台', breadcrumb: '板壳力学计算 / 薄壁圆筒' },
  'lame-cylinder': { title: '厚壁圆筒 Lamé 解工作台', breadcrumb: '板壳力学计算 / 厚壁圆筒' },
  'circular-plate': { title: '圆板轴对称弯曲工作台', breadcrumb: '板壳力学计算 / 圆板弯曲' },
  'rectangular-plate': { title: '矩形薄板弯曲工作台', breadcrumb: '板壳力学计算 / 矩形板弯曲' },
  'plate-shell-buckling': { title: '板与圆柱壳屈曲初算工作台', breadcrumb: '板壳力学计算 / 板壳屈曲' },
  'structural-beam': { title: '1D 梁分析工作台', breadcrumb: '结构力学计算 / 1D 梁' },
  'structural-influence-line': { title: '影响线分析工作台', breadcrumb: '结构力学计算 / 影响线' },
  'structural-moving-load': { title: '移动荷载分析工作台', breadcrumb: '结构力学计算 / 移动荷载' },
  'structural-truss': { title: '平面桁架分析工作台', breadcrumb: '结构力学计算 / 平面桁架' },
  'structural-frame': { title: '平面刚架分析工作台', breadcrumb: '结构力学计算 / 平面刚架' },
}

const activeModule = ref<ModuleId>('section')
const activeView = ref<ViewId>('sections')
const currentNavigation = computed(() => navigationByModule[activeModule.value])
const currentPage = computed(() => pageMeta[activeView.value])
const activeStructuralModule = computed<AvailableStructuralModuleId>(() => {
  const item = navigationByModule.structural.find(({ id }) => id === activeView.value)
  return item?.moduleId ?? 'beam'
})

function selectModule(id: ModuleId): void {
  activeModule.value = id
  activeView.value = defaultViewByModule[id]
}

function selectView(id: ViewId): void {
  activeView.value = id
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="计算器导航">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">M</div>
        <div>
          <p class="brand-title">力学工具箱</p>
          <p class="brand-subtitle">Mechanics Toolbox</p>
        </div>
      </div>

      <p class="nav-caption">{{ modules.find((module) => module.id === activeModule)?.title }}</p>
      <nav class="nav-list" aria-label="当前模块计算器">
        <button
          v-for="item in currentNavigation"
          :key="item.id"
          class="nav-item"
          :class="{ 'is-active': item.id === activeView }"
          type="button"
          :aria-current="item.id === activeView ? 'page' : undefined"
          :data-module-id="item.moduleId"
          @click="selectView(item.id)"
        >
          <span class="nav-index">{{ item.index }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-status">{{ item.status }}</span>
        </button>
      </nav>

      <div class="sidebar-note">
        本地离线运行<br />
        机械设计 Excel 工具已从此分支分离
      </div>
    </aside>

    <main class="workspace">
      <section class="module-grid" aria-label="三大力学计算模块">
        <button
          v-for="module in modules"
          :key="module.id"
          class="module-card"
          :class="{ 'is-active': module.id === activeModule }"
          type="button"
          :aria-pressed="module.id === activeModule"
          @click="selectModule(module.id)"
        >
          <span class="module-index">{{ module.index }}</span>
          <span class="module-phase">{{ module.phase }}</span>
          <strong>{{ module.title }}</strong>
          <small>{{ module.description }}</small>
        </button>
      </section>

      <header class="topbar">
        <div>
          <p class="breadcrumb">{{ currentPage.breadcrumb }}</p>
          <h1 class="page-title">{{ currentPage.title }}</h1>
        </div>
        <div class="offline-badge" aria-label="离线可用">
          <span class="offline-dot" aria-hidden="true"></span>
          离线可用
        </div>
      </header>

      <div v-if="activeView === 'sections'" class="workspace-intro">
        <div>
          <span>截面与材料力学基础</span>
          <p>截面模块可独立验证，计算结果可用于后续梁应力与挠度分析。</p>
        </div>
        <strong>默认单位：mm · N · MPa</strong>
      </div>

      <div v-if="activeView === 'sections'" class="feature-stack">
        <SectionCalculator />
        <MaterialPresetEditor />
      </div>
      <UnitConverter v-else-if="activeView === 'units'" />
      <BeamCalculator v-else-if="activeView === 'beam'" />
      <AxialCalculator v-else-if="activeView === 'axial'" />
      <TorsionCalculator v-else-if="activeView === 'torsion'" />
      <StressCalculator v-else-if="activeView === 'stress'" />
      <BucklingCalculator v-else-if="activeView === 'buckling'" />
      <ThinCylinderCalculator v-else-if="activeView === 'thin-cylinder'" />
      <LameCylinderCalculator v-else-if="activeView === 'lame-cylinder'" />
      <CircularPlateCalculator v-else-if="activeView === 'circular-plate'" />
      <RectangularPlateCalculator v-else-if="activeView === 'rectangular-plate'" />
      <PlateShellBucklingCalculator v-else-if="activeView === 'plate-shell-buckling'" />
      <StructuralCalculator v-else :module-id="activeStructuralModule" />
    </main>
  </div>
</template>
