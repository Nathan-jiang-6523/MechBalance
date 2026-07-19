import type { CurveChart, CurvePoint, CurveSeries, PointSide } from '../../../core/contracts'
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

function quantityRow(
  key: string,
  label: string,
  quantity: StructuralQuantity,
  options: Pick<StructuralDisplayRow, 'objectId' | 'position' | 'state' | 'note'> = {},
): StructuralDisplayRow {
  return { key, label, value: quantity.value, unit: quantity.unit, positive: quantity.positive, ...options }
}

function endForceRows(endForce: ElementEndForceResult): StructuralDisplayRow[] {
  const coordinate = endForce.coordinateSystem === 'local' ? '局部' : '全局'
  return (['nodeI', 'nodeJ'] as const).flatMap((end) => {
    const endLabel = end === 'nodeI' ? 'i 端' : 'j 端'
    return (['fx', 'fy', 'mz'] as const).map((component) => quantityRow(
      `end-${endForce.elementId}-${coordinate}-${end}-${component}`,
      `${coordinate} ${endLabel} ${component.toUpperCase()}`,
      endForce[end][component],
      { objectId: endForce.elementId },
    ))
  })
}

function stationRows(station: ElementStationResult): StructuralDisplayRow[] {
  const position = { value: station.x.value, unit: station.x.unit, side: station.side }
  const rows = [
    quantityRow(`station-${station.elementId}-${station.x.value}-${station.side}-N`, '轴力 N', station.axialForce, {
      objectId: station.elementId, position,
    }),
    quantityRow(`station-${station.elementId}-${station.x.value}-${station.side}-V`, '剪力 V', station.shearForce, {
      objectId: station.elementId, position,
    }),
    quantityRow(`station-${station.elementId}-${station.x.value}-${station.side}-M`, '弯矩 M', station.bendingMoment, {
      objectId: station.elementId, position,
    }),
  ]
  if (station.rotation) rows.push(quantityRow(
    `station-${station.elementId}-${station.x.value}-${station.side}-theta`, '转角 θ', station.rotation,
    { objectId: station.elementId, position },
  ))
  if (station.displacement) rows.push(quantityRow(
    `station-${station.elementId}-${station.x.value}-${station.side}-v`, '位移 v', station.displacement,
    { objectId: station.elementId, position },
  ))
  station.fiberStresses?.forEach((fiber, index) => rows.push(quantityRow(
    `station-${station.elementId}-${station.x.value}-${station.side}-stress-${index}`,
    `纤维应力 σ（y=${fiber.y.value} ${fiber.y.unit}）`,
    fiber.stress,
    { objectId: station.elementId, position, note: fiber.y.positive },
  )))
  return rows
}

function isUnconfirmedUtilization(text: string): boolean {
  return /utili[sz]ation|利用率/i.test(text)
}

