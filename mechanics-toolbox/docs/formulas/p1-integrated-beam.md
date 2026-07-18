# P1 截面性质 + 简支/悬臂梁综合计算器公式登记

- 文档版本：`1.0.1`
- 登记日期：`2026-07-18`
- 适用模块：P1 首款综合计算器
- 验收优先级：用户确认的坐标、正负号、验收算例及容差高于公式资料；若冲突，停止对应实现并由用户裁决。
- 禁止来源：未读取、未引用用户本地参考书或 PDF。

## 1. 统一符号、假设与单位

### 1.1 坐标和正负号

- 梁轴 `x` 向右，截面局部 `y` 向上。
- 外力、支反力向上为正；分布载荷强度 `w>0` 表示向上。
- 外加集中力矩、支座反力矩逆时针为正。
- 左截面正剪力向上；正弯矩使梁下缘受拉。
- `v` 向上为正，`θ=dv/dx`，逆时针为正。
- 拉应力为正，压应力为负。
- 集中力 `F` 引起 `ΔV=F`；集中力矩 `C` 引起 `ΔM=-C`。

### 1.2 理论假设

- 等截面、常 `E`、常 `I`、线弹性、小变形。
- Euler–Bernoulli 平截面假定；忽略剪切变形。
- 忽略梁自重，除非用户显式输入等效均布载荷。
- 不含分段 `EI`、超静定梁、塑性、大变形、动力、疲劳、接触。

### 1.3 单位

- 公式可使用任意量纲一致单位；实现层输入先转换到统一内部基准量，输出再转换为用户选择单位。
- 默认显示单位：长度 `mm`、力 `N`、应力/弹性模量 `MPa=N/mm²`、力矩 `N·mm`、线载荷 `N/mm`、面积 `mm²`、截面模量 `mm³`、截面二次矩及扭转常数 `mm⁴`、转角 `rad`。
- `t` 只表示质量吨，绝不表示力。

## 2. 公式索引

| 公式 ID | 名称 | 版本 | 主要验收算例 |
| --- | --- | --- | --- |
| `P1-SEC-RECT-001` | 矩形截面性质 | `1.0.0` | `SEC-RECT-01/02` |
| `P1-SEC-HRECT-001` | 空心矩形截面性质 | `1.0.0` | `SEC-HRECT-01/02` |
| `P1-SEC-CIRCLE-001` | 实心圆截面性质 | `1.0.0` | `SEC-CIRCLE-01/02` |
| `P1-SEC-TUBE-001` | 圆管截面性质 | `1.0.0` | `SEC-TUBE-01/02` |
| `P1-BEAM-EB4-001` | Euler–Bernoulli 四阶梁方程 | `1.0.0` | 全部梁算例 |
| `P1-BEAM-MACAULAY-001` | 奇异函数载荷叠加与场量 | `1.0.0` | `BEAM-SS-*`、`BEAM-CF-*`、`BEAM-MULTI-01` |
| `P1-BEAM-REACTION-SS-001` | 简支梁反力 | `1.0.0` | `BEAM-SS-*`、`BEAM-MULTI-01` |
| `P1-BEAM-REACTION-CF-001` | 左/右固定悬臂梁反力 | `1.0.0` | `BEAM-CF-*`及镜像测试 |
| `P1-BEAM-BC-001` | 边界条件与积分常数 | `1.0.0` | 全部梁算例 |
| `P1-BEAM-MIRROR-001` | 右端固定镜像映射 | `1.0.0` | 右端固定镜像测试 |
| `P1-BEAM-EXTREMA-001` | 分段解析极值 | `1.0.0` | 全部梁极值算例 |
| `P1-BEAM-STRESS-BEND-001` | 梁弯曲正应力 | `1.0.0` | `BEAM-STRESS-01` |
| `P1-BEAM-STRESS-SHEAR-RECT-001` | 实心矩形梁剪应力 | `1.0.0` | `BEAM-STRESS-02` |

## 3. 截面性质

四种首版截面均以几何中心为原点；`x` 向右、`y` 向上。因双轴对称，`x̄=ȳ=0`、`Ixy=0`，正负边缘截面模量相等。

### 3.1 `P1-SEC-RECT-001` 矩形

令水平宽度为 `b>0`，竖向高度为 `h>0`：

\[
A=bh,\quad I_x=\frac{bh^3}{12},\quad I_y=\frac{hb^3}{12}
\]

\[
W_{x+}=W_{x-}=\frac{I_x}{h/2},\quad
W_{y+}=W_{y-}=\frac{I_y}{b/2},\quad J_p=I_x+I_y
\]

