# P2 公式索引与追溯基线

- 文档版本：`P2-FORMULA-INDEX-v1.1.0`
- 冻结日期：2026-07-19
- 实现状态含义：`Gate P2-0 契约`仅定义公共类型/错误/单位与验证边界；`Gate P2-1 基准`为首个 1D 梁单元门禁；后续模块公式已冻结追溯信息，但不表示已实现。
- 真值优先级：`ai/memory-bank/p2-acceptance-cases-form.md` 的已确认卡片高于项目实现输出；禁止用项目输出反填 fixture。

## 统一坐标、正负号、单位与假设

- 全局右手系：`+x` 向右、`+y` 向上、`+z` 屏幕向外；`u/v` 沿 `+x/+y` 为正，`θ/Mz` 逆时针为正。
- 局部轴：`+x_l` 从节点 `i→j`，`+y_l` 为 `+x_l` 逆时针旋转 `90°`；梁/刚架局部自由度固定为 `[u_i,v_i,θ_i,u_j,v_j,θ_j]`。
- 内力：`N>0` 拉；`M>0` 下缘受拉；`V=dM/dx`；Euler–Bernoulli 关系 `M=EI·d²v/dx²`。端力是“单元作用于节点”的力，顺序 `[Fxi,Fyi,Mzi,Fxj,Fyj,Mzj]`。
- 内部计算统一 SI。UI 默认 `t-mm-MPa-N-s`，备选 `SI（kg-m-Pa-N-s）`；换算必须作用于输入、结果、图形、表头及绝对容差。
- 首版共同假设：2D、线弹性、小变形、Euler–Bernoulli、忽略剪切变形；`E/A/I` 均须有限且严格大于零；零长度先于组装拒绝。
- 首版硬边界：节点 `≤100`、单元 `≤200`、自由 DOF `≤300`；任一数量超过上限才阻止求解；稠密矩阵；不含 Timoshenko、分段变属性、连续多跨、内部铰/端释放、材料/几何非线性。

## Gate P2-0 / P2-1 登记公式

