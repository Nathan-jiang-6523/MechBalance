import type { BalanceCheck, CalculationMetadata, ResultMessage } from '../../core/contracts'
import {
  createFrameStationResult,
  createStructuralQuantity,
  generateInfluenceLineSeries,
  recoverBeamDisplacementAt,
  recoverBeamInternalForcesAt,
  sampleFrameInternalForceField,
  solveBeamFiniteElement,
  solveFrameFiniteElement,
  solveMovingLoadEnvelope,
  solveTrussFiniteElement,
  type BeamFiniteElementSolution,
  type BeamModel2D,
  type ControlPositionResult,
  type ElementEndForceResult,
  type ElementStationResult,
  type FrameFiniteElementSolution,
  type FrameModel2D,
  type InfluenceLineRequest,
  type LinearSystemCheck,
  type MovingLoadRequest,
  type StructuralAnalysisRequest,
  type StructuralIssue,
  type StructuralResultData,
  type StructuralScreenResult,
  type TrussFiniteElementSolution,
  type TrussModel2D,
} from '../../core/structural'

const SAMPLE_INTERVALS = 24

function metadata(requestId: string, startedAt: number): CalculationMetadata {
  return {
    requestId,
    calculatedAt: new Date().toISOString(),
    formulaReferences: [{ id: 'P2-STRUCTURAL-MATRIX-STIFFNESS', version: '1.0', label: 'P2 结构矩阵刚度法' }],
    elapsedMilliseconds: Math.max(0, performance.now() - startedAt),
  }
}

function issueMessages(issues: readonly StructuralIssue[]): readonly ResultMessage[] {
  return issues.map(({ code, severity, message, field }) => ({
    code,
    severity,
    message,
    ...(field === undefined ? {} : { field }),
  }))
}

function errorResult(
  calculatorId: string,
  requestId: string,
  startedAt: number,
  issues: readonly StructuralIssue[] | readonly ResultMessage[],
): StructuralScreenResult {
  const messages = issues.length > 0 && 'severity' in issues[0]!
    ? (issues as readonly ResultMessage[])
    : issueMessages(issues as readonly StructuralIssue[])
  return {
    calculatorId,
    status: 'error',
    headline: '本次计算未完成',
    groups: [],
    charts: [],
    balanceChecks: [],
    messages,
    metadata: metadata(requestId, startedAt),
  }
}

function balanceChecks(checks: readonly LinearSystemCheck[]): readonly BalanceCheck[] {
  return checks.map((check) => ({
    id: check.id,
    label: check.id,
    residual: Math.abs(check.value),
    unit: check.unit,
    tolerance: check.tolerance,
    passed: check.passed,
  }))
}

function checkMessages(checks: readonly LinearSystemCheck[]): readonly ResultMessage[] {
  return checks.filter(({ passed }) => !passed).map(({ id, value, unit, tolerance }) => ({
    code: `P2_CHECK_${id.toUpperCase().replaceAll('-', '_')}`,
    severity: 'warning' as const,
    message: `${id} 余量 ${value} ${unit} 超过容差 ${tolerance} ${unit}`,
  }))
}

function controlFromStations(
  stations: readonly ElementStationResult[],
  field: 'axialForce' | 'shearForce' | 'bendingMoment' | 'displacement' | 'rotation',
): readonly ControlPositionResult[] {
  const candidates = stations.filter((station) => station[field] !== undefined)
  if (candidates.length === 0) return []
  const select = (kind: 'maximum' | 'minimum') => candidates.reduce((best, candidate) => {
    const value = candidate[field]!.value
    const bestValue = best[field]!.value
    return kind === 'maximum' ? (value > bestValue ? candidate : best) : (value < bestValue ? candidate : best)
  })
  return (['maximum', 'minimum'] as const).map((kind) => {
    const station = select(kind)
    return {
      responseId: field,
      kind,
      value: station[field]!,
      position: station.x,
      side: station.side,
      controllingObjectId: station.elementId,
    }
  })
}

function beamEndForce(elementId: string, values: readonly number[]): ElementEndForceResult {
  const force = (value: number, positive: string) => createStructuralQuantity(value, 'N', positive)
  const moment = (value: number) => createStructuralQuantity(value, 'N*m', '局部 +z 逆时针')
  return {
    elementId,
    coordinateSystem: 'local',
    nodeI: {
      fx: force(values[0]!, '局部 +x；单元作用于 i 节点'),
      fy: force(values[1]!, '局部 +y；单元作用于 i 节点'),
      mz: moment(values[2]!),
    },
    nodeJ: {
      fx: force(values[3]!, '局部 +x；单元作用于 j 节点'),
      fy: force(values[4]!, '局部 +y；单元作用于 j 节点'),
      mz: moment(values[5]!),
    },
  }
}

