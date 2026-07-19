# P3 四边简支矩形板单向压缩屈曲

## P3-BK-PLATE-SSSS-UNIAXIAL-1

- 版本：`1.0.0`；来源级别：`xu-textbook`；访问日期：`2026-07-19`。
- 性质：理想、线弹性、小挠度分岔屈曲估计，不是设计承载力。
- 边界/载荷：各边简支，`x` 向均匀压缩膜力 `Nx>0`；`a` 为压缩方向长度，`b` 为板宽。
- 单位：输入和内核均采用 SI；`D` 为 `N·m`，`Nx,cr` 为 `N/m`，`σcr` 为 `Pa`，`Pcr` 为 `N`。

\[
D=\frac{Et^3}{12(1-\nu^2)},\qquad
N_{x,cr}(m,n)=\frac{\pi^2D}{a^2}\frac{[m^2+n^2(a/b)^2]^2}{m^2}
\]

首版固定最低横向半波 `n=1`，穷举 `m=1…200`：

\[
k=\left(\frac{mb}{a}+\frac{a}{mb}\right)^2,\quad
N_{x,cr}=k\frac{\pi^2D}{b^2},\quad
\sigma_{cr}=\frac{N_{x,cr}}{t},\quad P_{cr}=N_{x,cr}b
\]

施加膜力只用于显示理论利用比 `Nx/Nx,cr`；零值、拉力或非有限数不进入求解。厚跨比沿用 P3 薄板护栏。局部板屈曲与整体柱屈曲、材料屈服和后屈曲均未组合。
