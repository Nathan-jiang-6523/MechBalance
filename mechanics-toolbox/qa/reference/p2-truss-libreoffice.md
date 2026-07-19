# P2-TRUSS-X01 独立程序对照

## 工具与独立性

- 外部工具：LibreOffice Calc 24.2。
- 对照模型：冻结算例 P2-TRUSS-A01。
- 工作表逻辑：按 P2-TRUSS-E01 的方向余弦式显式形成各杆 `4x4` 刚度，装配总体矩阵，施加 `u1=v1=v2=0` 后求自由位移，再由 `N=EA*delta/L` 恢复杆力。
- 冻结导出：[p2-truss-libreoffice-a01.csv](p2-truss-libreoffice-a01.csv)。CSV 保留 Calc 单元格公式文本与导出数值，不接收项目计算输出。
- 自动核验：[compare_truss_libreoffice.py](compare_truss_libreoffice.py) 只使用 Python 标准库，以节点法和虚功解析式复核导出值，不导入 `src/`。

## 输入映射

| 工作表字段 | A01 输入 |
|---|---:|
| 节点坐标 | `(0,0),(4,0),(2,3) m` |
| 单元 | `1-3,2-3,1-2` |
| `E` | `200e9 Pa` |
| `A` | `0.001 m²` |
| 约束 | `u1=v1=v2=0` |
| 荷载 | `Fy3=-100000 N` |

## 判据与结论

非零量相对差 `<=1e-8`；理论零值绝对差 `<=1e-6`。比较反力 `R1x/R1y/R2y`、三根杆轴力以及 `u2x/u3x/u3y`。运行：

```powershell
python qa/reference/compare_truss_libreoffice.py
```

结构化结果写入忽略目录 `qa-results/p2-truss-libreoffice/result.json`。全部字段通过才返回退出码 0。
