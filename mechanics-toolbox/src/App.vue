<script setup lang="ts">
import { computed, ref } from 'vue'
import AxialCalculator from './features/axial/AxialCalculator.vue'
import MaterialPresetEditor from './features/materials/MaterialPresetEditor.vue'
import BeamCalculator from './features/beam/BeamCalculator.vue'
import BucklingCalculator from './features/buckling/BucklingCalculator.vue'
import SectionCalculator from './features/sections/SectionCalculator.vue'
import StressCalculator from './features/stress/StressCalculator.vue'
import TorsionCalculator from './features/torsion/TorsionCalculator.vue'
import UnitConverter from './features/unit-converter/UnitConverter.vue'
import { ThinCylinderCalculator } from './features/plate-shell/thin-cylinder'
import { LameCylinderCalculator } from './features/plate-shell/lame-cylinder'

type ViewId = 'sections' | 'units' | 'beam' | 'axial' | 'torsion' | 'stress' | 'buckling'
  | 'thin-cylinder'
  | 'lame-cylinder'

const activeView = ref<ViewId>('sections')

const navigation = [
  { index: '01', id: 'sections', label: '截面性质', status: '可用' },
  { index: '02', id: 'units', label: '单位换算', status: '可用' },
  { index: '03', id: 'beam', label: '梁综合计算', status: '可用' },
  { index: '04', id: 'axial', label: '轴向与温变', status: '可用' },
  { index: '05', id: 'torsion', label: '圆轴扭转', status: '可用' },
  { index: '06', id: 'stress', label: '应力与莫尔圆', status: '可用' },
  { index: '07', id: 'buckling', label: '压杆稳定', status: '可用' },
  { index: '08', id: 'thin-cylinder', label: '薄壁圆筒', status: 'P3' },
  { index: '09', id: 'lame-cylinder', label: '厚壁圆筒', status: 'P3' },
] as const

const pageTitle = computed(() => ({
  sections: '截面性质工作台',
  units: '常用单位换算',
  beam: '梁综合计算工作台',
  axial: '轴向拉压与温度变形',
  torsion: '圆轴扭转与功率换算',
  stress: '平面应力与强度准则',
  buckling: '欧拉压杆稳定工作台',
  'thin-cylinder': '薄壁圆筒膜应力工作台',
  'lame-cylinder': '厚壁圆筒 Lamé 解工作台',
})[activeView.value])

const phaseLabel = computed(() => ['thin-cylinder', 'lame-cylinder'].includes(activeView.value)
  ? 'P3 / 板壳力学'
  : 'P1 / 材料力学')

function selectView(id: ViewId | null): void {
  if (id) activeView.value = id
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

      <p class="nav-caption">P1 材料力学 · P3 板壳力学</p>
      <nav class="nav-list">
        <button
          v-for="item in navigation"
          :key="item.index"
          class="nav-item"
          :class="{ 'is-active': item.id === activeView }"
          type="button"
          :disabled="item.id === null"
          :aria-current="item.id === activeView ? 'page' : undefined"
          @click="selectView(item.id)"
        >
          <span class="nav-index">{{ item.index }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-status">{{ item.status }}</span>
        </button>
      </nav>

      <div class="sidebar-note">
        本地离线运行<br />
        计算前检查输入单位与适用假设
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <p class="breadcrumb">{{ phaseLabel }}</p>
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <div class="offline-badge" aria-label="离线可用">
          <span class="offline-dot" aria-hidden="true"></span>
          离线可用
        </div>
      </header>

      <div v-if="activeView === 'sections'" class="workspace-intro">
        <div>
          <span>首款综合计算器 · 第一轮</span>
          <p>截面模块已可独立验证；材料参数已准备供后续梁应力与挠度计算调用。</p>
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
      <LameCylinderCalculator v-else />
    </main>
  </div>
</template>
