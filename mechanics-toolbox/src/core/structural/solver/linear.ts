import {
  assertFiniteVector,
  matVec,
  matrixShape,
  norm,
  subtract,
  type Matrix,
  type Vector,
} from '../math'

export type StructuralSolverErrorCode =
  | 'P2_INVALID_DOF_COUNT'
  | 'P2_MATRIX_DIMENSION_MISMATCH'
  | 'P2_DUPLICATE_DOF'
  | 'P2_DOF_OUT_OF_RANGE'
  | 'P2_NO_CONSTRAINTS'
  | 'P2_SINGULAR_STIFFNESS'
  | 'P2_ILL_CONDITIONED_STIFFNESS'

export interface LinearSystemDiagnostics {
  readonly minimumPivot: number
  readonly maximumPivot: number
  readonly pivotRatio: number
  readonly residualNorm: number
}

export interface LinearSystemSolution {
  readonly solution: Vector
  readonly diagnostics: LinearSystemDiagnostics
}

export interface LinearSolverOptions {
  readonly singularRelativeTolerance?: number
  readonly illConditionedPivotRatio?: number
}

export class StructuralSolverError extends Error {
  constructor(
    readonly code: StructuralSolverErrorCode,
    message: string,
    readonly diagnostics?: Partial<LinearSystemDiagnostics>,
  ) {
    super(message)
    this.name = 'StructuralSolverError'
  }
}

export function assertPositiveDofCount(totalDofs: number): void {
  if (!Number.isInteger(totalDofs) || totalDofs <= 0) {
    throw new StructuralSolverError('P2_INVALID_DOF_COUNT', 'totalDofs must be a positive integer')
  }
}

export function assertDofIndex(dof: number, totalDofs: number, label: string): void {
  if (!Number.isInteger(dof) || dof < 0 || dof >= totalDofs) {
    throw new StructuralSolverError(
      'P2_DOF_OUT_OF_RANGE',
      `${label} contains out-of-range DOF ${dof}; expected 0..${totalDofs - 1}`,
    )
  }
}

function assertTolerance(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new RangeError(`${label} must be finite and between 0 and 1`)
  }
}

