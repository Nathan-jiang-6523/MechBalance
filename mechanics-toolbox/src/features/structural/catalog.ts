import type {
  StructuralModuleDescriptor,
  StructuralModuleId,
  StructuralTheoryContent,
} from './types'

export const STRUCTURAL_STATUS_LABELS = {
  available: 'available · 可用',
  beta: 'beta · 试用',
  planned: 'planned · 计划中',
} as const

export const STRUCTURAL_MODULES = [
  {
    id: 'beam', index: '01', title: '1D 梁', status: 'available',
    summary: '含 u/v/θ、等属性单跨梁与已确认超静定边界。',
  },
  {
    id: 'influence-line', index: '02', title: '影响线', status: 'available',
    summary: '简支梁反力、指定截面剪力/弯矩与位移影响线。',
  },
  {
    id: 'moving-load', index: '03', title: '移动荷载', status: 'available',
    summary: '单轴组、单方向、动态系数及解析控制位置。',
  },
  {
    id: 'truss', index: '04', title: '平面桁架', status: 'available',
    summary: '节点力、均匀温差、初应变和杆件自重。',
  },
  {
    id: 'frame', index: '05', title: '平面刚架', status: 'available',
    summary: '节点作用、局部分布载荷、温度和初应变。',
  },
  {
    id: 'advanced-beam', index: '06', title: '多跨/铰接梁', status: 'planned',
    summary: '分段变属性、连续多跨、内部铰与端释放不在 P2 首版。',
  },
  {
    id: 'spatial-structure', index: '07', title: '三维结构', status: 'planned',
    summary: '3D 桁架与空间刚架后置；P2 数据结构仅覆盖 2D。',
  },
] as const satisfies readonly StructuralModuleDescriptor[]

export const STRUCTURAL_THEORY_CATALOG: Readonly<
  Partial<Record<StructuralModuleId, StructuralTheoryContent>>
