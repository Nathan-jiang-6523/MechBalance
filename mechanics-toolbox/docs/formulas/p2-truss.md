# P2 平面桁架公式登记

## 坐标、自由度与正号

- 节点自由度固定为全局 `[u,v]`，单位 `m`。
- 单元局部 `+x_l` 从节点 `i` 指向节点 `j`；`L=sqrt(dx²+dy²)`，`c=dx/L`，`s=dy/L`。
- 杆件轴力 `N>0` 表示受拉，正应力 `sigma=N/A>0` 表示拉应力。
- 内核输入统一使用 SI：`E(Pa)`、`A(m²)`、`rho(kg/m³)`、`g(m/s²)`、`alpha(1/K)`、`DeltaT(K)`。

## 单元刚度与变形

局部轴向刚度为 `EA/L [[1,-1],[-1,1]]`。按自由度
`[u_i,v_i,u_j,v_j]` 转为全局坐标后：

```text
K_e = EA/L *
[[ c²,  cs, -c², -cs],
 [ cs,  s², -cs, -s²],
 [-c², -cs,  c²,  cs],
 [-cs, -s²,  cs,  s²]]
```

杆件轴向伸长与总轴向应变为：

```text
delta = [-c,-s,c,s] u_e
epsilon = delta/L
```

## 温度、初应变与轴力恢复

均匀温差只产生自由轴向应变，不含温度梯度或热弯曲：

```text
epsilon_free = alpha*DeltaT + epsilon_0
N = EA*(epsilon - alpha*DeltaT - epsilon_0)
sigma = N/A
```

正 `epsilon_0` 表示沿局部 `+x_l` 自由伸长。其等效节点荷载为：

```text
f_free,local = EA*epsilon_free*[-1,+1]
f_free,global = EA*epsilon_free*[-c,-s,c,s]
```

多个温度或初应变作用按自由应变线性相加。等效初应变荷载是外部等效荷载，不能直接当作支座反力；反力按 `R=Ku-F` 恢复。

## 自重节点化

每根杆件的质量和重量为：

```text
m = rho*A*L
W = rho*A*L*g
f_weight,global = [0,-W/2,0,-W/2]
```

自重沿全局 `-y`，两端节点各集中一半。P2 首版只恢复桁架轴力，不输出由该节点化假设无法定义的杆内横向剪力或弯矩。

## 装配、约束与校核

按单元自由度映射装配 `Ku=F`，只支持 `u/v=0` 约束。求解后检查自由自由度残差、全局 `Fx/Fy/Mz` 平衡以及 `u^T K u = u^T F`。零力状态使用 `|N|<=1e-6 N` 判定；此阈值只用于状态标签，不截断结果值。