export function buildStructuralResultRows(result: StructuralScreenResult): StructuralResultRows {
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
    quantityRow(`node-${node.nodeId}-u`, '节点位移 u', node.u, { objectId: node.nodeId }),
    quantityRow(`node-${node.nodeId}-v`, '节点位移 v', node.v, { objectId: node.nodeId }),
    ...(node.theta ? [quantityRow(`node-${node.nodeId}-theta`, '节点转角 θ', node.theta, {
      objectId: node.nodeId,
    })] : []),
  ]) : []
  const reactions = 'reactions' in data ? data.reactions.flatMap((node) => [
    quantityRow(`reaction-${node.nodeId}-fx`, '支座反力 Fx', node.fx, { objectId: node.nodeId }),
    quantityRow(`reaction-${node.nodeId}-fy`, '支座反力 Fy', node.fy, { objectId: node.nodeId }),
    ...(node.mz ? [quantityRow(`reaction-${node.nodeId}-mz`, '支座反力矩 Mz', node.mz, {
      objectId: node.nodeId,
    })] : []),
  ]) : []
  let elements: StructuralDisplayRow[] = []
  if (data.analysis === 'beam' || data.analysis === 'frame') {
    elements = [...data.endForces.flatMap(endForceRows), ...data.stations.flatMap(stationRows)]
  } else if (data.analysis === 'truss') {
    elements = data.elements.flatMap((element) => [
      quantityRow(`truss-${element.elementId}-N`, '杆件轴力 N', element.axialForce, {
        objectId: element.elementId, state: element.state,
      }),
      quantityRow(`truss-${element.elementId}-stress`, '杆件正应力 σ', element.stress, {
        objectId: element.elementId, state: element.state,
      }),
    ])
  } else if (data.analysis === 'influence-line') {
    elements = data.ordinates.map((ordinate, index) => quantityRow(
      `ordinate-${index}-${ordinate.side}`, `影响线纵坐标 ${data.responseId}`, ordinate.ordinate,
      { position: { value: ordinate.position.value, unit: ordinate.position.unit, side: ordinate.side } },
    ))
  } else {
    elements = data.axlePositions.map((axle) => quantityRow(
      `axle-${axle.axleId}`, '控制轴位置', axle.position,
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
): CurveSeries[] {
  return [...groupStations(stations)].flatMap(([elementId, values]) => {
    const points = values.flatMap((station): CurvePoint[] => {
      const quantity = station[field]
      return quantity ? [{ x: station.x.value, y: quantity.value, side: station.side }] : []
    })
    if (points.length === 0) return []
    const quantity = values.find((station) => station[field] !== undefined)?.[field]
    return [{ id: `${elementId}-${field}`, name: `${elementId} · ${name}`, kind: 'line', unit: quantity!.unit, points }]
  })
}

function chart(id: string, title: string, series: readonly CurveSeries[]): CurveChart {
  return { id, title, xLabel: '局部位置 x', xUnit: 'm', series }
}

/** Build display curves only from confirmed result values; performs no mechanics calculation. */
export function buildStructuralCharts(result: StructuralScreenResult): readonly CurveChart[] {
  if (result.status === 'error' || result.structural.analysis === 'moving-load') return []
  if (result.charts.length > 0) return result.charts
  const data = result.structural
  if (data.analysis === 'beam' || data.analysis === 'frame') {
    const charts = [
      chart('structural-N', '轴力 N', stationSeries(data.stations, 'axialForce', 'N')),
      chart('structural-V', '剪力 V', stationSeries(data.stations, 'shearForce', 'V')),
      chart('structural-M', '弯矩 M', stationSeries(data.stations, 'bendingMoment', 'M')),
    ]
    if (data.analysis === 'beam') {
      charts.push(
        chart('structural-theta', '转角 θ', stationSeries(data.stations, 'rotation', 'θ')),
        chart('structural-v', '位移 v', stationSeries(data.stations, 'displacement', 'v')),
      )
    }
    return charts.filter(({ series }) => series.length > 0)
  }
  if (data.analysis === 'influence-line') {
    return [{
      id: `influence-${data.responseId}`,
      title: `影响线 · ${data.responseId}`,
      xLabel: '位置 x',
      xUnit: 'm',
      series: [{
        id: data.responseId,
        name: data.responseId,
        kind: 'line',
        unit: data.ordinates[0]?.ordinate.unit ?? '1',
        points: data.ordinates.map((ordinate) => ({
          x: ordinate.position.value, y: ordinate.ordinate.value, side: ordinate.side,
        })),
      }],
    }]
  }
  const points = data.elements.map((_, index) => index + 1)
  return [
    {
      id: 'truss-axial', title: '桁架杆件轴力', xLabel: '单元序号', xUnit: '1',
      series: [{ id: 'truss-N', name: 'N', kind: 'scatter', unit: 'N', points: data.elements.map(
        (element, index) => ({ x: points[index]!, y: element.axialForce.value }),
      ) }],
    },
    {
      id: 'truss-stress', title: '桁架杆件正应力', xLabel: '单元序号', xUnit: '1',
      series: [{ id: 'truss-stress', name: 'σ', kind: 'scatter', unit: 'Pa', points: data.elements.map(
        (element, index) => ({ x: points[index]!, y: element.stress.value }),
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
