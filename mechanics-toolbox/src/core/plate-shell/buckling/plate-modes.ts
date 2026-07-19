export interface PlateMode {
  readonly m: number
  readonly n: 1
  readonly coefficient: number
  readonly criticalLineLoadNPerM: number
}

export function plateMode(
  lengthXM: number,
  widthYM: number,
  rigidityNm: number,
  m: number,
): PlateMode {
  const aspectTerm = m * widthYM / lengthXM
  const coefficient = (aspectTerm + 1 / aspectTerm) ** 2
  return {
    m,
    n: 1,
    coefficient,
    criticalLineLoadNPerM: coefficient * Math.PI ** 2 * rigidityNm / widthYM ** 2,
  }
}

export function minimumPlateMode(
  lengthXM: number,
  widthYM: number,
  rigidityNm: number,
  maximumM: number,
): PlateMode {
  let best = plateMode(lengthXM, widthYM, rigidityNm, 1)
  for (let m = 2; m <= maximumM; m += 1) {
    const candidate = plateMode(lengthXM, widthYM, rigidityNm, m)
    if (candidate.criticalLineLoadNPerM < best.criticalLineLoadNPerM) best = candidate
  }
  return best
}
