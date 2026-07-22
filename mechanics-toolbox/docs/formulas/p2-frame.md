# P2 平面刚架公式约定

- 文档版本：`P2-FRAME-FORMULAS-v1.1.0`
- 公式 ID：`P2-FRAME-001`、`P2-FRAME-INITIAL-001`
- 实现版本：`P2-FRAME-v1`、`P2-FRAME-INITIAL-v1`
- Gate：`P2-4B`
- 访问/冻结日期：`2026-07-19`
- 状态：用户已确认 `FRAME-A01` 登记数值属于 member resisting actions；`Gate P2-4B/P2-G09` 的端力语义已闭合并已关闭

## 范围与坐标

- 单元为二维 Euler–Bernoulli 刚架单元：计轴向与弯曲变形，忽略剪切变形。
- 局部轴 `x` 从节点 `i` 指向节点 `j`，局部 `y` 将 `x` 逆时针旋转 90° 得到。
- 单元自由度顺序固定为
  `d_e=[u_i,v_i,theta_i,u_j,v_j,theta_j]^T`；`theta>0` 为逆时针。
- 力向量对应顺序为
  `[Fxi,Fyi,Mzi,Fxj,Fyj,Mzj]^T`，力用 N、弯矩用 N·m。
- 首版包含局部轴向/横向常值分布载荷、均匀温升及均匀轴向初应变；排除三角形/梯形分布载荷、端释放、内部铰、截面温度梯度、热弯曲与初曲率。

## 几何与坐标变换

令

```text
dx=x_j-x_i, dy=y_j-y_i, L=sqrt(dx^2+dy^2)
c=dx/L, s=dy/L
R=[[c,s],[-s,c]]
T=diag(R,1,R,1)
```

则

```text
d_local = T d_global
f_global = T^T f_local
K_global = T^T k_local T
```

`T` 为正交矩阵。水平正向单元 `T=I`；反转节点顺序时 `c,s` 同时反号，但局部轴仍保持 `i→j`。

## 局部刚度矩阵

记 `a=EA/L`、`b=12EI/L^3`、`r=6EI/L^2`、`p=4EI/L`、`h=2EI/L`：

```text
k_local =
[[ a, 0, 0,-a, 0, 0],
 [ 0, b, r, 0,-b, r],
 [ 0, r, p, 0,-r, h],
 [-a, 0, 0, a, 0, 0],
 [ 0,-b,-r, 0, b,-r],
 [ 0, r, h, 0,-r, p]]
```

矩阵对称、秩为 3；两个刚体平移和一个刚体转动不产生单元力。

## 常值局部分布载荷

局部常值 `q_x/q_y` 作用于同一区间 `[a,b]`，满足 `0<=a<b<=L`；至少提供一个分量。`q_x/q_y` 分别沿局部 `+x/+y` 为正。令 `xi=x/L`，轴向线性形函数为 `Nu1=1-xi,Nu2=xi`，弯曲 Hermite 形函数为

```text
N1=1-3xi^2+2xi^3
N2=L(xi-2xi^2+xi^3)
N3=3xi^2-2xi^3
N4=L(-xi^2+xi^3)
```

一致节点荷载：

```text
f_eq = integral_a^b [Nu1*q_x,N1*q_y,N2*q_y,Nu2*q_x,N3*q_y,N4*q_y]^T dx
```

令 `z0=a/L,z1=b/L`，以 `[G] = G(z1)-G(z0)` 表示端点差：

```text
Fxi = q_x L [z-z^2/2]
Fxj = q_x L [z^2/2]
Fyi = q_y L   [z-z^3+z^4/2]
Mzi = q_y L^2 [z^2/2-2z^3/3+z^4/4]
Fyj = q_y L   [z^3-z^4/2]
Mzj = q_y L^2 [-z^3/3+z^4/4]
```

全跨是 `a=0,b=L` 的特例：

```text
f_eq=[q_x L/2,q_y L/2,q_y L^2/12,q_x L/2,q_y L/2,-q_y L^2/12]^T
```

守恒检查：

```text
Fxi+Fxj = q_x(b-a)
Fyi+Fyj = q_y(b-a)
Mzi+L*Fyj+Mzj = q_y(b^2-a^2)/2
```

