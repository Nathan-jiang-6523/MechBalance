import type {
  BeamBalanceResidual,
  BeamFieldValue,
  BeamLoad,
  BeamModel,
  BeamReactions,
  BeamSolution,
  BeamSolveResult,
  BeamValidationError,
  DiscontinuitySide,
} from './types'

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0

function activation(delta: number, side: DiscontinuitySide): boolean {
  return delta > 0 || (delta === 0 && side === 'right')
}

function bracket(delta: number, power: number, side: DiscontinuitySide): number {
  if (!activation(delta, side)) return 0
  if (power === 0) return 1
  return delta ** power
}

function loadForce(load: BeamLoad): number {
  return load.type === 'pointForce'
    ? load.forceN
    : load.type === 'uniformLoad'
      ? load.intensityNPerM * (load.endM - load.startM)
      : 0
}

function loadMomentAboutLeft(load: BeamLoad): number {
  switch (load.type) {
    case 'pointForce':
      return load.forceN * load.positionM
    case 'pointMoment':
      return load.momentNm
    case 'uniformLoad': {
      const forceN = loadForce(load)
      return forceN * ((load.startM + load.endM) / 2)
    }
  }
}

function validate(model: BeamModel): BeamValidationError[] {
  const errors: BeamValidationError[] = []
  if (!isPositiveFinite(model.lengthM)) errors.push({ field: 'L', message: '梁长 L 必须大于 0' })
  if (!isPositiveFinite(model.elasticModulusPa)) errors.push({ field: 'E', message: '弹性模量 E 必须大于 0' })
  if (!isPositiveFinite(model.secondMomentM4)) errors.push({ field: 'I', message: '截面二次矩 I 必须大于 0' })
  if (model.loads.length > 10) errors.push({ field: 'loads', message: '原始载荷合计最多 10 项' })

  const L = model.lengthM
  model.loads.forEach((load, index) => {
    const prefix = `loads.${index}`
    if (load.type === 'pointForce') {
      if (!Number.isFinite(load.forceN)) errors.push({ field: `${prefix}.forceN`, message: '集中力必须为有限数' })
      const within = model.support === 'simplySupported'
        ? load.positionM > 0 && load.positionM < L
        : load.positionM >= 0 && load.positionM <= L
      if (!Number.isFinite(load.positionM) || !within) {
        errors.push({
          field: `${prefix}.positionM`,
          message: model.support === 'simplySupported'
            ? '简支梁集中力位置必须满足 0 < a < L'
            : '悬臂梁集中力位置必须满足 0 ≤ a ≤ L',
        })
      }
    } else if (load.type === 'pointMoment') {
      if (!Number.isFinite(load.momentNm)) errors.push({ field: `${prefix}.momentNm`, message: '集中力矩必须为有限数' })
      if (!Number.isFinite(load.positionM) || load.positionM < 0 || load.positionM > L) {
        errors.push({ field: `${prefix}.positionM`, message: '集中力矩位置必须满足 0 ≤ a ≤ L' })
      }
    } else {
      if (!Number.isFinite(load.intensityNPerM)) errors.push({ field: `${prefix}.intensityNPerM`, message: '均布载荷必须为有限数' })
      if (
        !Number.isFinite(load.startM) ||
        !Number.isFinite(load.endM) ||
        load.startM < 0 ||
        load.endM > L ||
        load.startM >= load.endM
      ) {
        errors.push({ field: `${prefix}.interval`, message: '均布载荷区间必须满足 0 ≤ a < b ≤ L' })
      }
    }
  })
  return errors
}

function simplySupportedReactions(model: BeamModel): BeamReactions {
  const totalForceN = model.loads.reduce((sum, load) => sum + loadForce(load), 0)
  const totalMomentNm = model.loads.reduce((sum, load) => sum + loadMomentAboutLeft(load), 0)
  const rightForceN = -totalMomentNm / model.lengthM
  return {
    leftForceN: -totalForceN - rightForceN,
    rightForceN,
    leftMomentNm: 0,
    rightMomentNm: 0,
  }
}

