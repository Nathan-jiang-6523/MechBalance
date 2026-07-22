/** P2 结构内核只接收 SI 数值；UI 单位换算不得进入这些契约。 */
export const STRUCTURAL_INPUT_UNITS = 'SI' as const

/** Dense-matrix first-version hard limits frozen at Gate P2-0. */
export const STRUCTURAL_MODEL_LIMITS = {
  nodes: 100,
  elements: 200,
  freeDofs: 300,
} as const

export type StructuralInputUnits = typeof STRUCTURAL_INPUT_UNITS
export type NodeId = string
export type ElementId = string
export type MaterialId = string
export type SectionId = string
export type LoadId = string

/** 同类对象 ID 必须在所属模型内唯一。坐标单位：m。 */
export interface StructuralNode2D {
  readonly id: NodeId
  readonly x: number
  readonly y: number
}

/** E: Pa；alpha: 1/K；density: kg/m^3。 */
export interface StructuralMaterial {
  readonly id: MaterialId
  readonly E: number
  readonly alpha?: number
  readonly density?: number
}

/** A: m^2；I: m^4；extremeFiberY: m。桁架可省略 I。 */
export interface StructuralSection {
  readonly id: SectionId
  readonly A: number
  readonly I?: number
  readonly extremeFiberY?: number
}

export interface LibraryPropertySource {
  readonly source: 'library'
  readonly materialId: MaterialId
  readonly sectionId: SectionId
}

/** E: Pa；A: m^2；I: m^4；alpha: 1/K；density: kg/m^3。 */
export interface InlineBeamProperties {
  readonly source: 'inline'
  readonly E: number
  readonly A: number
  readonly I: number
  readonly alpha?: number
  readonly density?: number
  readonly extremeFiberY?: number
}

export interface InlineTrussProperties {
  readonly source: 'inline'
  readonly E: number
  readonly A: number
  readonly alpha?: number
  readonly density?: number
}

export type BeamPropertySource = LibraryPropertySource | InlineBeamProperties
export type TrussPropertySource = LibraryPropertySource | InlineTrussProperties

export interface BeamElement2D {
  readonly type: 'beam'
  readonly id: ElementId
  readonly nodeI: NodeId
  readonly nodeJ: NodeId
  /** P2 accepts these request flags only to reject them explicitly. */
  readonly releaseIMz?: boolean
  readonly releaseJMz?: boolean
}

export interface TrussElement2D {
  readonly type: 'truss'
  readonly id: ElementId
  readonly nodeI: NodeId
  readonly nodeJ: NodeId
  readonly properties: TrussPropertySource
}

export interface FrameElement2D {
  readonly type: 'frame'
  readonly id: ElementId
  readonly nodeI: NodeId
  readonly nodeJ: NodeId
  readonly properties: BeamPropertySource
  /** P2 accepts release requests only to reject them explicitly. */
  readonly releaseIMz?: boolean
  readonly releaseJMz?: boolean
  readonly internalHinge?: boolean
  readonly nodeIRotationReleased?: boolean
  readonly nodeJRotationReleased?: boolean
}

export type StructuralElement2D = BeamElement2D | TrussElement2D | FrameElement2D
export type BeamDof = 'u' | 'v' | 'theta'
export type TrussDof = 'u' | 'v'

/** P2 首版只支持零位移约束；非零指定位移后置。 */
export interface ZeroConstraint<Dof extends BeamDof = BeamDof> {
  readonly nodeId: NodeId
  readonly dof: Dof
  readonly value: 0
}

interface NodalLoadBase {
  readonly type: 'nodal'
  readonly id: LoadId
  readonly nodeId: NodeId
}

type PlanarForceComponents =
  | Readonly<{ fx: number; fy?: number }>
  | Readonly<{ fx?: number; fy: number }>

type BeamFrameLoadComponents =
  | Readonly<{ fx: number; fy?: number; mz?: number }>
  | Readonly<{ fx?: number; fy: number; mz?: number }>
  | Readonly<{ fx?: number; fy?: number; mz: number }>

/** fx/fy: N；至少提供一个分量；桁架不得输入节点力矩。 */
export type PlanarNodalForce = NodalLoadBase & PlanarForceComponents

/** fx/fy: N；mz: N*m。至少提供一个分量。 */
export type NodalLoad2D = NodalLoadBase & BeamFrameLoadComponents

/** qY: 局部 +y_l 方向 N/m；梁首版仅支持全跨常值。 */
export interface BeamUniformLoad {
  readonly type: 'beam-uniform'
  readonly id: LoadId
  readonly elementId: ElementId
  readonly qY: number
}

/** qX/qY: 局部 +x_l/+y_l 方向 N/m；至少提供一个分量。 */
interface FrameUniformLoadBase {
  readonly type: 'frame-uniform'
  readonly id: LoadId
  readonly elementId: ElementId
  readonly interval?: Readonly<{ a: number; b: number }>
}