三角形、梯形、同时缺失 `q_x/q_y` 或任一非有限分量不进入该积分函数，必须由模型校验拒绝。

## 均匀温度与初应变

均匀轴向自由应变为

```text
epsilon_free = alpha*DeltaT + epsilon_0
```

其局部等效节点荷载为

```text
f_free = EA*epsilon_free*[-1,0,0,+1,0,0]^T
```

只产生轴向项，不产生剪力或弯矩。多种载荷在线性范围内直接叠加。轴力本构为

```text
N = EA*((u_j-u_i)/L - epsilon_free)
```

其中 `N>0` 为拉、`N<0` 为压。

## 装配、杆端力与杆内场

单元一致荷载先由 `T^T` 转至全局，再装配至总荷载；整体方程为

```text
K d = F_nodal + sum(T^T f_eq)
```

局部端部量必须分成两个互为相反数、不得混用名称的字段：

```text
r_local = k_local*d_local - f_eq     # member resisting actions
p_local = f_eq - k_local*d_local     # element-on-node
p_local = -r_local
```

用户于 `2026-07-19` 确认：`FRAME-A01` 冻结卡中的既有端弯矩/剪力数值按 `r_local=kd-f` 解读并重标为 member resisting actions；不改动其数值。公共节点平衡字段仍固定为 `p_local=f-kd`，节点处所有 element-on-node 端力、外荷载及支座反力的矢量和必须为零。对含局部 `q_x/q_y` 的单元，从 i 端向 j 端恢复：

```text
N(0)=p_local[0]
V(0)=-p_local[1]
M(0)=p_local[2]
dN/dx=-q_x(x)
dV/dx=q_y(x)
dM/dx=V(x)
```

截面纤维坐标 `y` 沿局部 `+y`，正应力为

```text
sigma_x(x,y)=N(x)/A-M(x)*y/I
```

输出必须同时标明单元 ID、局部位置 `x`、数值、单位及正负含义。

## 冻结基准

- `FRAME-E01`：`L=5 m,E=200 GPa,A=0.01 m^2,I=8e-5 m^4`；倾斜单元 `c=0.8,s=0.6`。
- `FRAME-A01`：冻结端力数值属于 `r_local=kd-f`（member resisting actions）；对应 element-on-node 数值为其相反量 `p_local=f-kd`。该语义由用户于 `2026-07-19` 确认，冻结数值本身不变。
- `FRAME-A02`：`L=4 m,q_y=-10000 N/m` 全跨，`f_eq=[0,-20000,-13333.3333333333,0,-20000,+13333.3333333333]`。
- `FRAME-A03`：同一单元仅 `[0,2] m` 受载，`f_eq=[0,-16250,-9166.66666666667,0,-3750,+4166.66666666667]`。
- `FRAME-T01`：`EA=2e8 N,alpha*DeltaT=600e-6`，完全约束时 `N=-120000 N`，`V=M=0`。
- `FRAME-IS01`：`EA=2e8 N,epsilon_0=500e-6`，完全约束时 `N=-100000 N`，`V=M=0`。

## 来源与追溯

- 公式登记索引：[`p2-index.md`](./p2-index.md) 的 `P2-FRAME-001`、`P2-FRAME-INITIAL-001`；索引版本 `P2-FORMULA-INDEX-v1.3.0`，访问 `2026-07-19`。
- 冻结 fixture：`qa/fixtures/p2-frame.json`，schema `1.0.0`；覆盖 `P2-FRAME-E01/A01/A02/A03/T01/IS01/N01/X01`，真值政策为独立冻结且禁止项目输出回填。`P2-FRAME-A01` 仅按用户裁决重标字段语义，不由当前实现反填或改写数值。
- 人工可读验收卡：`ai/memory-bank/p2-acceptance-cases-form.md` 第五节“平面刚架”，来源为框架直接刚度法、Euler–Bernoulli 一致荷载积分、静力平衡和自由应变本构，确认日期 `2026-07-19`。
- 分布载荷外部来源：[OpenSees eleLoad](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/pattern/PlainPatternloadcommands/eleLoad.html)；初应变外部来源：[OpenSees InitStrainMaterial](https://opensees.berkeley.edu/wiki/index.php?title=Initial_Strain_Material)；均访问 `2026-07-19`，只用于公式边界核对，不替代冻结 fixture。
