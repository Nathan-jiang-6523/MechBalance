import type { CircularPlateBoundary, IsotropicElasticMaterial } from '../types'
import type { ApplicabilitySummary } from '../results'

export interface CircularPlateInput { readonly calculatorId:'circular-plate'; readonly boundary:CircularPlateBoundary; readonly radiusM:number; readonly thicknessM:number; readonly material:IsotropicElasticMaterial; readonly pressurePa:number; readonly evaluationRadiusM:number }
export interface CircularPlateDraftInput extends Omit<CircularPlateInput,'boundary'>{readonly boundary:CircularPlateBoundary|null}
export interface CircularPlatePoint { readonly label:'中心'|'求值位置'|'边缘'; readonly radiusM:number; readonly deflectionM:number; readonly slope:number; readonly radialMomentN:number; readonly hoopMomentN:number; readonly shearNPerM:number; readonly positiveRadialStressPa:number; readonly positiveHoopStressPa:number; readonly negativeRadialStressPa:number; readonly negativeHoopStressPa:number }
export interface CircularPlateResult { readonly formulaId:string; readonly solutionNature:'exact-closed-form'; readonly boundary:CircularPlateBoundary; readonly rigidityNm:number; readonly points:readonly[CircularPlatePoint,CircularPlatePoint,CircularPlatePoint]; readonly maximumDeflectionM:number; readonly maximumDeflectionRadiusM:0; readonly totalReactionN:number; readonly edgeLineReactionNPerM:number; readonly applicability:ApplicabilitySummary; readonly warnings:readonly string[] }
export class CircularPlateInputError extends RangeError{constructor(message:string){super(message);this.name='CircularPlateInputError'}}