function beamData(solution: BeamFiniteElementSolution): StructuralResultData {
  const stations = solution.elements.flatMap((element) => Array.from(
    { length: SAMPLE_INTERVALS + 1 },
    (_, index): ElementStationResult => {
      const localX = element.length * index / SAMPLE_INTERVALS
      const force = recoverBeamInternalForcesAt({
        L: element.length,
        elementOnNodeEndForces: element.elementOnNodeEndForces,
        qY: element.uniformLoadQY,
      }, localX)
      const displacement = recoverBeamDisplacementAt({
        E: solution.properties.E,
        I: solution.properties.I,
        L: element.length,
        localDisplacements: element.localDisplacements,
        qY: element.uniformLoadQY,
      }, localX)
      return {
        elementId: element.elementId,
        x: createStructuralQuantity(element.xI + localX, 'm', '全局 +x'),
        side: 'continuous',
        axialForce: createStructuralQuantity(force.N, 'N', '正值表示拉力'),
        shearForce: createStructuralQuantity(force.V, 'N', '正值满足 V=dM/dx'),
        bendingMoment: createStructuralQuantity(force.M, 'N*m', '正值表示正弯矩'),
        displacement: createStructuralQuantity(displacement.v, 'm', '正值沿全局 +y'),
        rotation: createStructuralQuantity(displacement.theta, 'rad', '正值逆时针'),
      }
    },
  ))
  return {
    analysis: 'beam',
    displacements: solution.nodes.map((node) => ({
      nodeId: node.nodeId,
      u: createStructuralQuantity(node.u, 'm', '全局 +x'),
      v: createStructuralQuantity(node.v, 'm', '全局 +y'),
      theta: createStructuralQuantity(node.theta, 'rad', '逆时针'),
    })),
    reactions: solution.nodes.map((node) => ({
      nodeId: node.nodeId,
      fx: createStructuralQuantity(node.reactionFx, 'N', '全局 +x'),
      fy: createStructuralQuantity(node.reactionFy, 'N', '全局 +y'),
      mz: createStructuralQuantity(node.reactionMz, 'N*m', '逆时针'),
    })),
    endForces: solution.elements.map((element) => beamEndForce(element.elementId, element.elementOnNodeEndForces)),
    stations,
    controls: ['axialForce', 'shearForce', 'bendingMoment', 'displacement', 'rotation'].flatMap(
      (field) => controlFromStations(stations, field as Parameters<typeof controlFromStations>[1]),
    ),
  }
}

function trussData(solution: TrussFiniteElementSolution): StructuralResultData {
  const controls: ControlPositionResult[] = []
  for (const field of ['axialForce', 'stress'] as const) {
    for (const kind of ['maximum', 'minimum'] as const) {
      const element = solution.elements.reduce((best, candidate) => {
        const value = candidate[field].value
        const bestValue = best[field].value
        return kind === 'maximum' ? (value > bestValue ? candidate : best) : (value < bestValue ? candidate : best)
      })
      controls.push({
        responseId: field,
        kind,
        value: element[field],
        position: createStructuralQuantity(0, 'm', '桁架单元常值；位置不适用'),
        controllingObjectId: element.elementId,
      })
    }
  }
  return {
    analysis: 'truss',
    displacements: solution.nodes.map((node) => ({
      nodeId: node.nodeId,
      u: createStructuralQuantity(node.u, 'm', '全局 +x'),
      v: createStructuralQuantity(node.v, 'm', '全局 +y'),
    })),
    reactions: solution.nodes.map((node) => ({
      nodeId: node.nodeId,
      fx: createStructuralQuantity(node.reactionFx, 'N', '全局 +x'),
      fy: createStructuralQuantity(node.reactionFy, 'N', '全局 +y'),
    })),
    elements: solution.elements.map(({ elementId, axialForce, stress, state }) => ({
      elementId,
      axialForce,
      stress,
      state,
    })),
    controls,
  }
}

function frameData(solution: FrameFiniteElementSolution): StructuralResultData {
  const stations = solution.elements.flatMap((element) => {
    const input = {
      elementId: element.elementId,
      L: element.length,
      elementOnNodeEndForces: element.localEndForces,
      distributedLoads: element.distributedLoads,
    }
    return sampleFrameInternalForceField(input, SAMPLE_INTERVALS).map(({ localX }) => createFrameStationResult(
      input,
      localX,
      element.properties.extremeFiberY === undefined ? [] : [element.properties.extremeFiberY, -element.properties.extremeFiberY],
      element.properties.A,
      element.properties.I,
    ))
  })
  return {
    analysis: 'frame',
    displacements: solution.nodes.map((node) => ({
      nodeId: node.nodeId,
      u: createStructuralQuantity(node.u, 'm', '全局 +x'),
      v: createStructuralQuantity(node.v, 'm', '全局 +y'),
      theta: createStructuralQuantity(node.theta, 'rad', '逆时针'),
    })),
    reactions: solution.nodes.map((node) => ({
      nodeId: node.nodeId,
      fx: createStructuralQuantity(node.reactionFx, 'N', '全局 +x'),
      fy: createStructuralQuantity(node.reactionFy, 'N', '全局 +y'),
      mz: createStructuralQuantity(node.reactionMz, 'N*m', '逆时针'),
    })),
    endForces: solution.elements.flatMap((element) => [element.localEndForceResult, element.globalEndForceResult]),
    stations,
    controls: ['axialForce', 'shearForce', 'bendingMoment'].flatMap(
      (field) => controlFromStations(stations, field as Parameters<typeof controlFromStations>[1]),
    ),
  }
}

