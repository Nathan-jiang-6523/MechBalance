# P3 公式登记索引

## 登记规则

每条公式必须记录：公式 ID、实现版本、来源级别、访问日期、表达式、符号、单位、理论假设、边界、载荷、输出、近似性质和不适用情况。

来源级别：

- `xu-textbook`：徐芝纶教材直接覆盖。
- `official-publication`：教材未覆盖，采用官方手册或研究论文。
- `product-guardrail`：教材与来源未给统一数值，由产品设置的警告或数值护栏。

解法性质：`exact-closed-form`、`series`、`ritz-approximation`、`ideal-elastic-estimate`。

## 首版模块

| 模块 | 计划文件 | 首版公式边界 |
| --- | --- | --- |
| 薄壁圆筒 | [`p3-thin-cylinder.md`](./p3-thin-cylinder.md) | 开口/封闭端，内外压、轴力、扭矩；已登记 |
| 厚壁圆筒 | [`p3-lame-cylinder.md`](./p3-lame-cylinder.md) | 单层 Lamé，应力、轴向状态、位移；已登记 |
| 圆板 | [`p3-circular-plate.md`](./p3-circular-plate.md) | 实心、等厚、固支/简支、均布载荷；已登记 |
| 矩形板 | `p3-rectangular-plate.md` | SSSS/CCCC、均布载荷；RP-06 后置 |
| 板屈曲 | `p3-plate-buckling.md` | SSSS 单向均匀压缩 |
| 圆柱壳屈曲 | `p3-shell-buckling.md` | NASA SP-8007 简支无加劲壳均匀轴压 |

## 外部来源冻结

- 圆柱壳轴压：NASA/SP-8007-2020/REV 2，第 4.1.1 节，访问日期 `2026-07-19`。首版固定 `γ=1`，仅输出完美壳理论值并显示强警告。
- 厚壁 Lamé：进入 `P3-LM01` 前绑定徐芝纶上册最终版次、页码和公式号。
