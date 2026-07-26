import type { SectionCalculatorKind } from '../../core/sections'

export interface SectionFormula {
  id: string
  label: string
  latex: string
}

export interface SectionFormulaContent {
  title: string
  formulas: readonly SectionFormula[]
  notes: readonly string[]
}

const VERSION = 'P1-SEC-v1.1'

const formula = (id: string, label: string, latex: string): SectionFormula => ({
  id,
  label,
  latex,
})

export const SECTION_FORMULA_VERSION = VERSION

export const SECTION_FORMULA_CATALOG: Readonly<Record<SectionCalculatorKind, SectionFormulaContent>> = {
  rectangle: {
    title: '矩形',
    formulas: [
      formula(
        'P1-SEC-RECT-001',
        '面积、惯性矩与扭转常数',
        String.raw`\begin{aligned}
          A&=bh,& I_x&=\frac{bh^3}{12},& I_y&=\frac{hb^3}{12}\\
          J_t&=\frac{ab_s^3}{3}\left[1-0.63\frac{b_s}{a}+0.052\left(\frac{b_s}{a}\right)^5\right],
          &&b_s=\min(b,h),\ a=\max(b,h)
        \end{aligned}`,
      ),
    ],
    notes: ['Jt 为 Saint-Venant 矩形截面工程近似式。'],
  },
  hollowRectangle: {
    title: '空心矩形',
    formulas: [
      formula(
        'P1-SEC-HRECT-001',
        '面积、惯性矩与薄壁闭口扭转常数',
        String.raw`\begin{aligned}
          A&=BH-bh,& I_x&=\frac{BH^3-bh^3}{12},& I_y&=\frac{HB^3-hb^3}{12}\\
          B_m&=\frac{B+b}{2},& H_m&=\frac{H+h}{2},& t&=\frac{B-b}{2}=\frac{H-h}{2}\\
          J_t&=\frac{4(B_mH_m)^2}{2(B_m+H_m)/t}
        \end{aligned}`,
      ),
    ],
    notes: ['扭转常数仅适用于四壁等厚的薄壁闭口截面。'],
  },
  solidCircle: {
    title: '实心圆',
    formulas: [
      formula(
        'P1-SEC-CIRCLE-001',
        '面积、惯性矩与扭转常数',
        String.raw`A=\frac{\pi d^2}{4},\qquad I_x=I_y=\frac{\pi d^4}{64},\qquad J_p=J_t=\frac{\pi d^4}{32}`,
      ),
    ],
    notes: ['圆截面中极惯性矩 Jp 与 Saint-Venant 扭转常数 Jt 相等。'],
  },
  circularTube: {
    title: '圆管',
    formulas: [
      formula(
        'P1-SEC-TUBE-001',
        '面积、惯性矩与扭转常数',
        String.raw`A=\frac{\pi(D^2-d^2)}{4},\qquad I_x=I_y=\frac{\pi(D^4-d^4)}{64},\qquad J_p=J_t=\frac{\pi(D^4-d^4)}{32}`,
      ),
    ],
    notes: ['D、d 分别为外径和内径。'],
  },
  regularHexagon: {
    title: '正六边形',
    formulas: [
      formula(
        'P1-SEC-HEX-001',
        '边长、外接圆半径与截面性质',
        String.raw`s=R,\qquad A=\frac{3\sqrt{3}}{2}R^2,\qquad I_x=I_y=\frac{5\sqrt{3}}{16}R^4`,
      ),
    ],
    notes: ['边长 s 与外接圆半径 R 是互斥输入，两种方式得到同一几何截面。'],
  },
  regularOctagon: {
    title: '正八边形',
    formulas: [
      formula(
        'P1-SEC-OCT-001',
        '边长、外接圆半径与截面性质',
        String.raw`s=2R\sin\frac{\pi}{8},\qquad A=2\sqrt{2}R^2,\qquad I_x=I_y=\frac{1+2\sqrt{2}}{6}R^4`,
      ),
    ],
    notes: ['边长 s 与外接圆半径 R 是互斥输入，两种方式通过所示关系换算。'],
  },
  semicircle: {
    title: '半圆',
    formulas: [
      formula(
        'P1-SEC-SEMICIRCLE-001',
        '形心与形心轴惯性矩',
        String.raw`\begin{aligned}
          r&=\frac d2,& A&=\frac{\pi r^2}{2},& \bar y&=\frac{4r}{3\pi}\\
          I_x&=\frac{\pi r^4}{8}-A\bar y^2,& I_y&=\frac{\pi r^4}{8}
        \end{aligned}`,
      ),
    ],
    notes: ['形心坐标 ȳ 从直径边向圆弧方向量取。'],
  },
  semiAnnulus: {
    title: '半圆环',
    formulas: [
      formula(
        'P1-SEC-SEMIANN-001',
        '形心与形心轴惯性矩',
        String.raw`\begin{aligned}
          R&=\frac D2,\quad r=\frac d2,\quad A=\frac{\pi(R^2-r^2)}2\\
          \bar y&=\frac{4(R^3-r^3)}{3\pi(R^2-r^2)}\\
          I_x&=\frac{\pi(R^4-r^4)}8-A\bar y^2,\qquad I_y=\frac{\pi(R^4-r^4)}8
        \end{aligned}`,
      ),
    ],
    notes: ['形心坐标 ȳ 从公共直径边量取。'],
  },
  circularSector: {
    title: '圆扇形',
    formulas: [
      formula(
        'P1-SEC-SECTOR-001',
        '形心与形心轴惯性矩',
        String.raw`\begin{aligned}
          A&=\frac{\theta r^2}{2},& \bar y&=\frac{4r\sin(\theta/2)}{3\theta}\\
          I_x&=\frac{r^4(\theta+\sin\theta)}8-A\bar y^2,&
          I_y&=\frac{r^4(\theta-\sin\theta)}8
        \end{aligned}`,
      ),
    ],
    notes: ['公式中的夹角 θ 使用弧度，界面会将角度输入自动换算。'],
  },
  circularSegment: {
    title: '圆弓形',
    formulas: [
      formula(
        'P1-SEC-SEGMENT-001',
        '形心与形心轴惯性矩',
        String.raw`\begin{aligned}
          A&=\frac{r^2(\theta-\sin\theta)}2,\quad
          \bar y=\frac{4r\sin^3(\theta/2)}{3(\theta-\sin\theta)}\\
          I_x&=\frac{r^4(\theta-\sin\theta\cos\theta)}8-A\bar y^2\\
          I_y&=\frac{r^4}{8}\left[\theta-\sin\theta-\frac23\sin\theta\sin^2\frac\theta2\right]
        \end{aligned}`,
      ),
    ],
    notes: ['θ 为圆心夹角且使用弧度；ȳ 从圆心沿对称轴量取。'],
  },
  annularSector: {
    title: '圆环扇形',
    formulas: [
      formula(
        'P1-SEC-ANNSECTOR-001',
        '形心与形心轴惯性矩',
        String.raw`\begin{aligned}
          A&=\frac{\theta(R^2-r^2)}2,\quad
          \bar y=\frac{4\sin(\theta/2)(R^3-r^3)}{3\theta(R^2-r^2)}\\
          I_x&=\frac{(R^4-r^4)(\theta+\sin\theta)}8-A\bar y^2\\
          I_y&=\frac{(R^4-r^4)(\theta-\sin\theta)}8
        \end{aligned}`,
      ),
    ],
    notes: ['θ 为圆心夹角且使用弧度；R、r 分别为外半径和内半径。'],
  },
  ellipse: {
    title: '椭圆',
    formulas: [
      formula(
        'P1-SEC-ELLIPSE-001',
        '面积与形心轴惯性矩',
        String.raw`A=\pi ab,\qquad I_x=\frac{\pi ab^3}{4},\qquad I_y=\frac{\pi a^3b}{4}`,
      ),
    ],
    notes: ['a、b 分别为水平半轴和竖直半轴。'],
  },
  hollowEllipse: {
    title: '空心椭圆',
    formulas: [
      formula(
        'P1-SEC-HELLIPSE-001',
        '面积与形心轴惯性矩',
        String.raw`\begin{aligned}
          A&=\pi(ab-a_1b_1)\\
          I_x&=\frac{\pi(ab^3-a_1b_1^3)}4,\qquad
          I_y=\frac{\pi(a^3b-a_1^3b_1)}4
        \end{aligned}`,
      ),
    ],
    notes: ['内外椭圆同心且主轴方向一致。'],
  },
  squareCircularHole: {
    title: '方形中心圆孔',
    formulas: [
      formula(
        'P1-SEC-SQHOLE-001',
        '扣除法面积与惯性矩',
        String.raw`A=a^2-\frac{\pi d^2}{4},\qquad I_x=I_y=\frac{a^4}{12}-\frac{\pi d^4}{64}`,
      ),
    ],
    notes: ['圆孔位于正方形中心。'],
  },
  circleCrossSlot: {
    title: '圆形中央通槽',
    formulas: [
      formula(
        'P1-SEC-CIRSLOT-001',
        '手册扣除模型',
        String.raw`\begin{aligned}
          A&=\frac{\pi d^2}{4}-d_1d\\
          I_x&=\frac{\pi d^4}{64}-\frac{d_1d^3}{12},\qquad
          I_y=\frac{\pi d^4}{64}-\frac{dd_1^3}{12}
        \end{aligned}`,
      ),
    ],
    notes: ['按贯穿整个圆直径的中心矩形槽扣除模型计算。'],
  },
  rectangleCrossSlot: {
    title: '矩形中央横槽',
    formulas: [
      formula(
        'P1-SEC-RECTSLOT-001',
        '扣除法面积与惯性矩',
        String.raw`A=b(H-h),\qquad I_x=\frac{b(H^3-h^3)}{12},\qquad I_y=\frac{b^3(H-h)}{12}`,
      ),
    ],
    notes: ['横槽贯穿矩形全宽并关于截面中心线对称。'],
  },
}