| 公式 ID | 实现版本 | 门禁 | 公式/契约 | 单位与边界 | 来源与访问日期 |
| --- | --- | --- | --- | --- | --- |
| `P2-CONTRACT-001` | `P2-CONTRACT-v1` | P2-0 | 校验顺序：非有限 → 非正 → 几何退化 → 刚度奇异；错误结果不得携带成功数值。 | `0<E,A,I,L<∞`；排除能力返回 `P2_FEATURE_NOT_INCLUDED`。 | 已确认决策 `P2-D05/D13/D25` 与验收 `BEAM-N01/N02、CBEAM-A04`，2026-07-19。 |
| `P2-UNIT-001` | `P2-UNITS-v1` | P2-0 | 默认制到 SI：长度 `×10⁻³`、面积 `×10⁻⁶`、惯性矩 `×10⁻¹²`、模量/应力 `×10⁶`、力矩 `×10⁻³`、线荷载 `×10³`、密度 `×10¹²`；力/时间/转角不变。 | 往返换算使用未舍入内部量；不得触发重算或清空输入。 | 已确认验收统一单位表与 BEAM-A01 换算基准，2026-07-19。 |
| `P2-EB-001` | `P2-EB6-v1` | P2-1 | 水平 2D 梁局部刚度为轴向杆块 `EA/L[[1,-1],[-1,1]]` 与 EB 弯曲块 `(EI/L³)[[12,6L,-12,6L],[6L,4L²,-6L,2L²],[-12,-6L,12,-6L],[6L,2L²,-6L,4L²]]` 的 6×6 组合。 | 行列量纲随 DOF 为 `N/m`、`N`、`N·m`；单元秩 `3`，含三个平面刚体模态。 | 验收 `P2-BEAM-E01/E03`；[CALFEM beam2e](https://calfem-for-python.readthedocs.io/en/latest/calfem_reference/#calfem.core.beam2e)，访问 2026-07-19。 |
| `P2-EB-002` | `P2-EB-LOAD-v1` | P2-1 | 全跨常值局部线荷载 `q_y` 的一致节点荷载：`[0,qL/2,qL²/12,0,qL/2,-qL²/12]ᵀ`。 | 分量单位依次 `[N,N,N·m,N,N,N·m]`；首版梁不含局部区间、三角形/梯形载荷。 | 验收 `P2-BEAM-E02`；`∫Nᵀq dx`；[CALFEM beam2e](https://calfem-for-python.readthedocs.io/en/latest/calfem_reference/#calfem.core.beam2e)，访问 2026-07-19。 |
| `P2-DSM-001` | `P2-DSM-v1` | P2-1 | 装配 `K=ΣA_eᵀk_eA_e`，约束自由 DOF 解 `K_ff d_f=F_f-K_fc d_c`，反力 `R=Kd-F`。 | 约束不足/机构/奇异矩阵返回 `P2_SINGULAR_STIFFNESS`；节点平衡残差按力、力矩分别验收。 | 验收 `P2-BEAM-A01…A06/C01/N01`；线弹性直接刚度法，2026-07-19。 |
| `P2-EB-RECOVERY-001` | `P2-EB-RECOVERY-v1` | P2-1 | `N=EA·du/dx`、`M=EI·d²v/dx²`、`V=dM/dx`；全跨均布载荷恢复须含载荷特解，不能仅作节点直线插值。 | 跳变处保留左右极限；端内力映射 `i+:[Fxi,-Fyi,Mzi]`、`j-:[-Fxj,Fyj,-Mzj]`。 | 验收 `P2-BEAM-A01…A06/C01`；EB 闭式解，2026-07-19。 |

## 后续模块冻结公式

| 公式 ID | 实现版本 | 公式/契约 | 符号、单位与边界 | 来源与访问日期 |
| --- | --- | --- | --- | --- |
| `P2-CBEAM-001` | `P2-CBEAM-v1` | 复用 `P2-EB-001/P2-DSM-001`；等属性单跨梁按固端或固定—简支约束求解，`R=Kd-F`，不另引入力法公式。 | `[u,v,θ]`；`E/A/I` 全跨相等；内部铰/端释放输入必须返回 `P2_FEATURE_NOT_INCLUDED`。 | 验收 `P2-CBEAM-A03/A04/A05/X01` 与 EB 直接刚度法；[CALFEM beam2e](https://calfem-for-python.readthedocs.io/en/latest/calfem_reference/#calfem.core.beam2e)，访问 2026-07-19。 |
| `P2-TRUSS-001` | `P2-TRUSS-v1` | `k_e=(EA/L)tᵀt`，`t=[-c,-s,c,s]`；轴力 `N=EA[(u_j^l-u_i^l)/L-ε_free]`，应力 `σ=N/A`。 | 每节点 `[u,v]`；`c=Δx/L`、`s=Δy/L`；`N>0` 拉；`k_e:N/m`、`N:N`、`σ:Pa`。 | 验收 `P2-TRUSS-E01/A01/A02/N01/X01`；线弹性杆单元直接刚度法，2026-07-19。 |
| `P2-TRUSS-INITIAL-001` | `P2-TRUSS-INITIAL-v1` | `ε_free=αΔT+ε₀`；自重 `W=ρALg`，全局 `-y` 两端各施加 `W/2`。 | `α:1/K`、`ΔT:K`、`ε₀:1`、`ρ:kg/m³`、`g:m/s²`；自重不恢复横向杆端剪力/弯矩。 | 验收 `P2-TRUSS-T01/IS01/SW01`；[OpenSees InitStrainMaterial](https://opensees.berkeley.edu/wiki/index.php?title=Initial_Strain_Material)，访问 2026-07-19。 |
| `P2-FRAME-001` | `P2-FRAME-v1` | 局部 6×6 梁柱刚度复用 `P2-EB-001`，全局刚度 `k_g=Tᵀk_lT`；常值区间载荷 `f_e=∫_a^b Nᵀq_y dx`。 | `[u,v,θ]`；局部 `+x_l:i→j`、`+y_l` 逆时针 90°；首版只含全跨/区间常值局部 `q_y`，无端释放。 | 验收 `P2-FRAME-E01/A01/A02/A03/N01/X01`；[OpenSees eleLoad](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/pattern/PlainPatternloadcommands/eleLoad.html)，访问 2026-07-19。 |
| `P2-FRAME-INITIAL-001` | `P2-FRAME-INITIAL-v1` | 均匀温度/初应变只产生轴向自由应变 `ε_free=αΔT+ε₀`；机械应变为零时 `N=-EAε_free`。 | `N>0` 拉；不含截面温度梯度和热弯曲；端力按“单元作用于节点”符号输出。 | 验收 `P2-FRAME-T01/IS01`；[OpenSees InitStrainMaterial](https://opensees.berkeley.edu/wiki/index.php?title=Initial_Strain_Material)，访问 2026-07-19。 |
| `P2-IL-001` | `P2-IL-v1` | 简支梁左反力 `η_RA(z)=1-z/L`；截面弯矩 `η_M=z(L-a)/L (z≤a)`、`a(L-z)/L (z≥a)`；剪力在 `z=a` 保留跳跃 `+1` 的左右极限；位移用简支梁互等 Green 函数。 | `z,a,L:m`；反力/剪力纵坐标无量纲，弯矩为 `m`，位移为 `m/N`；只支持简支梁。 | 验收 `P2-IL-A01/A02/A03`；截面静力平衡与 Maxwell–Betti 互等定理，2026-07-19。 |
| `P2-ML-001` | `P2-ML-v1` | 轴组响应 `R(z)=Σ φP_iη(z_i)`；控制位置由轴到达影响线端点、峰值或跳变位置的有限候选事件比较，不用固定步长冒充极值。 | `P_i:N`、`φ:1` 且有限正值；单轴组、单行进方向、静力包络，允许轴组部分在桥外。 | 验收 `P2-ML-A01/A02/A03`；影响线线性叠加，2026-07-19。 |
| `P2-UI-CONTRACT-001` | `P2-UI-v1` | 单位切换先把当前显示值还原 SI，再由同一 SI 值生成目标显示；错误状态立即清除旧成功结果。 | 默认 `t-mm-MPa-N-s`，备选 `kg-m-Pa-N-s`；离线单 HTML 外部请求数必须为 0。 | 验收 `P2-UI-01…04` 与已确认单位规则，2026-07-19。 |

## 来源说明

- 验收真值：`ai/memory-bank/p2-acceptance-cases-form.md`，状态“三轮独立力学复核通过”，2026-07-19。
- 范围与符号：`ai/memory-bank/p2-confirmation-form.md`，Nathan 已确认，2026-07-19。
- 区间/全跨杆件载荷接口交叉核对：[OpenSees eleLoad](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/pattern/PlainPatternloadcommands/eleLoad.html)，访问 2026-07-19。
- 初应变语义交叉核对：[OpenSees InitStrainMaterial](https://opensees.berkeley.edu/wiki/index.php?title=Initial_Strain_Material)，访问 2026-07-19。
