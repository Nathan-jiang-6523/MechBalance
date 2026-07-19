import type { CurveChart, CurvePoint, CurveSeries, PointSide } from '../../../core/contracts'
import { convertFromSI, getUnitDefinition, type UnitPresetId } from '../../../core/units'
import { getStructuralQuantityId, getStructuralUnit, type StructuralQuantityKey } from '../../../core/structural/units'
import type {
  ElementEndForceResult,
  ElementStationResult,
  StructuralQuantity,
  StructuralScreenResult,
} from '../../../core/structural/contracts'

export interface StructuralDisplayRow {
  readonly key: string
  readonly label: string
  readonly objectId?: string
  readonly value: number
  readonly unit: string
  readonly positive: string
  readonly position?: Readonly<{ value: number; unit: string; side?: PointSide }>
  readonly state?: 'tension' | 'compression' | 'zero'
  readonly note?: string
}

export interface StructuralResultRows {
  readonly controls: readonly StructuralDisplayRow[]
  readonly displacements: readonly StructuralDisplayRow[]
  readonly reactions: readonly StructuralDisplayRow[]
  readonly elements: readonly StructuralDisplayRow[]
}

const RESULT_UNIT_QUANTITIES: Readonly<Partial<Record<string, StructuralQuantityKey>>> = {
  m: 'length',
  N: 'force',
  'N*m': 'moment',
  Pa: 'stress',
  kg: 'mass',
  rad: 'rotation',
  '1': 'dimensionless',
}

function displayValue(value: number, unit: string, presetId: UnitPresetId): Readonly<{ value: number; unit: string }> {
  const quantityKey = RESULT_UNIT_QUANTITIES[unit]
  if (!quantityKey || unit === 'm/N') return { value, unit }
  const quantityId = getStructuralQuantityId(quantityKey)
  const unitId = getStructuralUnit(quantityKey, presetId)
  return {
    value: convertFromSI(value, quantityId, unitId),
    unit: getUnitDefinition(quantityId, unitId).symbol,
  }
}

function quantityRow(
  key: string,
  label: string,
  quantity: StructuralQuantity,
  presetId: UnitPresetId,
  options: Pick<StructuralDisplayRow, 'objectId' | 'position' | 'state' | 'note'> = {},
): StructuralDisplayRow {
  const displayed = displayValue(quantity.value, quantity.unit, presetId)
  const position = options.position === undefined
    ? undefined
    : { ...options.position, ...displayValue(options.position.value, options.position.unit, presetId) }
  return {
    key,
    label,
    ...displayed,
    positive: quantity.positive,
    ...options,
    ...(position === undefined ? {} : { position }),
  }
}

function endForceRows(endForce: ElementEndForceResult, presetId: UnitPresetId): StructuralDisplayRow[] {
  const coordinate = endForce.coordinateSystem === 'local' ? '局部' : '全局'
  return (['nodeI', 'nodeJ'] as const).flatMap((end) => {
    const endLabel = end === 'nodeI' ? 'i 端' : 'j 端'
    return (['fx', 'fy', 'mz'] as const).map((component) => quantityRow(
      `end-${endForce.elementId}-${coordinate}-${end}-${component}`,
      `${coordinate} ${endLabel} ${component.toUpperCase()}`,
      endForce[end][component],
      presetId,
      { objectId: endForce.elementId },
    ))
  })
}

function stationRows(station: ElementStationResult, presetId: UnitPresetId): StructuralDisplayRow[] {
  const position = { value: station.x.value, unit: station.x.unit, side: station.side }
  const rows = [
    quantityRow(`station-${station.elementId}-${station.x.value}-${station.side}-N`, '轴力 N', station.axialForce, presetId, {
      objectId: station.elementId, position,
    }),
    quantityRow(`station-${station.elementId}-${station.x.value}-${station.side}-V`, '剪力 V', station.shearForce, presetId, {
      objectId: station.elementId, position,
    }),
    quantityRow(`station-${station.elementId}-${station.x.value}-${station.side}-M`, '弯矩 M', station.bendingMoment, presetId, {
      objectId: station.elementId, position,
    }),
  ]
  if (station.rotation) rows.push(quantityRow(
    `station-${station.elementId}-${station.x.value}-${station.side}-theta`, '转角 θ', station.rotation, presetId,
    { objectId: station.elementId, position },
  ))
  if (station.displacement) rows.push(quantityRow(
    `station-${station.elementId}-${station.x.value}-${station.side}-v`, '位移 v', station.displacement, presetId,
    { objectId: station.elementId, position },
  ))
  station.fiberStresses?.forEach((fiber, index) => rows.push(quantityRow(
    `station-${station.elementId}-${station.x.value}-${station.side}-stress-${index}`,
    `纤维应力 σ（y=${fiber.y.value} ${fiber.y.unit}）`,
    fiber.stress,
    presetId,
    { objectId: station.elementId, position, note: fiber.y.positive },
  )))
  return rows
}

