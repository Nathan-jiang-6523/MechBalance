# P3 公式、真值与 UI 追溯矩阵

状态：`P3 开发候选完成`；工程签收前不标记发布完成。所有内核输入输出均为 SI，UI 可在工程/SI 预设间往返。

| UI 模块/结果 | 公式 ID | 内核入口 | 用户真值 | 独立对照 | 性质标签 |
| --- | --- | --- | --- | --- | --- |
| 薄壁圆筒 `Nθ,Nz,τ,σ1/2,VM,Tresca` | `P3-TW-PRESSURE-OPEN/CLOSED-1`；补充轴力/扭矩 ID | `solveThinCylinder` | `p3-thin-cylinder.json` | `p3-cylinder-reference.test.ts` / USAF 8.3 | 薄壁膜应力近似 |
| Lamé `σr,σθ,σz,u`、表面残差 | `P3-LM-STRESS-1`、轴向状态 ID、`P3-LM-DISPLACEMENT-1` | `solveLameCylinder` | `p3-lame-cylinder.json` | `p3-cylinder-reference.test.ts` / USAF 8.4 | 应力闭式；位移按轴向假设 |
| 圆板 `w,Mr,Mθ,σr,σθ,Qr,R` | `P3-CP-CLAMPED-UNIFORM-1`、`P3-CP-SIMPLE-UNIFORM-1` | `solveCircularPlate` | `p3-circular-plate.json` | `p3-plate-reference.test.ts` / NASA 66-10601 | 精确闭式、小挠度 |
| 矩形板 SSSS `w,Mx,My,Mxy,σ` | `P3-RP-SSSS-UNIFORM-1` | `solveRectangularPlate` → `navierPoint` | `p3-rectangular-plate.json` | 独立 501 阶 Navier 双和 | 级数解、显示截断 |
| 矩形板 CCCC 同组结果 | `P3-RP-CCCC-RITZ-1` | `solveRectangularPlate` → `ritzSolution` | 边界恒等式与收敛门禁 | 无冻结外部数值真值 | 里茨近似，不宣称误差界 |
| 简支板屈曲 `m,n,k,Nx,cr,σcr,Pcr` | `P3-BK-PLATE-SSSS-UNIAXIAL-1` | `solvePlateBuckling` | `p3-buckling.json` | `p3-buckling-reference.test.ts` | 理想弹性估计 |
| 简支圆柱壳屈曲 `Z,m,n,Nx,cr,σcr,Pcr` | `P3-BK-SHELL-NASA-SP8007-AXIAL-1` | `solveShellBuckling` | `p3-buckling.json` | NASA SP-8007 闭式复算 | 理想完美壳；强制缺陷警告 |

公共门禁：边界必须显式选择；非法输入清除旧结果；薄板/薄壳比值和小挠度状态随结果返回；`p3-units.test.ts` 证明跨单位物理等价；各模块 E2E 同时覆盖桌面与移动项目。
