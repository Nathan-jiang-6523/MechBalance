# P1 截面性质手册扩展公式登记

- 文档版本：`1.0.0`
- 登记日期：`2026-07-26`
- 适用模块：截面性质工作台
- 公式来源：用户本地《英科宇机械工程师设计手册》电子版，`01110.htm`“截面力学特性的计算公式”、`01111.htm`“各种截面的力学特性”
- 实现：`src/core/sections/sectionProperties.ts`
- 回归测试：`qa/unit/sections/sectionProperties.test.ts`

## 1. 统一约定

- `x` 水平向右，`y` 竖直向上。
- `Ix`、`Iy`、`Ixy` 均为形心轴截面二次矩/惯性积。
- `Wx+`、`Wx-`、`Wy+`、`Wy-` 分别按形心到正、负侧最远边缘距离计算。
- `Jp=Ix+Iy`。
- 本手册表未给这些新增截面的 Saint-Venant 扭转常数，因此 `Jt=null`；界面显示“手册未提供”，不得用 `Jp` 代替。
- 圆扇形、圆弓形、圆环扇形使用完整夹角 `θ`，范围 `0<θ≤π`。界面可输入度或弧度。

## 2. 正六边形与正八边形

`R` 为外接圆半径，`s` 为边长。界面提供两种互斥输入方式：输入 `s` 或输入 `R`，同一次计算不能同时使用两者。

任意正 `n` 边形：

\[
s=2R\sin\frac{\pi}{n},\qquad
R=\frac{s}{2\sin(\pi/n)}
\]

因此正六边形 `s=R`；正八边形 `s=2R\sin(\pi/8)`。

正六边形：

\[
A=\frac{3\sqrt3}{2}R^2,\qquad
I_x=I_y=\frac{5\sqrt3}{16}R^4
\]

正八边形：

\[
A=2\sqrt2R^2,\qquad
I_x=I_y=\frac{1+2\sqrt2}{6}R^4
\]

实现采用标准多边形面积、形心和二次矩积分，避免手册小数系数造成累计误差。正八边形的水平、竖直最远边缘为内切圆半径 `R cos(π/8)`。

## 3. 半圆与半圆环

半圆以直径中点为参考原点，材料位于 `y≥0`；`r=d/2`：

\[
A=\frac{\pi r^2}{2},\qquad
\bar y=\frac{4r}{3\pi}
\]

\[
I_x=\frac{\pi r^4}{8}-A\bar y^2,\qquad
I_y=\frac{\pi r^4}{8}
\]

半圆环以共同圆心为参考原点，外、内半径为 `R`、`r`：

\[
A=\frac{\pi}{2}(R^2-r^2),\qquad
\bar y=\frac{4(R^3-r^3)}{3\pi(R^2-r^2)}
\]

\[
I_x=\frac{\pi}{8}(R^4-r^4)-A\bar y^2,\qquad
I_y=\frac{\pi}{8}(R^4-r^4)
\]

## 4. 圆扇形、圆弓形与圆环扇形

圆扇形以圆心为参考原点、关于 `y` 轴对称：

\[
A=\frac{\theta r^2}{2},\qquad
\bar y=\frac{4r\sin(\theta/2)}{3\theta}
\]

\[
I_x=\frac{r^4}{8}(\theta+\sin\theta)-A\bar y^2,\qquad
I_y=\frac{r^4}{8}(\theta-\sin\theta)
\]

圆弓形为圆弧与弦之间的小弓形，弦位于 `y=r\cos(\theta/2)`：

\[
A=\frac{r^2}{2}(\theta-\sin\theta),\qquad
\bar y=\frac{4r\sin^3(\theta/2)}{3(\theta-\sin\theta)}
\]

\[
I_x=\frac{r^4}{8}(\theta-\sin\theta\cos\theta)-A\bar y^2
\]

\[
I_y=\frac{r^4}{8}\left[
\theta-\sin\theta-\frac23\sin\theta\sin^2\frac{\theta}{2}
\right]
\]

圆环扇形外、内半径为 `R`、`r`：

\[
A=\frac{\theta}{2}(R^2-r^2),\qquad
\bar y=\frac{4\sin(\theta/2)(R^3-r^3)}
{3\theta(R^2-r^2)}
\]

\[
I_x=\frac{R^4-r^4}{8}(\theta+\sin\theta)-A\bar y^2,\qquad
I_y=\frac{R^4-r^4}{8}(\theta-\sin\theta)
\]

`θ=π` 时，圆扇形/圆弓形应退化为半圆，圆环扇形应退化为半圆环；回归测试锁定此关系。

## 5. 椭圆与空心椭圆

外椭圆水平、竖直半轴为 `a`、`b`：

\[
A=\pi ab,\qquad
I_x=\frac{\pi ab^3}{4},\qquad
I_y=\frac{\pi a^3b}{4}
\]

同心空心椭圆的内半轴为 `a_1`、`b_1`：

\[
A=\pi(ab-a_1b_1)
\]

\[
I_x=\frac{\pi}{4}(ab^3-a_1b_1^3),\qquad
I_y=\frac{\pi}{4}(a^3b-a_1^3b_1)
\]

## 6. 中心孔与通槽扣除模型

正方形中心圆孔，边长 `a`、孔径 `d<a`：

\[
A=a^2-\frac{\pi d^2}{4},\qquad
I_x=I_y=\frac{a^4}{12}-\frac{\pi d^4}{64}
\]

圆形中央通槽按手册“圆减去 `d_1×d` 中心矩形”的扣除模型计算：

\[
A=\frac{\pi d^2}{4}-d_1d
\]

\[
I_x=\frac{\pi d^4}{64}-\frac{d_1d^3}{12},\qquad
I_y=\frac{\pi d^4}{64}-\frac{dd_1^3}{12}
\]

若该模型得到非正面积或二次矩，禁止计算。

矩形中央横向通槽，外宽 `b`、外高 `H`、槽高 `h<H`：

\[
A=b(H-h)
\]

\[
I_x=\frac{b(H^3-h^3)}{12},\qquad
I_y=\frac{b^3(H-h)}{12}
\]

## 7. 暂未纳入

- 三角形、梯形：手册页只完整给出部分方向属性；项目当前要求 `Ix/Iy/Wx/Wy` 全套。
- 花键和组合型钢：参数定义或属性列不完整。
- 薄壁正方形：与现有同心空心矩形重复。
