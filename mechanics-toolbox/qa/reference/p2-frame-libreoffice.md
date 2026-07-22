# P2-FRAME-X01 独立程序对照

## 工具与独立性

- 外部工具：LibreOffice Calc 24.2。
- 对照模型：冻结算例 `P2-FRAME-A01` 门式刚架。
- 工作表逻辑：由 `EA/L`、`12EI/L^3`、`6EI/L^2`、`4EI/L`、`2EI/L` 构造局部 `6x6` 刚度，按方向余弦生成 `T`，以 `T^T k T` 装配总体矩阵，约束两柱脚后求解。
- 冻结导出：[p2-frame-libreoffice-a01.csv](p2-frame-libreoffice-a01.csv) 保留 Calc 数值和单元格公式文本；不接收项目求解输出。
- 独立复核：[p2-frame-compare-libreoffice.py](p2-frame-compare-libreoffice.py) 只使用 Python 标准库，自行完成高斯消元、反力和局部杆端力恢复；不导入 `src/`。

## 输入映射

| 工作表字段 | A01 输入 |
|---|---:|
| 节点坐标 | `(0,0),(0,3),(4,3),(4,0) m` |
| 单元方向 | `1->2, 2->3, 4->3` |
| `E` | `200e9 Pa` |
| `A` | `0.01 m²` |
| `I` | `8e-5 m⁴` |
| 约束 | 节点 1、4 的 `u=v=theta=0` |
| 荷载 | 节点 2、3 的 `Fx=+6000 N` |

## 判据与运行

比较 6 个自由位移、6 个支座反力/力矩、柱顶弯矩、梁端剪力与弯矩。非零量相对差 `<=2e-5`；理论零值绝对差 `<=1e-6`。

### A01 端力符号审计

冻结 fixture 的 A01 柱顶、梁端弯矩和梁剪力数值采用传统杆端 resisting action `k d-f`；fixture `common` 与 T01 所称 element-on-node 则采用相反量 `f-k d`。验收同时保留两个显式字段：A01 数值绑定 `localResistingForces`，节点物理平衡绑定 `localEndForces`。以节点 2 为例，两个单元的 `localEndForces` 转到全局后与 `Fx=+6000 N` 相加为零；`localResistingForces` 的单元和则等于外载。冻结数值不变，仅消除量名歧义。

```powershell
python qa/reference/p2-frame-compare-libreoffice.py
```

结构化结果写入忽略目录 `qa-results/p2-frame-libreoffice/result.json`；全部字段通过才返回退出码 0。
