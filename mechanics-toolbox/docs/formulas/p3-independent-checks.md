# P3 独立公开对照

访问日期统一为 `2026-07-19`。本页只登记生产实现之外的第二证据；测试中的独立函数不导入生产公式函数，也不反向修改用户验收真值。

| 模块 | 独立来源/方法 | 对照量 | 符号与范围 |
| --- | --- | --- | --- |
| 薄壁圆筒 | 1986 USAF *Stress Analysis Manual* 8.3.1.1.1（公开归档），式 8-3～8-6 | `Nθ=Δp r`、封闭端 `Nz=Δp r/2` | 压力幅值转为本项目“拉正压缩负”；远离端部不连续区 |
| 厚壁圆筒 | 同手册 8.4.1，式 8-35～8-43 的 Lamé 场 | `σr=A-B/r²`、`σθ=A+B/r²` 与内外表面边界 | 手册 `a,b` 对应 `ri,ro`；压力输入为正幅值、表面径向应力为负 |
| 圆板 | NASA Tech Brief 66-10601 / NTRS `19660000599` | 固支/简支均布载荷中心挠度和弯矩闭式复算 | 半径 `a`、挠度正方向按产品图示转换 |
| 矩形板 | NASA/TP-2007-214480 对 Navier 位移法和 `∇⁴w=q/D` 的公开说明；测试独立以 501 阶奇数双和复算 | SSSS 方板中心 `w,Mx,My` | 生产截断 321；参考截断 501；分别报告截断差 |
| 矩形板 CCCC | 独立闭式真值未冻结 | 不作为 H05 数值门禁 | 首版仅标注里茨近似、收敛元数据和边界恒等式 |
| 简支板屈曲 | NASA 平板压缩公开报告与经典 `k` 模态式；测试独立枚举 | `m,n,k,Nx,cr` | 压缩量统一取正；不与整体柱屈曲合并 |
| 圆柱壳屈曲 | NASA/SP-8007-2020/REV 2，第 4.1.1 节 | 完美壳闭式应力、离散波数搜索 | `γ=1`；对实际设计必须另行采用规范/试验折减 |

公开入口：

- USAF 薄壁压力容器归档：<https://engineeringlibrary.org/reference/simple-thin-pressure-vessels-air-force-stress-manual>
- USAF 厚壁压力容器归档：<https://engineeringlibrary.org/reference/thick-pressure-vessels-air-force-stress-manual>
- NASA 圆板 Tech Brief：<https://ntrs.nasa.gov/citations/19660000599>
- NASA Navier 板理论报告：<https://ntrs.nasa.gov/citations/20070021749>
- NASA 圆柱壳屈曲专刊：<https://ntrs.nasa.gov/citations/20205011530>

独立测试文件分别为 `p3-cylinder-reference.test.ts`、`p3-plate-reference.test.ts`、`p3-buckling-reference.test.ts`。容差只反映来源精度和级数截断，不覆盖公式/边界冲突。