Saint-Venant 扭转常数采用验收指定的工程近似。令 `a=max(b,h)`、`c=min(b,h)`、`r=c/a`：

\[
J_t=\frac{ac^3}{3}\left(1-0.63r+0.052r^5\right),\qquad 0<r\le1
\]

- 边界：`b≤0` 或 `h≤0` 时禁止计算。
- 不适用：不得把 `Jp` 当作非圆截面的 `Jt`。
- 精度锁定：`b=80 mm,h=120 mm` 得 `Jt=12018641.646090537 mm⁴`，与用户真值 `12018641.6461 mm⁴` 一致。

### 3.2 `P1-SEC-HRECT-001` 同心空心矩形

外尺寸 `B×H`，内孔 `b×h`：

\[
A=BH-bh,\quad I_x=\frac{BH^3-bh^3}{12},\quad
I_y=\frac{HB^3-hb^3}{12}
\]

\[
W_{x\pm}=\frac{I_x}{H/2},\quad W_{y\pm}=\frac{I_y}{B/2},\quad J_p=I_x+I_y
\]

闭口薄壁工程近似：

\[
t_h=\frac{H-h}{2},\quad t_v=\frac{B-b}{2},\quad
B_m=\frac{B+b}{2},\quad H_m=\frac{H+h}{2},\quad A_m=B_mH_m
\]

\[
J_t\approx\frac{4A_m^2}{2B_m/t_h+2H_m/t_v}
\]

等壁厚 `t_h=t_v=t` 时等价于 `Jt=4A_m²t/[2(B_m+H_m)]`。

- 边界：`B,H,b,h>0`，且 `b<B`、`h<H`；否则禁止计算。
- 适用：同心、闭口、薄壁 Saint-Venant 工程近似；UI 必须标注“近似”。
- 不适用：不得宣称为厚壁矩形管精确弹性解，不得与 `Jp` 混用。

### 3.3 `P1-SEC-CIRCLE-001` 实心圆

令直径 `d>0`：

\[
A=\frac{\pi d^2}{4},\quad I_x=I_y=\frac{\pi d^4}{64},\quad
W_x=W_y=\frac{\pi d^3}{32},\quad J_p=J_t=\frac{\pi d^4}{32}
\]

- 边界：`d≤0` 时禁止计算。
- 适用：同质实心圆截面。

### 3.4 `P1-SEC-TUBE-001` 同心圆管

令外径 `D>0`、内径 `0<d<D`：

\[
A=\frac{\pi(D^2-d^2)}{4},\quad
I_x=I_y=\frac{\pi(D^4-d^4)}{64}
\]

\[
W_x=W_y=\frac{2I_x}{D},\quad
J_p=J_t=\frac{\pi(D^4-d^4)}{32}
\]

- 边界：`D≤0`、`d≤0` 或 `d≥D` 时禁止计算。
- 适用：同心圆管；实心截面必须选择“实心圆”，不允许用 `d=0` 的圆管代替。

## 4. 四阶梁方程与载荷表达

### 4.1 `P1-BEAM-EB4-001` 控制方程

按本项目正负号：

\[
\theta=\frac{dv}{dx},\qquad EI\frac{d^2v}{dx^2}=M,\qquad
\frac{dM}{dx}=V,\qquad \frac{dV}{dx}=w
\]

所以：

\[
EI\frac{d^4v}{dx^4}=w(x)
\]

其中 `w>0` 向上；工程界面选择“向下”时转换为负值。`E>0`、`I>0`、`L>0`。

### 4.2 `P1-BEAM-MACAULAY-001` 奇异函数叠加

定义：

\[
\langle x-a\rangle^n=\begin{cases}0,&x<a\\(x-a)^n,&x>a\end{cases},\qquad
\langle x-a\rangle^0=H(x-a)
\]

跳变点必须分别取左值 `H(a^-)=0`、右值 `H(a^+)=1`。令所有外加力及支反力为 `(F_i,a_i)`，所有外加力矩及反力矩为 `(C_j,c_j)`，常值均布载荷段为 `(w_k,p_k,q_k)`：

\[
V(x)=\sum_iF_iH(x-a_i)+\sum_k w_k\left[\langle x-p_k\rangle^1-\langle x-q_k\rangle^1\right]
\]

\[
M(x)=\sum_iF_i\langle x-a_i\rangle^1-\sum_jC_jH(x-c_j)
+\sum_k\frac{w_k}{2}\left[\langle x-p_k\rangle^2-\langle x-q_k\rangle^2\right]
\]

\[
EI\theta(x)=\sum_i\frac{F_i}{2}\langle x-a_i\rangle^2
-\sum_jC_j\langle x-c_j\rangle^1
+\sum_k\frac{w_k}{6}\left[\langle x-p_k\rangle^3-\langle x-q_k\rangle^3\right]+C_1
\]