function isUnconfirmedUtilization(text: string): boolean {
  return /utili[sz]ation|利用率/i.test(text)
}

export function buildStructuralResultRows(
  result: StructuralScreenResult,
  presetId: UnitPresetId = 'si',
): StructuralResultRows {
  if (result.status === 'error') {
    return { controls: [], displacements: [], reactions: [], elements: [] }
  }
  const data = result.structural
  const controls = data.controls
    .filter(({ responseId }) => !isUnconfirmedUtilization(responseId))
    .map((control) => quantityRow(
      `control-${control.responseId}-${control.kind}`,
      `${control.responseId} · ${control.kind === 'maximum' ? '最大值' : '最小值'}`,
      control.value,
      presetId,
      {
        ...(control.controllingObjectId
          ? { objectId: control.controllingObjectId }
          : control.controllingAxleId ? { objectId: control.controllingAxleId } : {}),
        position: {
          value: control.position.value,
          unit: control.position.unit,
          ...(control.side === undefined ? {} : { side: control.side }),
        },
        ...(control.controllingAxleId ? { note: `控制轴 ${control.controllingAxleId}` } : {}),
      },
    ))
  const displacements = 'displacements' in data ? data.displacements.flatMap((node) => [
    quantityRow(`node-${node.nodeId}-u`, '节点位移 u', node.u, presetId, { objectId: node.nodeId }),
    quantityRow(`node-${node.nodeId}-v`, '节点位移 v', node.v, presetId, { objectId: node.nodeId }),
    ...(node.theta ? [quantityRow(`node-${node.nodeId}-theta`, '节点转角 θ', node.theta, presetId, {
      objectId: node.nodeId,
    })] : []),
  ]) : []
  const reactions = 'reactions' in data ? data.reactions.flatMap((node) => [
    quantityRow(`reaction-${node.nodeId}-fx`, '支座反力 Fx', node.fx, presetId, { objectId: node.nodeId }),
    quantityRow(`reaction-${node.nodeId}-fy`, '支座反力 Fy', node.fy, presetId, { objectId: node.nodeId }),
    ...(node.mz ? [quantityRow(`reaction-${node.nodeId}-mz`, '支座反力矩 Mz', node.mz, presetId, {
      objectId: node.nodeId,
    })] : []),
  ]) : []
  let elements: StructuralDisplayRow[] = []
  if (data.analysis === 'beam' || data.analysis === 'frame') {
    elements = [
      ...data.endForces.flatMap((endForce) => endForceRows(endForce, presetId)),
      ...data.stations.flatMap((station) => stationRows(station, presetId)),
    ]
  } else if (data.analysis === 'truss') {
    elements = data.elements.flatMap((element) => [
      quantityRow(`truss-${element.elementId}-N`, '杆件轴力 N', element.axialForce, presetId, {
        objectId: element.elementId, state: element.state,
      }),
      quantityRow(`truss-${element.elementId}-stress`, '杆件正应力 σ', element.stress, presetId, {
        objectId: element.elementId, state: element.state,
      }),
    ])
  } else if (data.analysis === 'influence-line') {
    elements = data.ordinates.map((ordinate, index) => quantityRow(
      `ordinate-${index}-${ordinate.side}`, `影响线纵坐标 ${data.responseId}`, ordinate.ordinate, presetId,
      { position: { value: ordinate.position.value, unit: ordinate.position.unit, side: ordinate.side } },
    ))
  } else {
    elements = data.axlePositions.map((axle) => quantityRow(
      `axle-${axle.axleId}`, '控制轴位置', axle.position, presetId,
      { objectId: axle.axleId, position: { value: axle.position.value, unit: axle.position.unit } },
    ))
  }
  return { controls, displacements, reactions, elements }
}

function groupStations(stations: readonly ElementStationResult[]): Map<string, ElementStationResult[]> {
  const grouped = new Map<string, ElementStationResult[]>()
  stations.forEach((station) => grouped.set(station.elementId, [...(grouped.get(station.elementId) ?? []), station]))
  return grouped
}

function stationSeries(
  stations: readonly ElementStationResult[],
  field: 'axialForce' | 'shearForce' | 'bendingMoment' | 'rotation' | 'displacement',
  name: string,
  presetId: UnitPresetId,
): CurveSeries[] {
  return [...groupStations(stations)].flatMap(([elementId, values]) => {
    const points = values.flatMap((station): CurvePoint[] => {
      const quantity = station[field]
      if (!quantity) return []
      return [{
        x: displayValue(station.x.value, station.x.unit, presetId).value,
        y: displayValue(quantity.value, quantity.unit, presetId).value,
        side: station.side,
      }]
    })
    if (points.length === 0) return []
    const quantity = values.find((station) => station[field] !== undefined)?.[field]
    return [{
      id: `${elementId}-${field}`,
      name: `${elementId} · ${name}`,
      kind: 'line',
      unit: displayValue(0, quantity!.unit, presetId).unit,
      points,
    }]
  })
}

