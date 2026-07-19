# P3 无加劲圆柱薄壳均匀轴压屈曲

## P3-BK-SHELL-NASA-SP8007-AXIAL-1

- 版本：`1.0.0`；来源级别：`official-publication`。
- 来源：NASA/SP-8007-2020/REV 2，*Buckling of Thin-Walled Circular Cylinders*，第 4.1.1 节；访问日期 `2026-07-19`。
- 性质：`γ=1` 的理想完美几何线弹性估计；没有应用规范折减因子。
- 边界/载荷：无加劲、等厚、圆柱薄壳，简支端，均匀轴向压缩膜力；平均半径 `r`。

\[
D=\frac{Et^3}{12(1-\nu^2)},\quad
Z=\frac{L^2\sqrt{1-\nu^2}}{rt},\quad
N_{x,cr}=k_x\frac{\pi^2D}{L^2}
\]

\[
\beta=\frac{nL}{m\pi r},\qquad
k_x=m^2(1+\beta^2)^2+\frac{12Z^2}{\pi^4m^2(1+\beta^2)^2}
\]

首版穷举 `m=1…200, n=0…200` 并回报控制波数；临界值采用同一理想理论的长圆柱闭式基准：

\[
\sigma_{cr}=\frac{E(t/r)}{\sqrt{3(1-\nu^2)}},\quad
N_{x,cr}=\sigma_{cr}t,\quad P_{cr}=2\pi rN_{x,cr}
\]

`t/r>0.05` 禁止计算；等于上限给出边界警告。`L/r>5` 给出整体柱屈曲/交互复核警告但保留理论值。界面始终显示：理想完美几何、缺陷敏感、需规范或试验折减后方可设计。
