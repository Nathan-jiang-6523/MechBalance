import type {
  BeamModel2D,
  FrameModel2D,
  InfluenceLineRequest,
  MovingLoadRequest,
  StructuralAnalysisRequest,
  TrussModel2D,
} from '../../core/structural'

export interface StructuralExample {
  readonly id:
    | 'BEAM-A03'
    | 'BEAM-A01'
    | 'CBEAM-A03'
    | 'TRUSS-A01'
    | 'TRUSS-T01'
    | 'TRUSS-IS01'
    | 'TRUSS-SW01'
    | 'FRAME-A01'
    | 'FRAME-A02'
    | 'FRAME-A03'
    | 'FRAME-T01'
    | 'FRAME-IS01'
    | 'IL-A03'
    | 'ML-A01'
  readonly title: string
  readonly request: StructuralAnalysisRequest
  readonly fixtureSource: Readonly<{
    caseId: string
    path: `qa/fixtures/${string}.json`
    fixtureVersion: string
  }>
}

function fixtureSource(
  caseId: string,
  path: `qa/fixtures/${string}.json`,
  fixtureVersion: string,
): StructuralExample['fixtureSource'] {
  return { caseId, path, fixtureVersion }
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

const beamA03: BeamModel2D = {
  analysis: 'beam', units: 'SI', topology: 'single-span', propertyPolicy: 'uniform',
  uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-6 },
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 3, y: 0 }],
  materials: [], sections: [],
  elements: [{ type: 'beam', id: '12', nodeI: '1', nodeJ: '2' }],
  constraints: [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '1', dof: 'theta', value: 0 },
  ],
  loads: [{ type: 'nodal', id: 'P', nodeId: '2', fy: -10_000 }],
}

const cbeamA03: BeamModel2D = {
  analysis: 'beam', units: 'SI', topology: 'single-span', propertyPolicy: 'uniform',
  uniformProperties: { source: 'inline', E: 200e9, A: 0.01, I: 8e-6 },
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }],
  materials: [], sections: [],
  elements: [{ type: 'beam', id: '12', nodeI: '1', nodeJ: '2' }],
  constraints: [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '1', dof: 'theta', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 },
  ],
  loads: [{ type: 'beam-uniform', id: 'q', elementId: '12', qY: -10_000 }],
}

const trussBarProperties = { source: 'inline', E: 200e9, A: 0.001 } as const

function trussBar(
  properties: TrussModel2D['elements'][number]['properties'],
  constraints: TrussModel2D['constraints'],
  loads: TrussModel2D['loads'],
): TrussModel2D {
  return {
    analysis: 'truss', units: 'SI',
    nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
    materials: [], sections: [],
    elements: [{ type: 'truss', id: '12', nodeI: '1', nodeJ: '2', properties }],
    constraints,
    loads,
  }
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

const trussT01 = trussBar(
  { ...trussBarProperties, alpha: 12e-6 },
  [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 },
  ],
  [{ type: 'uniform-temperature', id: 'temperature', elementId: '12', deltaT: 50 }],
)

const trussIs01 = trussBar(
  trussBarProperties,
  [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '2', dof: 'u', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 },
  ],
  [{ type: 'initial-strain', id: 'initial-strain', elementId: '12', strain: 500e-6 }],
)

const trussSw01 = trussBar(
  { ...trussBarProperties, density: 7_850 },
  [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 },
  ],
  [{ type: 'truss-self-weight', id: 'self-weight', elementId: '12', gravity: 9.80665 }],
)

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

function frameBar(
  properties: FrameModel2D['elements'][number]['properties'],
  constraints: FrameModel2D['constraints'],
  loads: FrameModel2D['loads'],
): FrameModel2D {
  return {
    analysis: 'frame', units: 'SI',
    nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 4, y: 0 }],
    materials: [], sections: [],
    elements: [{ type: 'frame', id: '12', nodeI: '1', nodeJ: '2', properties }],
    constraints,
    loads,
  }
}

const fixedFrameConstraints: FrameModel2D['constraints'] = [
  ...(['u', 'v', 'theta'] as const).map((dof) => ({ nodeId: '1', dof, value: 0 as const })),
  ...(['u', 'v', 'theta'] as const).map((dof) => ({ nodeId: '2', dof, value: 0 as const })),
]

const frameA02 = frameBar(
  { source: 'inline', E: 200e9, A: 0.01, I: 8e-5, extremeFiberY: 0.12 },
  fixedFrameConstraints,
  [{ type: 'frame-uniform', id: 'q', elementId: '12', qY: -10_000 }],
)

const frameA03 = frameBar(
  { source: 'inline', E: 200e9, A: 0.01, I: 8e-5 },
  [
    { nodeId: '1', dof: 'u', value: 0 },
    { nodeId: '1', dof: 'v', value: 0 },
    { nodeId: '2', dof: 'v', value: 0 },
  ],
  [{ type: 'frame-uniform', id: 'q-partial', elementId: '12', qY: -10_000, interval: { a: 0, b: 2 } }],
)

