import { describe, expect, it } from 'vitest'
import circularFixture from '../fixtures/p3-circular-plate.json'
import rectangularFixture from '../fixtures/p3-rectangular-plate.json'
import { solveCircularPlate, solveRectangularPlate, type RectangularPlateInput } from '../../src/core/plate-shell'

const close = (actual: number, expected: number, rtol = 1e-7) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-12, Math.abs(expected) * rtol))

describe('P3 板弯曲独立公开对照', () => {
  it('圆板固支中心闭式独立复算', () => {
    const { a, t, e, nu, q } = circularFixture.common
    const d = e * t ** 3 / (12 * (1 - nu ** 2))
    const independentW = q * a ** 4 / (64 * d)
    const independentM = q * a ** 2 * (1 + nu) / 16
    const production = solveCircularPlate({ calculatorId: 'circular-plate', boundary: 'clamped', radiusM: a, thicknessM: t, material: { elasticModulusPa: e, poissonRatio: nu }, pressurePa: q, evaluationRadiusM: 0 })
    close(independentW, circularFixture.cases[0]!.center.w)
    close(independentM, circularFixture.cases[0]!.center.mr)
    close(production.points[0].deflectionM, independentW)
    close(production.points[0].radialMomentN, independentM)
  })

  it('SSSS 方板中心用独立 501 阶 Navier 双和复算', () => {
    const { a, b, t, e, nu, q } = rectangularFixture.square
    const d = e * t ** 3 / (12 * (1 - nu ** 2))
    let w = 0, mx = 0, my = 0
    for (let m = 1; m <= 501; m += 2) for (let n = 1; n <= 501; n += 2) {
      const sign = Math.sin(m * Math.PI / 2) * Math.sin(n * Math.PI / 2)
      const denominator = ((m / a) ** 2 + (n / b) ** 2)
      const amplitude = 16 * q / (d * Math.PI ** 6 * m * n * denominator ** 2)
      w += amplitude * sign
      mx += d * amplitude * Math.PI ** 2 * ((m / a) ** 2 + nu * (n / b) ** 2) * sign
      my += d * amplitude * Math.PI ** 2 * ((n / b) ** 2 + nu * (m / a) ** 2) * sign
    }
    const truth321 = rectangularFixture.truncations.find((item) => item.n === 321)!
    close(w, truth321.w, 2e-8)
    close(mx, truth321.mx, 2e-7)
    close(my, truth321.mx, 2e-7)
    const input: RectangularPlateInput = { calculatorId: 'rectangular-plate', boundary: 'ssss', lengthXM: a, lengthYM: b, thicknessM: t, material: { elasticModulusPa: e, poissonRatio: nu }, pressurePa: q, evaluationXM: 0, evaluationYM: 0, maxOddIndex: 321, ritzMaxOrder: 8 }
    const production = solveRectangularPlate(input)
    close(production.center.deflectionM, w, 2e-8)
    close(production.center.momentXN, mx, 2e-7)
  })
})
