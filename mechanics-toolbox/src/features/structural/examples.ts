import type {
  BeamModel2D,
  FrameModel2D,
  InfluenceLineRequest,
  MovingLoadRequest,
  StructuralAnalysisRequest,
  TrussModel2D,
} from '../../core/structural'

export interface StructuralExample {
  readonly id: 'BEAM-A01' | 'TRUSS-A01' | 'FRAME-A01' | 'IL-A03' | 'ML-A01'
  readonly title: string
  readonly request: StructuralAnalysisRequest
}

const beamA01: BeamModel2D = {
  analysis: 'beam', units: 'SI', topology: 'single-span', propertyPolicy: 'uniform',
  uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-6 },
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }, { id: '3', x: 4, y: 0 }],
  materials: [], sections: [],
  elements: [
    { type: 'beam', id: '1', nodeI: '1', nodeJ: '2' },
    { type: 'beam', id: '2', nodeI: '2', nodeJ: '3' },
  ],
  constraints: [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '3', dof: 'v', value: 0 },
  ],
  loads: [{ type: 'nodal', id: 'P', nodeId: '2', fy: -40_000 }],
}

const trussA01: TrussModel2D = {
  analysis: 'truss', units: 'SI',
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }, { id: '3', x: 2, y: 3 }],
  materials: [], sections: [],
  elements: [
    { type: 'truss', id: '13', nodeI: '1', nodeJ: '3', properties: { source: 'inline', E: 200e9, A: 0.001 } },
    { type: 'truss', id: '23', nodeI: '2', nodeJ: '3', properties: { source: 'inline', E: 200e9, A: 0.001 } },
    { type: 'truss', id: '12', nodeI: '1', nodeJ: '2', properties: { source: 'inline', E: 200e9, A: 0.001 } },
  ],
  constraints: [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 },
  ],
  loads: [{ type: 'nodal', id: 'P', nodeId: '3', fy: -100_000 }],
}

const frameProperties = { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 } as const
const frameA01: FrameModel2D = {
  analysis: 'frame', units: 'SI',
  nodes: [
    { id: '1', x: 0, y: 0 }, { id: '2', x: 0, y: 3 },
    { id: '3', x: 4, y: 3 }, { id: '4', x: 4, y: 0 },
  ],
  materials: [], sections: [],
  elements: [
    { type: 'frame', id: '12', nodeI: '1', nodeJ: '2', properties: frameProperties },
    { type: 'frame', id: '23', nodeI: '2', nodeJ: '3', properties: frameProperties },
    { type: 'frame', id: '43', nodeI: '4', nodeJ: '3', properties: frameProperties },
  ],
  constraints: [
    ...(['u', 'v', 'theta'] as const).map((dof) => ({ nodeId: '1', dof, value: 0 as const })),
    ...(['u', 'v', 'theta'] as const).map((dof) => ({ nodeId: '4', dof, value: 0 as const })),
  ],
  loads: [
    { type: 'nodal', id: 'H2', nodeId: '2', fx: 6_000 },
    { type: 'nodal', id: 'H3', nodeId: '3', fx: 6_000 },
  ],
}

const ilA03: InfluenceLineRequest = {
  analysis: 'influence-line', units: 'SI',
  beam: { topology: 'simply-supported', span: 10 },
  response: { type: 'section-shear', position: 4, retainBothLimits: true },
  samplePositions: [0, 2, 4, 7, 10],
}

const mlA01: MovingLoadRequest = {
  analysis: 'moving-load', units: 'SI',
  beam: { topology: 'simply-supported', span: 10 },
  response: { type: 'left-reaction' },
  movingLoad: {
    axles: [{ id: 'front', load: 100_000 }, { id: 'rear', load: 60_000 }],
    adjacentSpacings: [3], direction: 'left-to-right', dynamicFactor: 1,
  },
  search: { strategy: 'event-points-and-stationary-points', adaptivePositionTolerance: 1e-9 },
}

export const STRUCTURAL_EXAMPLES = [
  { id: 'BEAM-A01', title: '简支梁跨中集中力', request: beamA01 },
  { id: 'TRUSS-A01', title: '三角桁架', request: trussA01 },
  { id: 'FRAME-A01', title: '门式刚架', request: frameA01 },
  { id: 'IL-A03', title: '指定截面剪力影响线', request: ilA03 },
  { id: 'ML-A01', title: '单轴组移动极值', request: mlA01 },
] as const satisfies readonly StructuralExample[]

export function getStructuralExample(id: StructuralExample['id']): StructuralAnalysisRequest {
  const example = STRUCTURAL_EXAMPLES.find((candidate) => candidate.id === id)
  if (!example) throw new RangeError(`未知 P2 算例：${id}`)
  return structuredClone(example.request)
}