> = {
  beam: {
    title: '1D 梁理论',
    formulas: [
      {
        id: 'P2-EB-001', label: 'Euler–Bernoulli 梁单元刚度', version: 'P2-EB6-v1',
        latex: String.raw`\boldsymbol{k}_e=\int_0^L \boldsymbol{B}^{\mathsf T}\boldsymbol{D}\boldsymbol{B}\,\mathrm dx`,
      },
      {
        id: 'P2-EB-002', label: '全跨常值荷载一致节点化', version: 'P2-EB-LOAD-v1',
        latex: String.raw`\boldsymbol{f}_e^{eq}=\int_0^L\boldsymbol{N}^{\mathsf T}q_y\,\mathrm dx`,
      },
      {
        id: 'P2-DSM-001', label: '直接刚度法装配与约束求解', version: 'P2-DSM-v1',
        latex: String.raw`\boldsymbol{K}_{ff}\boldsymbol{d}_f=\boldsymbol{F}_f-\boldsymbol{K}_{fc}\boldsymbol{d}_c`,
      },
      {
        id: 'P2-EB-RECOVERY-001', label: '梁位移与内力场恢复', version: 'P2-EB-RECOVERY-v1',
        latex: String.raw`N=EAu',\quad M=EIv'',\quad V=M'`,
      },
      {
        id: 'P2-CBEAM-001', label: '等属性单跨超静定梁约束', version: 'P2-CBEAM-v1',
        latex: String.raw`\boldsymbol{R}=\boldsymbol{K}\boldsymbol{d}-\boldsymbol{F}`,
      },
    ],
    assumptions: ['二维、小变形、线弹性 Euler–Bernoulli 梁。', '节点自由度从首阶段固定为 u、v、θ。'],
    boundaries: ['只支持等 E/A/I 单跨链式网格。', '连续多跨、内部铰与端释放不在 P2 首版。'],
    mixedUnitNotes: ['刚度矩阵平移—平移项为 N/m，平移—转动项为 N，转动—转动项为 N·m。'],
  },
  'influence-line': {
    title: '影响线理论',
    formulas: [{
      id: 'P2-IL-001', label: '简支梁左支反力影响线', version: 'P2-IL-v1',
      latex: String.raw`\eta_{R_A}(z)=1-\frac{z}{L}`,
    }],
    assumptions: ['单位竖向移动荷载；简支梁线性响应。'],
    boundaries: ['剪力影响线在目标截面保留左、右极限。', '首版不支持连续梁或框架影响线。'],
    mixedUnitNotes: ['反力/剪力纵坐标为 1，弯矩纵坐标为 m，位移纵坐标为 m/N。'],
  },
  'moving-load': {
    title: '移动荷载理论',
    formulas: [
      {
        id: 'P2-IL-001', label: '简支梁影响线纵坐标', version: 'P2-IL-v1',
        latex: String.raw`\eta_{R_A}(z)=1-\frac{z}{L}`,
      },
      {
        id: 'P2-ML-001', label: '轴组影响线叠加', version: 'P2-ML-v1',
        latex: String.raw`R(z)=\sum_i \varphi P_i\,\eta(z_i)`,
      },
    ],
    assumptions: ['单轴组、单行进方向、线性静力包络。'],
    boundaries: ['动态系数 φ 必须为有限正值。', '不输出多车道组合或未确认的完整历程。'],
    mixedUnitNotes: ['动力系数为 1；响应按目标分别使用 N、N·m 或 m。'],
  },
  truss: {
    title: '平面桁架理论',
    formulas: [
      {
        id: 'P2-DSM-001', label: '直接刚度法装配与约束求解', version: 'P2-DSM-v1',
        latex: String.raw`\boldsymbol{K}=\sum_e\boldsymbol{A}_e^{\mathsf T}\boldsymbol{k}_e\boldsymbol{A}_e`,
      },
      {
        id: 'P2-TRUSS-001', label: '杆件刚度与轴力', version: 'P2-TRUSS-v1',
        latex: String.raw`N=EA\left(\frac{u_j^l-u_i^l}{L}-\varepsilon_{free}\right)`,
      },
      {
        id: 'P2-TRUSS-INITIAL-001', label: '桁架自由应变与自重节点化', version: 'P2-TRUSS-INITIAL-v1',
        latex: String.raw`\varepsilon_{free}=\alpha\Delta T+\varepsilon_0,\quad W=\rho ALg`,
      },
    ],
    assumptions: ['二维铰接杆、小变形、线弹性；杆件只承受轴力。'],
    boundaries: ['均匀温差不含截面温度梯度。', '自重节点化后不恢复杆件横向内力。'],
    mixedUnitNotes: ['位移为 m，轴力为 N，应力为 Pa；应变与影响系数为 1。'],
  },
  frame: {
    title: '平面刚架理论',
    formulas: [
      {
        id: 'P2-EB-001', label: '梁柱局部刚度', version: 'P2-EB6-v1',
        latex: String.raw`\boldsymbol{k}_l=\boldsymbol{k}_{EA}\oplus\boldsymbol{k}_{EI}`,
      },
      {
        id: 'P2-DSM-001', label: '直接刚度法装配与约束求解', version: 'P2-DSM-v1',
        latex: String.raw`\boldsymbol{K}\boldsymbol{d}=\boldsymbol{F}`,
      },
      {
        id: 'P2-FRAME-001', label: '局部—全局刚度与荷载变换', version: 'P2-FRAME-v1',
        latex: String.raw`\boldsymbol{k}_g=\boldsymbol{T}^{\mathsf T}\boldsymbol{k}_l\boldsymbol{T},\quad \boldsymbol{f}_e=\int_a^b\boldsymbol{N}^{\mathsf T}\boldsymbol{q}\,\mathrm dx`,
      },
      {
        id: 'P2-FRAME-INITIAL-001', label: '刚架均匀温度与初应变', version: 'P2-FRAME-INITIAL-v1',
        latex: String.raw`\varepsilon_{free}=\alpha\Delta T+\varepsilon_0,\quad N=EA(\varepsilon-\varepsilon_{free})`,
      },
    ],
    assumptions: ['二维、小变形、线弹性 Euler–Bernoulli 梁柱。', '局部轴 +x_l 固定为节点 i 指向节点 j。'],
    boundaries: ['分布载荷只支持局部 qx/qy 全跨或区间常值。', '不含端释放、温度梯度、热弯曲或初曲率。'],
    mixedUnitNotes: ['局部端力顺序为 Fx、Fy、Mz；矩阵项按平移/转动 DOF 使用不同量纲。'],
  },
}