function cantileverLeftReactions(model: BeamModel): BeamReactions {
  const totalForceN = model.loads.reduce((sum, load) => sum + loadForce(load), 0)
  const totalMomentNm = model.loads.reduce((sum, load) => sum + loadMomentAboutLeft(load), 0)
  return {
    leftForceN: -totalForceN,
    rightForceN: 0,
    leftMomentNm: -totalMomentNm,
    rightMomentNm: 0,
  }
}

interface IntegrationConstants {
  slope: number
  deflection: number
}

function rawIntegratedTerms(
  model: BeamModel,
  reactions: BeamReactions,
  xM: number,
  side: DiscontinuitySide,
): Omit<BeamFieldValue, 'xM' | 'side'> {
  const EI = model.elasticModulusPa * model.secondMomentM4
  let shearN = reactions.leftForceN
  let momentNm = -reactions.leftMomentNm + reactions.leftForceN * xM
  let rotationRad = (-reactions.leftMomentNm * xM + reactions.leftForceN * xM ** 2 / 2) / EI
  let deflectionM = (-reactions.leftMomentNm * xM ** 2 / 2 + reactions.leftForceN * xM ** 3 / 6) / EI

  for (const load of model.loads) {
    if (load.type === 'pointForce') {
      const delta = xM - load.positionM
      shearN += load.forceN * bracket(delta, 0, side)
      momentNm += load.forceN * bracket(delta, 1, side)
      rotationRad += (load.forceN * bracket(delta, 2, side)) / (2 * EI)
      deflectionM += (load.forceN * bracket(delta, 3, side)) / (6 * EI)
    } else if (load.type === 'pointMoment') {
      const delta = xM - load.positionM
      momentNm -= load.momentNm * bracket(delta, 0, side)
      rotationRad -= (load.momentNm * bracket(delta, 1, side)) / EI
      deflectionM -= (load.momentNm * bracket(delta, 2, side)) / (2 * EI)
    } else {
      const fromStart = xM - load.startM
      const fromEnd = xM - load.endM
      const q = load.intensityNPerM
      shearN += q * (bracket(fromStart, 1, side) - bracket(fromEnd, 1, side))
      momentNm += (q / 2) * (bracket(fromStart, 2, side) - bracket(fromEnd, 2, side))
      rotationRad += (q / (6 * EI)) * (bracket(fromStart, 3, side) - bracket(fromEnd, 3, side))
      deflectionM += (q / (24 * EI)) * (bracket(fromStart, 4, side) - bracket(fromEnd, 4, side))
    }
  }
  return { shearN, momentNm, rotationRad, deflectionM }
}

function makeLeftOrSimpleSolution(model: BeamModel): BeamSolution {
  const reactions = model.support === 'simplySupported'
    ? simplySupportedReactions(model)
    : cantileverLeftReactions(model)
  const atL = rawIntegratedTerms(model, reactions, model.lengthM, 'right')
  const constants: IntegrationConstants = model.support === 'simplySupported'
    ? { slope: -atL.deflectionM / model.lengthM, deflection: 0 }
    : { slope: 0, deflection: 0 }

  const evaluate = (xM: number, side: DiscontinuitySide = 'right'): BeamFieldValue => {
    if (!Number.isFinite(xM) || xM < 0 || xM > model.lengthM) {
      throw new RangeError('场求值位置必须满足 0 ≤ x ≤ L')
    }
    const raw = rawIntegratedTerms(model, reactions, xM, side)
    const field: BeamFieldValue = {
      xM,
      side,
      shearN: raw.shearN,
      momentNm: raw.momentNm,
      rotationRad: raw.rotationRad + constants.slope,
      deflectionM: raw.deflectionM + constants.slope * xM + constants.deflection,
    }
    if (![field.shearN, field.momentNm, field.rotationRad, field.deflectionM].every(Number.isFinite)) {
      throw new RangeError('梁场求值产生非有限结果')
    }
    return field
  }

  return {
    model,
    reactions,
    balanceResidual: balance(model, reactions),
    discontinuitiesM: discontinuities(model.loads),
    evaluate,
  }
}