/** a/b: m，0<=a<b<=L；省略区间表示全跨。 */
export type FrameUniformLoad = FrameUniformLoadBase & (
  | Readonly<{ qX: number; qY?: number }>
  | Readonly<{ qX?: number; qY: number }>
)

/** deltaT: K。只表示均匀温差，不表示截面温度梯度。 */
export interface UniformTemperatureLoad {
  readonly type: 'uniform-temperature'
  readonly id: LoadId
  readonly elementId: ElementId
  readonly deltaT: number
}

/** strain: 无量纲常量；正值表示沿局部 +x_l 自由伸长。 */
export interface InitialStrainLoad {
  readonly type: 'initial-strain'
  readonly id: LoadId
  readonly elementId: ElementId
  readonly strain: number
}

/** gravity: m/s^2；仅用于桁架自重，各半集中到两端节点。 */
export interface TrussSelfWeightLoad {
  readonly type: 'truss-self-weight'
  readonly id: LoadId
  readonly elementId: ElementId
  readonly gravity: number
}

export type BeamLoad = NodalLoad2D | BeamUniformLoad
export type TrussLoad = PlanarNodalForce | UniformTemperatureLoad | InitialStrainLoad | TrussSelfWeightLoad
export type FrameLoad = NodalLoad2D | FrameUniformLoad | UniformTemperatureLoad | InitialStrainLoad
export type StructuralLoad = BeamLoad | TrussLoad | FrameLoad

interface StructuralModelBase {
  readonly units: StructuralInputUnits
  readonly nodes: readonly StructuralNode2D[]
  readonly materials: readonly StructuralMaterial[]
  readonly sections: readonly StructuralSection[]
}

export interface BeamModel2D extends StructuralModelBase {
  readonly analysis: 'beam'
  /** 首版梁只允许同一跨内的网格细分，不允许连续多跨。 */
  readonly topology: 'single-span'
  /** 所有梁单元解析后必须具有相同 E/A/I。 */
  readonly propertyPolicy: 'uniform'
  /** 模型级唯一属性源；单元不得各自覆盖 E/A/I。 */
  readonly uniformProperties: BeamPropertySource
  readonly elements: readonly BeamElement2D[]
  readonly constraints: readonly ZeroConstraint<BeamDof>[]
  readonly loads: readonly BeamLoad[]
}

export interface TrussModel2D extends StructuralModelBase {
  readonly analysis: 'truss'
  readonly elements: readonly TrussElement2D[]
  readonly constraints: readonly ZeroConstraint<TrussDof>[]
  readonly loads: readonly TrussLoad[]
}

export interface FrameModel2D extends StructuralModelBase {
  readonly analysis: 'frame'
  readonly elements: readonly FrameElement2D[]
  readonly constraints: readonly ZeroConstraint<BeamDof>[]
  readonly loads: readonly FrameLoad[]
}

export type StructuralModel2D = BeamModel2D | TrussModel2D | FrameModel2D

export type InfluenceLineResponse =
  | Readonly<{ type: 'left-reaction' | 'right-reaction' }>
  | Readonly<{ type: 'section-shear'; position: number; retainBothLimits: true }>
  | Readonly<{ type: 'section-moment'; position: number }>
  | Readonly<{ type: 'displacement'; position: number; E: number; I: number }>

/** 首版仅支持跨度为 span 的简支梁影响线；位置单位 m，E:Pa，I:m^4。 */
export interface InfluenceLineRequest {
  readonly analysis: 'influence-line'
  readonly units: StructuralInputUnits
  readonly beam: Readonly<{ topology: 'simply-supported'; span: number }>
  readonly response: InfluenceLineResponse
  readonly samplePositions: readonly number[]
}

export interface MovingAxle {
  readonly id: string
  /** 向下轴载绝对值，单位 N。 */
  readonly load: number
}

export interface MovingAxleGroup {
  readonly axles: readonly [MovingAxle, ...MovingAxle[]]
  /** 沿行进方向相邻轴间距，单位 m；数量必须为 axles.length-1。 */
  readonly adjacentSpacings: readonly number[]
  readonly direction: 'left-to-right' | 'right-to-left'
  /** 每个轴载先乘该有限正值；默认值由适配层设为 1。 */
  readonly dynamicFactor: number
}

/** 单轴组、单方向、静力包络；不允许多车/多车道组合。 */
export interface MovingLoadRequest {
  readonly analysis: 'moving-load'
  readonly units: StructuralInputUnits
  readonly beam: Readonly<{ topology: 'simply-supported'; span: number }>
  readonly response: InfluenceLineResponse
  readonly movingLoad: MovingAxleGroup
  readonly search: Readonly<{
    strategy: 'event-points-and-stationary-points'
    adaptivePositionTolerance: number
  }>
}

export type StructuralAnalysisRequest = StructuralModel2D | InfluenceLineRequest | MovingLoadRequest
