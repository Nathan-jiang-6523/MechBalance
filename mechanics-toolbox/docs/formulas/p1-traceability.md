# P1 公式—实现—测试追溯审计

审计日期：2026-07-18

| 功能 | 公式/版本 | 纯函数实现 | 主要回归测试 |
|---|---|---|---|
| 截面性质、梁、梁应力 | `p1-integrated-beam.md` / `1.0.1` | `src/core/sections/`、`src/core/beam/` | `qa/unit/sections/`、`qa/unit/beam/`、`qa/unit/beam-ui/` |
| 手册扩展截面性质 | `p1-section-handbook-extensions.md` / `1.0.0` | `src/core/sections/`、`src/features/sections/` | `qa/unit/sections/sectionProperties.test.ts` |
| 轴向拉压与温变 | `AXIAL-001`、`THERMAL-001/002` / `P1-AXIAL-THERMAL-v1` | `src/core/axial/` | `qa/unit/axial/` |
| 圆轴扭转与传动功率 | `TORSION-001`、`POWER-001` / `P1-TORSION-POWER-v1` | `src/core/torsion/` | `qa/unit/torsion/` |
| 平面应力、莫尔圆、弯扭组合 | `STRESS-001/002/003` / `P1-STRESS-PLANE-v1`、`P1-STRESS-BT-v1` | `src/core/stress/` | `qa/unit/stress/` |
| 欧拉压杆 | `BUCKLING-001/002` / `P1-BUCKLING-EULER-v1` | `src/core/buckling/` | `qa/unit/buckling/` |
| 单位换算 | 共享单位目录 | `src/core/units/` | `qa/unit/units/`及各功能输入适配器测试 |

全功能离线 UI 链路由 `qa/e2e/offline-ui.spec.ts` 在桌面 Chrome 与移动视口共同覆盖。

原 P1 梁公式整理未读取用户本地参考书/PDF。2026-07-26 新增截面性质明确读取用户指定的本地《英科宇机械工程师设计手册》电子版，来源与差异见 `p1-section-handbook-extensions.md`。梁公开公式门禁继续使用项目中已登记的公开基准；用户提供的验收真值保持最高验收优先级。