export function solveLinearSystem(
  matrix: Matrix,
  rightHandSide: Vector,
  options: LinearSolverOptions = {},
): LinearSystemSolution {
  const [rows, columns] = matrixShape(matrix, 'matrix')
  assertFiniteVector(rightHandSide, 'rightHandSide')
  if (rows === 0 || rows !== columns || rightHandSide.length !== rows) {
    throw new StructuralSolverError(
      'P2_MATRIX_DIMENSION_MISMATCH',
      'linear system requires a non-empty square matrix and matching right-hand side',
    )
  }

  const singularTolerance = options.singularRelativeTolerance ?? 1e-14
  const illConditionedRatio = options.illConditionedPivotRatio ?? 1e-12
  assertTolerance(singularTolerance, 'singularRelativeTolerance')
  assertTolerance(illConditionedRatio, 'illConditionedPivotRatio')
  if (singularTolerance >= illConditionedRatio) {
    throw new RangeError('singularRelativeTolerance must be smaller than illConditionedPivotRatio')
  }

  const coefficients = matrix.map((row) => [...row])
  const rhs = [...rightHandSide]
  let scale = 0
  for (const row of coefficients) {
    for (const value of row) scale = Math.max(scale, Math.abs(value))
  }
  if (scale === 0) {
    throw new StructuralSolverError('P2_SINGULAR_STIFFNESS', 'matrix has zero stiffness scale')
  }
  const absoluteSingularTolerance = singularTolerance * scale
  let minimumPivot = Number.POSITIVE_INFINITY
  let maximumPivot = 0

  for (let pivotColumn = 0; pivotColumn < rows; pivotColumn += 1) {
    let pivotRow = pivotColumn
    let pivotMagnitude = Math.abs(coefficients[pivotRow]![pivotColumn]!)
    for (let row = pivotColumn + 1; row < rows; row += 1) {
      const candidate = Math.abs(coefficients[row]![pivotColumn]!)
      if (candidate > pivotMagnitude) {
        pivotMagnitude = candidate
        pivotRow = row
      }
    }
    if (pivotMagnitude <= absoluteSingularTolerance) {
      throw new StructuralSolverError(
        'P2_SINGULAR_STIFFNESS',
        `matrix is singular at pivot ${pivotColumn}`,
        { minimumPivot: Math.min(minimumPivot, pivotMagnitude), maximumPivot },
      )
    }
    if (pivotRow !== pivotColumn) {
      ;[coefficients[pivotColumn], coefficients[pivotRow]] = [
        coefficients[pivotRow]!,
        coefficients[pivotColumn]!,
      ]
      ;[rhs[pivotColumn], rhs[pivotRow]] = [rhs[pivotRow]!, rhs[pivotColumn]!]
    }
    minimumPivot = Math.min(minimumPivot, pivotMagnitude)
    maximumPivot = Math.max(maximumPivot, pivotMagnitude)
    const pivot = coefficients[pivotColumn]![pivotColumn]!
    for (let row = pivotColumn + 1; row < rows; row += 1) {
      const factor = coefficients[row]![pivotColumn]! / pivot
      coefficients[row]![pivotColumn] = 0
      for (let column = pivotColumn + 1; column < rows; column += 1) {
        coefficients[row]![column] = coefficients[row]![column]!
          - factor * coefficients[pivotColumn]![column]!
      }
      rhs[row] = rhs[row]! - factor * rhs[pivotColumn]!
    }
  }

  const pivotRatio = minimumPivot / maximumPivot
  if (pivotRatio < illConditionedRatio) {
    throw new StructuralSolverError(
      'P2_ILL_CONDITIONED_STIFFNESS',
      `matrix pivot ratio ${pivotRatio} is below ${illConditionedRatio}`,
      { minimumPivot, maximumPivot, pivotRatio },
    )
  }

  const solution = Array<number>(rows).fill(0)
  for (let row = rows - 1; row >= 0; row -= 1) {
    let remainder = rhs[row]!
    for (let column = row + 1; column < rows; column += 1) {
      remainder -= coefficients[row]![column]! * solution[column]!
    }
    solution[row] = remainder / coefficients[row]![row]!
  }
  const residualNorm = norm(subtract(matVec(matrix, solution), rightHandSide))
  return { solution, diagnostics: { minimumPivot, maximumPivot, pivotRatio, residualNorm } }
}

/**
 * Symmetric diagonal equilibration for stiffness systems with mixed DOF units.
 * Diagnoses pivots on D^-1 K D^-1, then maps y back through d=D^-1 y.
 */
export function solveEquilibratedStiffnessSystem(
  stiffness: Matrix,
  load: Vector,
  options: LinearSolverOptions = {},
): LinearSystemSolution {
  const [rows, columns] = matrixShape(stiffness, 'stiffness')
  assertFiniteVector(load, 'load')
  if (rows === 0 || rows !== columns || load.length !== rows) {
    throw new StructuralSolverError(
      'P2_MATRIX_DIMENSION_MISMATCH',
      'stiffness solve requires a non-empty square matrix and matching load',
    )
  }
  const scales = stiffness.map((row, index) => {
    const diagonal = row[index]!
    if (!Number.isFinite(diagonal) || diagonal <= 0) {
      throw new StructuralSolverError(
        'P2_SINGULAR_STIFFNESS',
        `stiffness diagonal ${index} must be positive before equilibration`,
      )
    }
    return Math.sqrt(diagonal)
  })
  const equilibrated = stiffness.map((row, rowIndex) => row.map(
    (value, columnIndex) => value / (scales[rowIndex]! * scales[columnIndex]!),
  ))
  const equilibratedLoad = load.map((value, index) => value / scales[index]!)
  const scaled = solveLinearSystem(equilibrated, equilibratedLoad, options)
  const solution = scaled.solution.map((value, index) => value / scales[index]!)
  const residualNorm = norm(subtract(matVec(stiffness, solution), load))
  return { solution, diagnostics: { ...scaled.diagnostics, residualNorm } }
}