\[
EIv(x)=\sum_i\frac{F_i}{6}\langle x-a_i\rangle^3
-\sum_j\frac{C_j}{2}\langle x-c_j\rangle^2
+\sum_k\frac{w_k}{24}\left[\langle x-p_k\rangle^4-\langle x-q_k\rangle^4\right]+C_1x+C_2
\]

- 直接结果：集中力使 `V` 跳 `F`；集中力矩使 `M` 跳 `-C`；有限集中力/力矩下 `θ`、`v` 连续。
- 多载荷线性叠加；同位置后台可合并，但原始录入条目必须先按上限 10 项计数。
- 仅支持常值均布载荷；三角形、梯形载荷后置。

## 5. 支反力与边界条件

以下载荷合计不含支反力。定义：

\[
Q=\sum_iF_i+\sum_kw_k(q_k-p_k)
\]

\[
S_0=\sum_iF_ia_i+\sum_kw_k(q_k-p_k)\frac{p_k+q_k}{2}+\sum_jC_j
\]

### 5.1 `P1-BEAM-REACTION-SS-001` 左铰右滚简支梁

\[
R_B=-\frac{S_0}{L},\qquad R_A=-Q-R_B
\]

- 边界：`v(0)=v(L)=0`。
- 集中力位置：`0<a<L`；集中力矩允许 `0≤a≤L`。
- 支座不提供反力矩；端点外加集中力矩仍通过竖向反力维持整体平衡。

### 5.2 `P1-BEAM-REACTION-CF-001` 悬臂梁

左端固定、右端自由：

\[
R_0=-Q,\qquad C_0=-S_0
\]

右端固定、左端自由：

\[
R_L=-Q,\qquad C_L=-S_0-R_LL
\]

- 集中力允许作用于自由端；固定端载荷归入支反力。
- 场求值仍可区分端点载荷跳变的两侧；结果曲线只绘制物理梁域内侧（`x=0+`、`x=L-`），不把梁外侧值连入梁内曲线。端点外载与支反力由输入示意和反力摘要表达。

### 5.3 `P1-BEAM-BC-001` 积分常数

令前述 `EIθ` 中去掉 `C1` 的部分为 `Φθ(x)`，`EIv` 中去掉 `C1x+C2` 的部分为 `Φv(x)`：

- 简支梁：`C2=0`，`C1=-Φv(L)/L`。
- 左端固定：`C1=C2=0`。
- 右端固定：`C1=-Φθ(L)`，`C2=-Φv(L)+LΦθ(L)`。

这些常数只用于满足几何边界；支反力先由整体静力平衡得到。

### 5.4 `P1-BEAM-MIRROR-001` 右端固定镜像

由左端固定物理工况镜像到右端固定；镜像坐标 `x_R=L-x_L`：

\[
F_R=F_L,\quad C_R=-C_L,\quad
w_R(x)=w_L(L-x)
\]

\[
v_R(x)=v_L(L-x),\quad \theta_R(x)=-\theta_L(L-x),\quad
M_R(x)=M_L(L-x),\quad V_R(x)=-V_L(L-x)
\]

支座竖向反力保持符号，支座反力矩反号；所有极值位置映射为 `x_R=L-x_L`。

## 6. 极值与曲线

### `P1-BEAM-EXTREMA-001`

以端点、点力位置、点矩位置、均布载荷起止点分段。每段常值 `w` 下：`V/M/θ/v` 分别为不高于 `1/2/3/4` 次多项式。

- `V` 极值：分段端点及跳变左右值。
- `M` 极值：上述候选点 + 每段内部 `V(x)=0` 的实根。
- `θ` 极值：上述候选点 + 每段内部 `M(x)=0` 的实根；点矩位置需检查连续函数的左右导数变号。
- `v` 极值：端点 + 每段内部 `θ(x)=0` 的实根。
- 只接受落在当前分段闭区间内的有限实根；重复根去重，保留物理位置。
- 极值由分段多项式求根得到，不依赖绘图采样。
- 绘图使用 401 个基础采样点并自适应加点，强制加入解析极值点；内部载荷点保留左右值，端点只保留物理梁域内侧值，避免产生梁外虚假竖跳。

## 7. 应力恢复

### 7.1 `P1-BEAM-STRESS-BEND-001` 弯曲正应力

竖向弯曲使用 `Ix`：

\[
\sigma_x(x,y)=-\frac{M(x)y}{I_x}
\]

正弯矩下 `y<0` 的下缘受拉、`σ>0`；`y>0` 的上缘受压、`σ<0`。边缘应力也可写为 `σ=-M/W`，但必须保留轴与正负边缘。

