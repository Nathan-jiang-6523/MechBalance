# 力学快速计算工具箱

离线 Web UI。生产交付为单个 `dist/index.html`，目标用户无需安装运行时，使用最新版 Chrome 双击打开。

## 当前 P1 开发内容

- Vue 3 + TypeScript + Vite 单 HTML 工程骨架。
- SI 内部单位引擎及常用单位换算器。
- 矩形、空心矩形、实心圆、圆管截面性质内核。
- AL6061-T6、SPCC 可编辑名义材料预设。
- 简支梁、左右固定悬臂梁解析内核：点力、点矩、分段均布载荷。
- `V/M/θ/v` 场值、跳变左右值、平衡残差、解析极值、绘图采样。
- 梁弯曲正应力；实心矩形剪应力。
- 梁综合 Web UI：载荷编辑、支承/载荷示意、反力与极值、应力、`V/M/θ/v` 曲线和适用范围警告。
- 用户确认的 48 个验收算例 JSON 及首款公式登记。

## 目录

- `src/core/`：纯计算、单位、校验和结果契约。
- `src/features/`：Web UI 功能模块。
- `qa/unit/`：单元与验收回归程序。
- `qa/e2e/`：最新版 Chrome 桌面/移动端离线验收程序。
- `qa/fixtures/`：用户确认的 48 个验收真值。
- `qa-results/`：截图、Playwright 产物及 JSON 报告；由 Git 忽略。
- `docs/formulas/`：公式 ID、版本、符号、边界和来源记录。
- `dist/index.html`：构建生成的离线单文件，不纳入 Git。

## 开发验证

```powershell
npm install
npm run typecheck
npm run test
npm run build
```

不读取或依赖仓库外的本地参考书/PDF。公式与用户验收真值冲突时，停止对应实现并提交用户裁决。