function mirrorRightCantilever(model: BeamModel): BeamSolution {
  const L = model.lengthM
  const localLoads: BeamLoad[] = model.loads.map((load) => {
    if (load.type === 'pointForce') return { ...load, positionM: L - load.positionM }
    if (load.type === 'pointMoment') return { ...load, positionM: L - load.positionM, momentNm: -load.momentNm }
    return {
      ...load,
      startM: L - load.endM,
      endM: L - load.startM,
    }
  })
  const localModel: BeamModel = { ...model, support: 'cantileverLeft', loads: localLoads }
  const local = makeLeftOrSimpleSolution(localModel)
  const reactions: BeamReactions = {
    leftForceN: 0,
    rightForceN: local.reactions.leftForceN,
    leftMomentNm: 0,
    rightMomentNm: -local.reactions.leftMomentNm,
  }

  return {
    model,
    reactions,
    balanceResidual: balance(model, reactions),
    discontinuitiesM: discontinuities(model.loads),
    evaluate(xM, side = 'right') {
      if (!Number.isFinite(xM) || xM < 0 || xM > L) throw new RangeError('场求值位置必须满足 0 ≤ x ≤ L')
      const localSide: DiscontinuitySide = side === 'left' ? 'right' : 'left'
      const field = local.evaluate(L - xM, localSide)
      const mirrored: BeamFieldValue = {
        xM,
        side,
        shearN: -field.shearN,
        momentNm: field.momentNm,
        rotationRad: -field.rotationRad,
        deflectionM: field.deflectionM,
      }
      if (![mirrored.shearN, mirrored.momentNm, mirrored.rotationRad, mirrored.deflectionM].every(Number.isFinite)) {
        throw new RangeError('梁场求值产生非有限结果')
      }
      return mirrored
    },
  }
}

function discontinuities(loads: BeamLoad[]): number[] {
  return [...new Set(loads.flatMap((load) =>
    load.type === 'uniformLoad' ? [load.startM, load.endM] : [load.positionM],
  ))].sort((a, b) => a - b)
}

function balance(model: BeamModel, reactions: BeamReactions): BeamBalanceResidual {
  const forceN =
    reactions.leftForceN +
    reactions.rightForceN +
    model.loads.reduce((sum, load) => sum + loadForce(load), 0)
  const momentAboutLeftNm =
    reactions.leftMomentNm +
    reactions.rightMomentNm +
    reactions.rightForceN * model.lengthM +
    model.loads.reduce((sum, load) => sum + loadMomentAboutLeft(load), 0)
  return { forceN, momentAboutLeftNm }
}

export function solveBeam(model: BeamModel): BeamSolveResult {
  const errors = validate(model)
  if (errors.length > 0) return { ok: false, errors }
  const solution = model.support === 'cantileverRight'
    ? mirrorRightCantilever(model)
    : makeLeftOrSimpleSolution(model)
  const finiteReactions = Object.values(solution.reactions).every(Number.isFinite)
  const finiteBalance = Object.values(solution.balanceResidual).every(Number.isFinite)
  if (!finiteReactions || !finiteBalance) {
    return {
      ok: false,
      errors: [{ field: 'result', message: '求解产生 NaN 或 Infinity，计算失败' }],
    }
  }
  try {
    solution.evaluate(0, 'right')
    solution.evaluate(model.lengthM, 'left')
  } catch {
    return {
      ok: false,
      errors: [{ field: 'result', message: '求解产生 NaN 或 Infinity，计算失败' }],
    }
  }
  if (
    Math.abs(solution.balanceResidual.forceN) > 1e-6 ||
    Math.abs(solution.balanceResidual.momentAboutLeftNm) > 1e-3
  ) {
    return {
      ok: false,
      errors: [{ field: 'balance', message: '全局平衡残差超过容限，计算失败' }],
    }
  }
  return {
    ok: true,
    value: solution,
  }
}