function successResult(
  calculatorId: string,
  requestId: string,
  startedAt: number,
  structural: StructuralResultData,
  checks: readonly LinearSystemCheck[] = [],
): StructuralScreenResult {
  const messages = checkMessages(checks)
  return {
    calculatorId,
    status: messages.length > 0 ? 'warning' : 'success',
    headline: messages.length > 0 ? '计算完成，但有校核警告' : '计算完成',
    summary: '所有数值均为未格式化的 SI 内核结果；显示单位由界面统一转换。',
    groups: [],
    charts: [],
    messages,
    balanceChecks: balanceChecks(checks),
    metadata: metadata(requestId, startedAt),
    structural,
  }
}

function runBeam(request: BeamModel2D, requestId: string, startedAt: number): StructuralScreenResult {
  const solved = solveBeamFiniteElement(request)
  return solved.ok
    ? successResult('p2-beam', requestId, startedAt, beamData(solved.value), solved.value.checks)
    : errorResult('p2-beam', requestId, startedAt, solved.issues)
}

function runTruss(request: TrussModel2D, requestId: string, startedAt: number): StructuralScreenResult {
  const solved = solveTrussFiniteElement(request)
  return solved.ok
    ? successResult('p2-truss', requestId, startedAt, trussData(solved.value), solved.value.checks)
    : errorResult('p2-truss', requestId, startedAt, solved.issues)
}

function runFrame(request: FrameModel2D, requestId: string, startedAt: number): StructuralScreenResult {
  const solved = solveFrameFiniteElement(request)
  return solved.ok
    ? successResult('p2-frame', requestId, startedAt, frameData(solved.value), solved.value.checks)
    : errorResult('p2-frame', requestId, startedAt, solved.issues)
}

function runInfluence(request: InfluenceLineRequest, requestId: string, startedAt: number): StructuralScreenResult {
  try {
    const series = generateInfluenceLineSeries(request)
    const controls = ([['maximum', series.maximum], ['minimum', series.minimum]] as const).map(([kind, point]) => ({
      responseId: series.responseId,
      kind,
      value: createStructuralQuantity(point.ordinate, series.ordinateUnit, '影响线正纵坐标'),
      position: createStructuralQuantity(point.position, 'm', '从梁左端沿 +x'),
      side: point.side,
    }))
    return successResult('p2-influence-line', requestId, startedAt, {
      analysis: 'influence-line',
      responseId: series.responseId,
      ordinates: series.points.map((point) => ({
        position: createStructuralQuantity(point.position, 'm', '从梁左端沿 +x'),
        ordinate: createStructuralQuantity(point.ordinate, series.ordinateUnit, '影响线正纵坐标'),
        side: point.side,
      })),
      controls,
    })
  } catch (error) {
    return errorResult('p2-influence-line', requestId, startedAt, [{
      code: 'P2_INFLUENCE_INVALID',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
      field: 'request',
    }])
  }
}

function runMovingLoad(request: MovingLoadRequest, requestId: string, startedAt: number): StructuralScreenResult {
  const solved = solveMovingLoadEnvelope(request)
  if (!solved.ok) return errorResult('p2-moving-load', requestId, startedAt, solved.issues)
  const controls: readonly ControlPositionResult[] = [solved.value.maximum, solved.value.minimum].map((control) => ({
    responseId: request.response.type,
    kind: control.kind,
    value: createStructuralQuantity(control.value, solved.value.responseUnit, '与所选响应正方向一致'),
    position: createStructuralQuantity(control.frontAxlePosition, 'm', '控制前轴相对梁左端位置'),
    side: control.side,
    ...(control.controllingAxleId === undefined ? {} : { controllingAxleId: control.controllingAxleId }),
  }))
  const governing = Math.abs(solved.value.maximum.value) >= Math.abs(solved.value.minimum.value)
    ? solved.value.maximum
    : solved.value.minimum
  return successResult('p2-moving-load', requestId, startedAt, {
    analysis: 'moving-load',
    responseId: request.response.type,
    controls,
    axlePositions: governing.axlePositions.map((axle) => ({
      axleId: axle.axleId,
      position: createStructuralQuantity(axle.position, 'm', '相对梁左端；桥外位置仍保留'),
    })),
  })
}

/** The only feature-layer entry point: core remains SI-only and Vue performs no mechanics. */
export function runStructuralCalculation(request: StructuralAnalysisRequest): StructuralScreenResult {
  const startedAt = performance.now()
  const requestId = `${request.analysis}-${Date.now()}`
  if (request.analysis === 'beam') return runBeam(request, requestId, startedAt)
  if (request.analysis === 'truss') return runTruss(request, requestId, startedAt)
  if (request.analysis === 'frame') return runFrame(request, requestId, startedAt)
  if (request.analysis === 'influence-line') return runInfluence(request, requestId, startedAt)
  return runMovingLoad(request, requestId, startedAt)
}
