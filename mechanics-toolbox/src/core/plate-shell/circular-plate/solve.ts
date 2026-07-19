import { evaluateThinPlateRatio, summarizeApplicability } from '../applicability'
import type { ApplicabilityCheck } from '../results'
import { CircularPlateInputError, type CircularPlateDraftInput, type CircularPlateInput, type CircularPlatePoint, type CircularPlateResult } from './types'

function finite(value:number,message:string){if(!Number.isFinite(value))throw new CircularPlateInputError(message);return Math.abs(value)<1e-14?0:value}
export function validateCircularPlateInput(input:CircularPlateDraftInput):void{
  if(!input.boundary||!['clamped','simply-supported'].includes(input.boundary))throw new CircularPlateInputError('必须显式选择圆板周边条件')
  for(const [label,value] of [['半径',input.radiusM],['厚度',input.thicknessM],['弹性模量',input.material.elasticModulusPa]] as const){if(!Number.isFinite(value))throw new CircularPlateInputError(`${label}输入必须为有限数`);if(value<=0)throw new CircularPlateInputError(`${label}必须大于 0`)}
  if(!Number.isFinite(input.material.poissonRatio)||input.material.poissonRatio<=-1||input.material.poissonRatio>=.5)throw new CircularPlateInputError('泊松比必须满足 -1<ν<0.5')
  if(!Number.isFinite(input.pressurePa))throw new CircularPlateInputError('载荷输入必须为有限数')
  if(!Number.isFinite(input.evaluationRadiusM)||input.evaluationRadiusM<0||input.evaluationRadiusM>input.radiusM)throw new CircularPlateInputError('求值半径必须满足 0≤r≤a')
}
function point(input:CircularPlateInput,r:number,label:CircularPlatePoint['label'],d:number):CircularPlatePoint{
  const{radiusM:a,pressurePa:q,thicknessM:t}=input;const nu=input.material.poissonRatio;const a2=a*a,r2=r*r;let w:number,slope:number,mr:number,mt:number
  if(input.boundary==='clamped'){w=q*(a2-r2)**2/(64*d);slope=-q*r*(a2-r2)/(16*d);mr=q*((1+nu)*a2-(3+nu)*r2)/16;mt=q*((1+nu)*a2-(1+3*nu)*r2)/16}else{const c=(5+nu)/(1+nu);w=q*(a2-r2)*(c*a2-r2)/(64*d);slope=-q*r*((c+1)*a2-2*r2)/(32*d);mr=q*(3+nu)*(a2-r2)/16;mt=q*((3+nu)*a2-(1+3*nu)*r2)/16}
  const factor=6/(t*t);return{label,radiusM:r,deflectionM:finite(w,'圆板挠度超出范围'),slope:finite(slope,'圆板斜率超出范围'),radialMomentN:finite(mr,'径向弯矩超出范围'),hoopMomentN:finite(mt,'环向弯矩超出范围'),shearNPerM:finite(-q*r/2,'剪力超出范围'),positiveRadialStressPa:finite(factor*mr,'径向应力超出范围'),positiveHoopStressPa:finite(factor*mt,'环向应力超出范围'),negativeRadialStressPa:finite(-factor*mr,'径向应力超出范围'),negativeHoopStressPa:finite(-factor*mt,'环向应力超出范围')}
}
export function solveCircularPlate(input:CircularPlateInput):CircularPlateResult{validateCircularPlateInput(input);const{radiusM:a,thicknessM:t,pressurePa:q}=input;const{elasticModulusPa:e,poissonRatio:nu}=input.material;const d=finite(e*t**3/(12*(1-nu**2)),'弯曲刚度超出范围');const center=point(input,0,'中心',d),evaluation=point(input,input.evaluationRadiusM,'求值位置',d),edge=point(input,a,'边缘',d);const thin=evaluateThinPlateRatio(t,a);const smallRatio=Math.abs(center.deflectionM)/t;const small:ApplicabilityCheck={code:'P3-CP-SMALL-DEFLECTION',label:'圆板 |w|max/t',level:smallRatio>.2?'warning':smallRatio===.2?'at-limit':'within',actual:smallRatio,limit:.2,comparator:'<=',message:smallRatio>.2?'|w|max/t 超过 0.20；大挠度与膜效应未计入':'小挠度护栏内'};const applicability=summarizeApplicability([thin,small]);return{formulaId:input.boundary==='clamped'?'P3-CP-CLAMPED-UNIFORM-1':'P3-CP-SIMPLE-UNIFORM-1',solutionNature:'exact-closed-form',boundary:input.boundary,rigidityNm:d,points:[center,evaluation,edge],maximumDeflectionM:center.deflectionM,maximumDeflectionRadiusM:0,totalReactionN:finite(-Math.PI*a*a*q,'总反力超出范围'),edgeLineReactionNPerM:edge.shearNPerM,applicability,warnings:applicability.checks.filter(c=>c.level!=='within').map(c=>c.message)}}
