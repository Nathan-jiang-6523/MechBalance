export interface LinearSystemCheck {
  readonly id:
    | 'free-dof-equilibrium'
    | 'free-force-equilibrium'
    | 'free-moment-equilibrium'
    | 'node-equilibrium'
    | 'node-moment-equilibrium'
    | 'element-axial-equilibrium'
    | 'global-force-x-balance'
    | 'global-force-y-balance'
    | 'global-moment-balance'
    | 'strain-energy'
  readonly value: number
  readonly unit: 'N' | 'N*m' | 'J'
  readonly tolerance: number
  readonly passed: boolean
}

export function beamGlobalBalanceChecks(
  appliedLoads: readonly number[],
  reactions: readonly number[],
  nodeCoordinates: readonly Readonly<{ x: number; y: number }>[],
  forceTolerance: number,
  momentTolerance: number,
): readonly [LinearSystemCheck, LinearSystemCheck, LinearSystemCheck] {
  if (appliedLoads.length !== reactions.length || appliedLoads.length !== nodeCoordinates.length * 3) {
    throw new RangeError('梁全局平衡输入维度不一致')
  }
  assertFiniteVector(appliedLoads, 'appliedLoads')
  assertFiniteVector(reactions, 'reactions')
  const resultant = nodeCoordinates.reduce(
    (sum, { x, y }, index) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('节点坐标含非有限数值')
      const fx = appliedLoads[index * 3]! + reactions[index * 3]!
      const fy = appliedLoads[index * 3 + 1]! + reactions[index * 3 + 1]!
      const mz = appliedLoads[index * 3 + 2]! + reactions[index * 3 + 2]!
      return { fx: sum.fx + fx, fy: sum.fy + fy, mz: sum.mz + mz + x * fy - y * fx }
    },
    { fx: 0, fy: 0, mz: 0 },
  )
  const check = (
    id: LinearSystemCheck['id'],
    value: number,
    unit: LinearSystemCheck['unit'],
    tolerance: number,
  ): LinearSystemCheck => ({ id, value: Math.abs(value), unit, tolerance, passed: Math.abs(value) <= tolerance })
  return [
    check('global-force-x-balance', resultant.fx, 'N', forceTolerance),
    check('global-force-y-balance', resultant.fy, 'N', forceTolerance),
    check('global-moment-balance', resultant.mz, 'N*m', momentTolerance),
  ]
}

export function beamFreeDofEquilibriumChecks(
  stiffness: readonly (readonly number[])[],
  displacement: readonly number[],
  load: readonly number[],
  freeDofs: readonly number[],
  forceTolerance: number,
  momentTolerance: number,
): readonly [LinearSystemCheck, LinearSystemCheck] {
  if ([forceTolerance, momentTolerance].some((value) => value < 0 || !Number.isFinite(value))) {
    throw new RangeError('梁平衡容差无效')
  }
  const internal = matrixVectorProduct(stiffness, displacement)
  const residual = (dof: number) => Math.abs(internal[dof]! - load[dof]!)
  const forceResidual = Math.max(0, ...freeDofs.filter((dof) => dof % 3 !== 2).map(residual))
  const momentResidual = Math.max(0, ...freeDofs.filter((dof) => dof % 3 === 2).map(residual))
  return [
    {
      id: 'free-force-equilibrium',
      value: forceResidual,
      unit: 'N',
      tolerance: forceTolerance,
      passed: forceResidual <= forceTolerance,
    },
    {
      id: 'free-moment-equilibrium',
      value: momentResidual,
      unit: 'N*m',
      tolerance: momentTolerance,
      passed: momentResidual <= momentTolerance,
    },
  ]
}

function assertFiniteVector(values: readonly number[], label: string): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`${label} 含非有限数值`)
  }
}

export function matrixVectorProduct(
  matrix: readonly (readonly number[])[],
  vector: readonly number[],
): number[] {
  if (matrix.some((row) => row.length !== vector.length)) {
    throw new RangeError('矩阵与向量维度不一致')
  }
  assertFiniteVector(vector, 'vector')
  return matrix.map((row) => {
    assertFiniteVector(row, 'matrix')
    return row.reduce((sum, value, index) => sum + value * vector[index]!, 0)
  })
}

export function freeDofEquilibriumCheck(
  stiffness: readonly (readonly number[])[],
  displacement: readonly number[],
  load: readonly number[],
  freeDofs: readonly number[],
  tolerance: number,
): LinearSystemCheck {
  if (load.length !== displacement.length || tolerance < 0 || !Number.isFinite(tolerance)) {
    throw new RangeError('平衡检查输入无效')
  }
  const internal = matrixVectorProduct(stiffness, displacement)
  const residual = Math.max(0, ...freeDofs.map((dof) => Math.abs(internal[dof]! - load[dof]!)))
  return { id: 'free-dof-equilibrium', value: residual, unit: 'N', tolerance, passed: residual <= tolerance }
}

export function strainEnergyCheck(
  stiffness: readonly (readonly number[])[],
  displacement: readonly number[],
  load: readonly number[],
  tolerance: number,
): LinearSystemCheck {
  if (load.length !== displacement.length || tolerance < 0 || !Number.isFinite(tolerance)) {
    throw new RangeError('能量检查输入无效')
  }
  const internal = matrixVectorProduct(stiffness, displacement)
  const twiceStrainEnergy = displacement.reduce((sum, value, index) => sum + value * internal[index]!, 0)
  const externalWorkAtFullLoad = displacement.reduce((sum, value, index) => sum + value * load[index]!, 0)
  const residual = Math.abs(twiceStrainEnergy - externalWorkAtFullLoad)
  return { id: 'strain-energy', value: residual, unit: 'J', tolerance, passed: residual <= tolerance }
}