const frameThermalProperties = {
  source: 'inline', E: 200e9, A: 0.001, I: 8e-6, alpha: 12e-6,
} as const

const frameT01: FrameModel2D = {
  ...frameBar(
    frameThermalProperties,
    fixedFrameConstraints,
    [{ type: 'uniform-temperature', id: 'temperature', elementId: '12', deltaT: 50 }],
  ),
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
}

const frameIs01: FrameModel2D = {
  ...frameBar(
    { source: 'inline', E: 200e9, A: 0.001, I: 8e-6 },
    fixedFrameConstraints,
    [{ type: 'initial-strain', id: 'initial-strain', elementId: '12', strain: 500e-6 }],
  ),
  nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 2, y: 0 }],
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
  {
    id: 'BEAM-A03', title: '左端固支悬臂梁自由端集中力', request: beamA03,
    fixtureSource: fixtureSource('P2-BEAM-A03', 'qa/fixtures/p2-beam.json', 'P2-BEAM-FIXTURES-v1'),
  },
  {
    id: 'BEAM-A01', title: '简支梁跨中集中力（验证基准）', request: beamA01,
    fixtureSource: fixtureSource('P2-BEAM-A01', 'qa/fixtures/p2-beam.json', 'P2-BEAM-FIXTURES-v1'),
  },
  {
    id: 'CBEAM-A03', title: '固定—简支梁', request: cbeamA03,
    fixtureSource: fixtureSource('P2-CBEAM-A03', 'qa/fixtures/p2-cbeam.json', 'P2-CBEAM-FIXTURES-v1'),
  },
  {
    id: 'TRUSS-A01', title: '三角桁架', request: trussA01,
    fixtureSource: fixtureSource('P2-TRUSS-A01', 'qa/fixtures/p2-truss.json', 'P2-TRUSS-FIXTURES-v1'),
  },
  {
    id: 'TRUSS-T01', title: '桁架均匀温升自由伸长', request: trussT01,
    fixtureSource: fixtureSource('P2-TRUSS-T01', 'qa/fixtures/p2-truss.json', 'P2-TRUSS-FIXTURES-v1'),
  },
  {
    id: 'TRUSS-IS01', title: '桁架完全约束初应变', request: trussIs01,
    fixtureSource: fixtureSource('P2-TRUSS-IS01', 'qa/fixtures/p2-truss.json', 'P2-TRUSS-FIXTURES-v1'),
  },
  {
    id: 'TRUSS-SW01', title: '桁架杆件自重', request: trussSw01,
    fixtureSource: fixtureSource('P2-TRUSS-SW01', 'qa/fixtures/p2-truss.json', 'P2-TRUSS-FIXTURES-v1'),
  },
  {
    id: 'FRAME-A01', title: '门式刚架', request: frameA01,
    fixtureSource: fixtureSource('P2-FRAME-A01', 'qa/fixtures/p2-frame.json', 'P2-FRAME-FIXTURES-v1'),
  },
  {
    id: 'FRAME-A02', title: '刚架全跨常值分布载荷', request: frameA02,
    fixtureSource: fixtureSource('P2-FRAME-A02', 'qa/fixtures/p2-frame.json', 'P2-FRAME-FIXTURES-v1'),
  },
  {
    id: 'FRAME-A03', title: '刚架区间常值分布载荷', request: frameA03,
    fixtureSource: fixtureSource('P2-FRAME-A03', 'qa/fixtures/p2-frame.json', 'P2-FRAME-FIXTURES-v1'),
  },
  {
    id: 'FRAME-T01', title: '刚架完全约束均匀温升', request: frameT01,
    fixtureSource: fixtureSource('P2-FRAME-T01', 'qa/fixtures/p2-frame.json', 'P2-FRAME-FIXTURES-v1'),
  },
  {
    id: 'FRAME-IS01', title: '刚架完全约束初应变', request: frameIs01,
    fixtureSource: fixtureSource('P2-FRAME-IS01', 'qa/fixtures/p2-frame.json', 'P2-FRAME-FIXTURES-v1'),
  },
  {
    id: 'IL-A03', title: '指定截面剪力影响线', request: ilA03,
    fixtureSource: fixtureSource('P2-IL-A03', 'qa/fixtures/p2-influence-moving.json', 'P2-IL-ML-FIXTURES-v1'),
  },
  {
    id: 'ML-A01', title: '单轴组移动极值', request: mlA01,
    fixtureSource: fixtureSource('P2-ML-A01', 'qa/fixtures/p2-influence-moving.json', 'P2-IL-ML-FIXTURES-v1'),
  },
] as const satisfies readonly StructuralExample[]

export function getStructuralExample(id: StructuralExample['id']): StructuralAnalysisRequest {
  const example = STRUCTURAL_EXAMPLES.find((candidate) => candidate.id === id)
  if (!example) throw new RangeError(`未知 P2 算例：${id}`)
  return structuredClone(example.request)
}