function chart(id: string, title: string, series: readonly CurveSeries[], presetId: UnitPresetId): CurveChart {
  return { id, title, xLabel: '局部位置 x', xUnit: displayValue(0, 'm', presetId).unit, series }
}

/** Build display curves only from confirmed result values; performs no mechanics calculation. */
export function buildStructuralCharts(
  result: StructuralScreenResult,
  presetId: UnitPresetId = 'si',
): readonly CurveChart[] {
  if (result.status === 'error' || result.structural.analysis === 'moving-load') return []
  if (result.charts.length > 0) return result.charts.map((source) => ({
    ...source,
    xUnit: displayValue(0, source.xUnit, presetId).unit,
    series: source.series.map((series) => ({
      ...series,
      unit: displayValue(0, series.unit, presetId).unit,
      points: series.points.map((point) => ({
        ...point,
        x: displayValue(point.x, source.xUnit, presetId).value,
        y: displayValue(point.y, series.unit, presetId).value,
      })),
    })),
  }))
  const data = result.structural
  if (data.analysis === 'beam' || data.analysis === 'frame') {
    const charts = [
      chart('structural-N', '轴力 N', stationSeries(data.stations, 'axialForce', 'N', presetId), presetId),
      chart('structural-V', '剪力 V', stationSeries(data.stations, 'shearForce', 'V', presetId), presetId),
      chart('structural-M', '弯矩 M', stationSeries(data.stations, 'bendingMoment', 'M', presetId), presetId),
    ]
    if (data.analysis === 'beam') {
      charts.push(
        chart('structural-theta', '转角 θ', stationSeries(data.stations, 'rotation', 'θ', presetId), presetId),
        chart('structural-v', '位移 v', stationSeries(data.stations, 'displacement', 'v', presetId), presetId),
      )
    }
    return charts.filter(({ series }) => series.length > 0)
  }
  if (data.analysis === 'influence-line') {
    return [{
      id: `influence-${data.responseId}`,
      title: `影响线 · ${data.responseId}`,
      xLabel: '位置 x',
      xUnit: displayValue(0, 'm', presetId).unit,
      series: [{
        id: data.responseId,
        name: data.responseId,
        kind: 'line',
        unit: displayValue(0, data.ordinates[0]?.ordinate.unit ?? '1', presetId).unit,
        points: data.ordinates.map((ordinate) => ({
          x: displayValue(ordinate.position.value, ordinate.position.unit, presetId).value,
          y: displayValue(ordinate.ordinate.value, ordinate.ordinate.unit, presetId).value,
          side: ordinate.side,
        })),
      }],
    }]
  }
  const points = data.elements.map((_, index) => index + 1)
  return [
    {
      id: 'truss-axial', title: '桁架杆件轴力', xLabel: '单元序号', xUnit: '1',
      series: [{ id: 'truss-N', name: 'N', kind: 'scatter', unit: displayValue(0, 'N', presetId).unit, points: data.elements.map(
        (element, index) => ({ x: points[index]!, y: displayValue(element.axialForce.value, element.axialForce.unit, presetId).value }),
      ) }],
    },
    {
      id: 'truss-stress', title: '桁架杆件正应力', xLabel: '单元序号', xUnit: '1',
      series: [{ id: 'truss-stress', name: 'σ', kind: 'scatter', unit: displayValue(0, 'Pa', presetId).unit, points: data.elements.map(
        (element, index) => ({ x: points[index]!, y: displayValue(element.stress.value, element.stress.unit, presetId).value }),
      ) }],
    },
  ]
}

export function pointSign(value: number): '正' | '负' | '零' {
  return value > 0 ? '正' : value < 0 ? '负' : '零'
}

export interface StructuralChartTableRow {
  readonly key: string
  readonly seriesId: string
  readonly seriesName: string
  readonly x: number
  readonly y: number
  readonly unit: string
  readonly side?: PointSide
  readonly sign: '正' | '负' | '零'
}

export function buildStructuralChartTableRows(chart: CurveChart): readonly StructuralChartTableRow[] {
  return chart.series.flatMap((series) => series.points.map((point, index) => ({
    key: `${series.id}-${index}-${point.side ?? 'none'}`,
    seriesId: series.id,
    seriesName: series.name,
    x: point.x,
    y: point.y,
    unit: series.unit,
    ...(point.side === undefined ? {} : { side: point.side }),
    sign: pointSign(point.y),
  })))
}

export function sideLabel(side?: PointSide): string {
  return side === 'left' ? 'left（左侧）'
    : side === 'right' ? 'right（右侧）'
      : side === 'at' ? 'at（点上）'
        : side === 'continuous' ? 'continuous（连续）' : '—'
}
