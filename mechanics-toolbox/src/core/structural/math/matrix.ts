export type Vector = readonly number[]
export type Matrix = readonly (readonly number[])[]

export type StructuralMathErrorCode =
  | 'P2_INVALID_MATRIX_SIZE'
  | 'P2_MATRIX_DIMENSION_MISMATCH'
  | 'P2_NONFINITE_MATRIX_VALUE'

export class StructuralMathError extends Error {
  constructor(
    readonly code: StructuralMathErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'StructuralMathError'
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new StructuralMathError('P2_INVALID_MATRIX_SIZE', `${label} must be a non-negative integer`)
  }
}

export function assertFiniteVector(vector: Vector, label = 'vector'): void {
  for (let index = 0; index < vector.length; index += 1) {
    if (!Number.isFinite(vector[index])) {
      throw new StructuralMathError(
        'P2_NONFINITE_MATRIX_VALUE',
        `${label}[${index}] must be finite`,
      )
    }
  }
}

export function matrixShape(matrix: Matrix, label = 'matrix'): readonly [number, number] {
  const rows = matrix.length
  const columns = rows === 0 ? 0 : matrix[0]!.length
  for (let row = 0; row < rows; row += 1) {
    if (matrix[row]!.length !== columns) {
      throw new StructuralMathError(
        'P2_MATRIX_DIMENSION_MISMATCH',
        `${label} must be rectangular`,
      )
    }
    assertFiniteVector(matrix[row]!, `${label}[${row}]`)
  }
  return [rows, columns]
}

export function zeros(rows: number, columns: number): number[][] {
  assertNonNegativeInteger(rows, 'rows')
  assertNonNegativeInteger(columns, 'columns')
  return Array.from({ length: rows }, () => Array<number>(columns).fill(0))
}

export function zeroVector(length: number): number[] {
  assertNonNegativeInteger(length, 'length')
  return Array<number>(length).fill(0)
}

export function identity(size: number): number[][] {
  const result = zeros(size, size)
  for (let index = 0; index < size; index += 1) result[index]![index] = 1
  return result
}

export function transpose(matrix: Matrix): number[][] {
  const [rows, columns] = matrixShape(matrix)
  const result = zeros(columns, rows)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      result[column]![row] = matrix[row]![column]!
    }
  }
  return result
}

export function matVec(matrix: Matrix, vector: Vector): number[] {
  const [rows, columns] = matrixShape(matrix)
  assertFiniteVector(vector)
  if (columns !== vector.length) {
    throw new StructuralMathError(
      'P2_MATRIX_DIMENSION_MISMATCH',
      `matrix columns (${columns}) must equal vector length (${vector.length})`,
    )
  }
  const result = zeroVector(rows)
  for (let row = 0; row < rows; row += 1) result[row] = dot(matrix[row]!, vector)
  return result
}

export function dot(left: Vector, right: Vector): number {
  assertFiniteVector(left, 'left')
  assertFiniteVector(right, 'right')
  if (left.length !== right.length) {
    throw new StructuralMathError(
      'P2_MATRIX_DIMENSION_MISMATCH',
      `vector lengths differ (${left.length} and ${right.length})`,
    )
  }
  let result = 0
  for (let index = 0; index < left.length; index += 1) result += left[index]! * right[index]!
  return result
}

export function norm(vector: Vector): number {
  return Math.sqrt(dot(vector, vector))
}

export function add(left: Vector, right: Vector): number[] {
  return combineVectors(left, right, 1)
}

export function subtract(left: Vector, right: Vector): number[] {
  return combineVectors(left, right, -1)
}

function combineVectors(left: Vector, right: Vector, rightScale: number): number[] {
  assertFiniteVector(left, 'left')
  assertFiniteVector(right, 'right')
  if (left.length !== right.length) {
    throw new StructuralMathError(
      'P2_MATRIX_DIMENSION_MISMATCH',
      `vector lengths differ (${left.length} and ${right.length})`,
    )
  }
  return left.map((value, index) => value + rightScale * right[index]!)
}

export function scale(vector: Vector, factor: number): number[] {
  assertFiniteVector(vector)
  if (!Number.isFinite(factor)) {
    throw new StructuralMathError('P2_NONFINITE_MATRIX_VALUE', 'scale factor must be finite')
  }
  return vector.map((value) => value * factor)
}