### 7.2 `P1-BEAM-STRESS-SHEAR-RECT-001` 实心矩形剪应力

仅实心矩形：

\[
\tau(y)=\frac{3V}{2A}\left[1-\left(\frac{2y}{h}\right)^2\right],\qquad |y|\le h/2
\]

\[
\tau_{max}=\frac{3V}{2A}\quad @\ y=0,\qquad \tau(\pm h/2)=0
\]

剪应力符号随 `V`。空心矩形、实心圆、圆管必须禁用该结果并显示：`当前截面暂不支持剪应力恢复`。

## 8. 适用性警告与失败条件

- `L/h<10`：强警告“剪切变形可能不可忽略”，仍按 Euler–Bernoulli 计算。
- `|v|max/L>1%`：强警告“小变形假设可能不成立”，仍计算。
- `L≤0`、`E≤0`、`I≤0`、非法截面、非有限载荷、原始载荷超过 10 项：禁止计算。
- 结果出现 `NaN/Infinity` 或平衡残差超过算例容差：求解失败，不显示成功结果。

## 9. 内部来源记录

| 来源记录 ID | 类型 | 内容 | 用途 |
| --- | --- | --- | --- |
| `USR-P1-SIGN-20260718` | 用户确认文档 | `ai/memory-bank/site-setup.md`、`p1-confirmation-form.md` | 范围、坐标、正负号、边界、单位、警告 |
| `USR-P1-ACCEPT-20260718` | 用户验收真值 | `ai/memory-bank/p1-acceptance-cases-form.md` | 48 个算例；本公式登记对应首款相关算例 |
| `INT-EB-DERIVATION-20260718` | 模型知识与内部推导 | Euler–Bernoulli 四阶方程、静力平衡、奇异函数积分、分段多项式极值 | 梁公式主体；按用户符号重新推导 |
| `WEB-MECH-CALC-BEAM-20260718` | 公开在线公式表 | [MechaniCalc Beam Analysis](https://mechanicalc.com/reference/beam-analysis)，访问日期 `2026-07-18` | 10 个简支/悬臂弯矩公开公式门禁及正弯矩约定 |
| `OSS-INDETERMINATE-BEAM-4D504DF` | 公开开源对照 | [JesseBonanno/IndeterminateBeam](https://github.com/JesseBonanno/IndeterminateBeam)，固定对照提交 `4d504df` | 10 个公开公式算例的第二独立执行器；不复制其源码到产品 |
| `WEB-SYMPY-BEAM-20260718` | 官方开源文档 | [SymPy Beam](https://docs.sympy.org/latest/modules/physics/continuum_mechanics/beam.html)，访问日期 `2026-07-18` | 奇异函数和混合载荷表达式交叉核查 |
| `WEB-RECT-JT-PILKEY-20260718` | 公开在线 PDF | [矩形 Saint-Venant 扭转常数：精确级数式(25)及五次项近似式(26)，PDF 第 40 页](https://upload.wikimedia.org/wikipedia/commons/4/42/Analytic_expression_of_the_buckling_loads_for_stiffened_plates_with_bulb-flat_flanges_%28IA_analyticexpressi109459863%29.pdf)，访问日期 `2026-07-18` | 锁定 `P1-SEC-RECT-001` 的 `0.63/0.052r⁵` 形式 |
| `WEB-ABAQUS-SV-20260718` | 公开在线文档镜像 | [Abaqus 梁截面说明：圆截面无翘曲；实心非圆截面按 Saint-Venant 应力函数处理](https://ceae-server.colorado.edu/v2016/books/stm/ch03s05ath74.html)，访问日期 `2026-07-18` | 交叉核对 `Jp` 与非圆截面 `Jt` 不混用 |

## 10. 差异与冲突检查

### 10.1 已排除的矩形 `Jt` 变体

另一常见写法：

\[
J=a c^3\left[\frac13-0.21\frac ca\left(1-\frac{c^4}{12a^4}\right)\right]
\]

对 `80 mm×120 mm` 得 `12019990.123456789 mm⁴`，与用户真值的相对差约 `1.122×10⁻⁴`，超过 `1×10⁻⁶` 验收容差。因此首款禁止使用该变体；这不是 fixture 错误。

### 10.2 当前结论

- `P1-SEC-RECT-001` 五次项公式代入结果与 `SEC-RECT-01` 一致，无冲突。
- 本文其他公式按用户符号约定整理；未发现公式与首款综合梁验收真值冲突。
- 后续若实现结果与 fixture 不一致，保留 fixture，停止对应公式项并提交用户裁决。
