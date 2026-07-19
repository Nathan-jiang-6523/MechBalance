# P3 板壳力学开发任务（v0.2 已冻结）

## 规格摘要

**原始需求**：

> “P3：板壳力学——矩形薄板：明确简支、固支边界；圆板轴对称弯曲；薄壁圆筒应力；厚壁圆筒 Lamé 解；板、壳屈曲初算。”

> “所有板壳计算器强制选择边界条件；不允许静默套用近似边界。”

**技术栈**：Vue 3、TypeScript、Vite、Vitest、Playwright、KaTeX/`MathFormula.vue`、CSS Variables + Scoped CSS；纯函数计算放 `mechanics-toolbox/src/core/plate-shell/`，Vue 交互放 `mechanics-toolbox/src/features/plate-shell/`；构建为完全离线单 HTML。

**Laravel/Livewire/FluxUI**：不使用。规格明确排除服务端栈；因此无 FluxUI 组件需求。

**目标时间线**：规格明确 P2–P4 在范围冻结后再细化，不提前承诺。本清单所有任务按单开发者 30–60 分钟粒度设计；范围和验收真值签收后，再按保留任务数量估算日历时间，并预留 2–3 轮修改。

**当前门禁**：用户 Nathan 于 2026-07-19 批准 P3 范围与验收基线，允许进入 Gate P3-0。首版激活 38 个验收算例；`P3-RP-06` 单正弦载荷后置。

## 任务规则

- 每项目标工时 30–60 分钟；执行中预计超过 60 分钟时，先拆分再继续。
- 每个边界/载荷组合使用独立公式 ID；近似式必须显示“近似”。
- 任何计算器边界字段为空时禁止计算；不得提供隐含默认。
- 用户真值独立于实现；不得用程序结果反填预期值。
- 公式与真值冲突时停止对应模块，请用户裁决。
- 下列条件性任务仅在 `p3-confirmation-form.md` 勾选相应范围后保留。

## A. 范围与验收门禁

### [x] P3-A01：建立隔离 worktree

**描述**：将 `phase/p3-plate-shell` 挂载到 `F:\mechanics\.worktrees\p3`。

**验收标准**：当前分支为 `phase/p3-plate-shell`；主工作区不切换分支；P3 修改只出现在该 worktree。

**文件**：Git worktree 元数据。

**对应规格**：P3 Agent 提示词“冲突和提交规则”。

### [x] P3-A02：建立 P3 决策确认表

**描述**：逐模块质询理论、边界、载荷、阈值、输出、符号和排除项。

**验收标准**：5 类计算器均有可直接勾选的决策；所有边界显式选择；状态为草稿。

**文件**：`ai/memory-bank/p3-confirmation-form.md`。

**对应规格**：P3 Agent 提示词“第一轮”。

### [x] P3-A03：建立 P3 验收算例表

**描述**：建立用户独立真值模板及最低覆盖索引。

**验收标准**：覆盖正常、边界、符号、零载荷、极限、非法输入、适用性、跨单位；无实现输出反填值。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`。

**对应规格**：P3 Agent 提示词“建议测试门”。

### [x] P3-A04：建立 30–60 分钟开发清单

**描述**：每个计算器分别拆公式、内核、UI、测试、验收。

**验收标准**：任务均有描述、验收标准、文件和规格对应；未签收实现项保持未完成。

**文件**：本文件。

**对应规格**：P3 Agent 提示词“任务拆成 30–60 分钟粒度”。

### [x] P3-A05：用户冻结 P3 范围

**描述**：力学负责人填写并签署确认表。

**验收标准**：首版模块、每模块边界/载荷、符号、阈值、输出、排除项无空白；状态改为“已完成”。

**文件**：`ai/memory-bank/p3-confirmation-form.md`。

**对应规格**：统一开发门禁 1。

### [x] P3-A06：用户提供独立验收真值

**描述**：验收负责人填写首版算例、容差和证据。

**验收标准**：每个保留模块至少含正常、边界、反例；关键结果有独立依据；不引用待验收程序输出。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`。

**对应规格**：统一开发门禁 2。

### [x] P3-A07：冻结 P3 任务基线

**描述**：根据 A05/A06 删除后置任务、补充已选工况并确认顺序。

**验收标准**：每个任务能追到确认决策和验收算例；无未确认功能进入实现队列。

**文件**：本文件。

**对应规格**：务实范围控制。

## B. Gate P3-0：公共契约

### [x] P3-B01：盘点 P1 可复用公共能力

**描述**：只检查单位、材料、数值、校验、警告、公式组件、结果契约的公开接口。

**验收标准**：形成复用映射；不复制单位表；列出确需扩展的共享文件。

**文件**：`mechanics-toolbox/docs/P3公共契约复用清单.md`；只读核对 `src/core/units/`、`materials/`、`numeric/`、`validation/`、`contracts/`。

**对应规格**：Gate P3-0。

### [x] P3-B02：定义板壳公共输入类型

**描述**：定义边界、材料、几何、载荷、公式版本和适用性类型。

**验收标准**：边界字段为必填联合类型，无 `undefined` 默认；非法组合在类型或校验层被拒绝。

**文件**：`mechanics-toolbox/src/core/plate-shell/types.ts`。

**对应规格**：所有板壳计算器显式边界。

### [x] P3-B03：定义板壳结果契约

**描述**：定义数值、单位、位置/半径、表面/方向、适用性、公式 ID、求解状态。

**验收标准**：结果无法省略控制位置和公式性质；内核不生成 HTML。

**文件**：`mechanics-toolbox/src/core/plate-shell/results.ts`。

**对应规格**：软件和 UI 规则。

### [x] P3-B04：实现公共板壳几何校验

**描述**：实现有限数、正尺寸、半径次序、厚度、泊松比和求值坐标校验。

**验收标准**：错误定位到字段；`NaN/Infinity`、`ro≤ri`、非正厚度不进入求解器。

**文件**：`mechanics-toolbox/src/core/plate-shell/validation.ts`。

**对应规格**：测试门“非法几何、非有限数”。

### [x] P3-B05：实现适用比值警告契约

**描述**：把用户确认的薄板、薄壁、壳体比值转成显式提醒/强警告/禁止状态。

**验收标准**：阈值来自确认表；无开发端自定强制阈值；结果带实际比值。

**文件**：`mechanics-toolbox/src/core/plate-shell/applicability.ts`。

**对应规格**：软件和 UI 规则“不得静默继续”。

### [x] P3-B06：建立公式登记索引

**描述**：创建 P3 公式文档索引、版本规则和来源字段。

**验收标准**：每条公式含 ID、版本、访问日期、符号、单位、理论、边界、载荷、近似性质。

**文件**：`mechanics-toolbox/docs/formulas/p3-index.md`。

**对应规格**：力学和公式规则。

### [x] P3-B07：建立 P3 fixture JSON schema

**描述**：把用户算例映射为独立 fixture 结构，不录入待定预期值。

**验收标准**：支持输入、预期、容差、来源、符号转换、状态；schema 与实现类型分离。

**文件**：`mechanics-toolbox/qa/fixtures/p3-schema.ts`。

**对应规格**：真值独立于实现。

### [x] P3-B08：测试公共板壳契约

**描述**：覆盖必填边界、非法几何、非有限数和适用性状态。

**验收标准**：所有反例均失败于求解前；无默认边界进入结果。

**文件**：`mechanics-toolbox/qa/unit/plate-shell-contracts.test.ts`。

**对应规格**：建议测试门。

### [x] P3-B09：定义全局单位制选择契约（integration）

**描述**：在复用 P1 单位表的前提下，定义默认 `t–mm–s–N–MPa` 与 SI `kg–m–s–N–Pa` 两套显示预设；内部值始终保持 SI。

**验收标准**：切换只改变有限显示值和标签，不改物理问题、边界和结果状态；空字段保持空；非法文本不静默改写。

**文件**：现有 `mechanics-toolbox/src/core/units/` 共享契约及独立设计记录。

**对应规格**：用户 2026-07-19 单位 UI 确认；共享文件修改必须独立 `integration:` 提交。

### [x] P3-B10：测试全局单位制往返（integration）

**描述**：用 P3-COM-01 和 P1 既有单位用例验证工程/SI 往返。

**验收标准**：SI 规范值满足 `rtol=1e-12`；P1 回归不变；单位选择器不引入 P3 专属计算依赖。

**文件**：共享单位测试、`mechanics-toolbox/qa/unit/p3-units.test.ts`。

**对应规格**：单位换算复用与 P1 遗留项显式授权。

## C. Gate P3-1A：薄壁圆筒

### [x] P3-TW01：登记压力膜应力公式

**描述**：按确认的半径、压力符号和端部状态登记环向/轴向膜应力。

**验收标准**：开口/封闭端独立公式 ID；内外压和适用判据明确；不含未确认载荷。

**文件**：`mechanics-toolbox/docs/formulas/p3-thin-cylinder.md`。

**对应规格**：薄壁圆筒质询 T01–T04。

### [x] P3-TW02：登记轴力/扭矩组合公式（条件性）

**描述**：登记外加轴力、扭矩、主应力和强度准则。

**验收标准**：仅在确认表选中后实施；控制表面/方向和叠加假设明确。

**文件**：`mechanics-toolbox/docs/formulas/p3-thin-cylinder.md`。

**对应规格**：薄壁圆筒载荷与组合输出。

### [x] P3-TW03：定义薄壁圆筒输入/输出类型

**描述**：定义几何、端部、压力、可选轴力/扭矩和结果。

**验收标准**：端部状态必填；半径定义不可混用；输出标明膜应力近似。

**文件**：`mechanics-toolbox/src/core/plate-shell/thin-cylinder/types.ts`。

**对应规格**：边界必须明确。

### [x] P3-TW04：实现薄壁适用性校验

**描述**：计算确认的 `t/r` 或 `D/t` 指标并执行超限策略。

**验收标准**：阈值边界两侧行为与 P3-TW-05 真值一致；超限不宣称有效。

**文件**：`mechanics-toolbox/src/core/plate-shell/thin-cylinder/validate.ts`。

**对应规格**：薄壁判据。

### [x] P3-TW05：实现环向/轴向应力内核

**描述**：实现内外压和开口/封闭端的纯函数应力解。

**验收标准**：零压为零；压力差符号反转时应力反转；开口端不静默加入封闭端轴向应力。

**文件**：`mechanics-toolbox/src/core/plate-shell/thin-cylinder/solve.ts`。

**对应规格**：Gate P3-1。

### [x] P3-TW06：实现组合应力内核（条件性）

**描述**：叠加轴力/扭矩，调用 P1 应力准则公共能力。

**验收标准**：不复制主应力/von Mises/Tresca 内核；纯压力、纯轴力、纯扭矩退化正确。

**文件**：`mechanics-toolbox/src/core/plate-shell/thin-cylinder/combined.ts`。

**对应规格**：复用 P1 公共能力。

### [x] P3-TW07：编写薄壁单元测试

**描述**：覆盖 P3-TW-01～06、量纲、零载荷、符号和非法输入。

**验收标准**：用户真值在容差内；边界未选和超限行为准确。

**文件**：`mechanics-toolbox/qa/unit/thin-cylinder.test.ts`、`qa/fixtures/p3-thin-cylinder.json`。

**对应规格**：建议测试门。

### [x] P3-TW08：实现薄壁圆筒输入 UI

**描述**：按边界→几何→材料→载荷顺序实现表单。

**验收标准**：端部为空时禁止计算；单位持续显示；字段随已确认工况出现。

**文件**：`mechanics-toolbox/src/features/plate-shell/thin-cylinder/ThinCylinderCalculator.vue`。

**对应规格**：软件和 UI 规则。

### [x] P3-TW09：实现薄壁圆筒示意图

**描述**：显示内外半径、厚度、压力、轴线、环向和端部状态。

**验收标准**：箭头与符号一致；开口/封闭端可辨；移动端标注不重叠。

**文件**：`mechanics-toolbox/src/features/plate-shell/thin-cylinder/ThinCylinderDiagram.vue`。

**对应规格**：示意图规则。

### [x] P3-TW10：实现薄壁结果与警告 UI

**描述**：显示环向/轴向/组合结果、单位、方向、适用比值和公式。

**验收标准**：明确“薄壁膜应力近似”；超限警告自动展开；无未确认结果。

**文件**：`mechanics-toolbox/src/features/plate-shell/thin-cylinder/ThinCylinderResults.vue`。

**对应规格**：结果显示规则。

### [x] P3-TW11：薄壁 E2E 与移动验收

**描述**：测试端部必选、正常计算、超限、单位和移动端图示。

**验收标准**：关键交互通过；无水平溢出、标注重叠或旧成功结果残留。

**文件**：`mechanics-toolbox/qa/e2e/thin-cylinder.spec.ts`。

**对应规格**：Chrome 验收。

### [x] P3-TW12：薄壁圆筒用户算例验收

**描述**：与验收负责人逐项核对 P3-TW-01～06 的输入、结果、方向、警告和工程含义。

**验收标准**：全部首版算例在已签容差内；开口/封闭端差异获用户确认；遗留差异有裁决记录。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`、`mechanics-toolbox/qa/fixtures/p3-thin-cylinder.json`。

**对应规格**：每个计算器单独验收。

## D. Gate P3-1B：厚壁圆筒 Lamé 解

### [x] P3-LM01：登记 Lamé 应力公式

**描述**：登记 `σr/σθ`、压力边界、符号转换和求值区间。

**验收标准**：内外表面边界可直接代入核对；公式 ID、轴向假设和版本完整。

**文件**：`mechanics-toolbox/docs/formulas/p3-lame-cylinder.md`。

**对应规格**：厚壁圆筒 L01–L03。

### [x] P3-LM02：登记轴向应力公式

**描述**：分别登记确认的开口端、封闭端、平面应变或外加轴力工况。

**验收标准**：每种轴向边界独立 ID；未确认状态不能进入 solver。

**文件**：`mechanics-toolbox/docs/formulas/p3-lame-cylinder.md`。

**对应规格**：厚壁圆筒轴向假设。

### [x] P3-LM03：登记位移公式（条件性）

**描述**：按确认的平面应力/应变/三维假设登记 `u(r)`。

**验收标准**：写清 `E/ν`、轴向约束和位移正号；若未确认则任务后置。

**文件**：`mechanics-toolbox/docs/formulas/p3-lame-cylinder.md`。

**对应规格**：厚壁圆筒位移范围。

### [x] P3-LM04：定义 Lamé 输入/输出类型

**描述**：定义 `ri/ro/pi/po`、轴向状态、求值半径和结果。

**验收标准**：轴向状态必填；求值半径限制在闭区间；输出表面/方向明确。

**文件**：`mechanics-toolbox/src/core/plate-shell/lame-cylinder/types.ts`。

**对应规格**：边界必须完整。

### [x] P3-LM05：实现 Lamé 常数与应力内核

**描述**：实现单层厚壁圆筒纯函数应力场。

**验收标准**：`σr(ri)`、`σr(ro)` 满足压力边界；内外压对调和零压行为正确。

**文件**：`mechanics-toolbox/src/core/plate-shell/lame-cylinder/stress.ts`。

**对应规格**：Gate P3-1。

### [x] P3-LM06：实现轴向结果内核

**描述**：实现已确认轴向边界，保持与径向/环向解分离。

**验收标准**：开口、封闭、平面应变结果不混用；公式 ID 与输入状态一致。

**文件**：`mechanics-toolbox/src/core/plate-shell/lame-cylinder/axial.ts`。

**对应规格**：厚壁圆筒轴向范围。

### [x] P3-LM07：实现位移内核（条件性）

**描述**：实现已确认假设下的 `u(r)`。

**验收标准**：边界和量纲测试通过；未选轴向假设时不返回位移。

**文件**：`mechanics-toolbox/src/core/plate-shell/lame-cylinder/displacement.ts`。

**对应规格**：厚壁圆筒位移范围。

### [x] P3-LM08：实现薄壁极限对照

**描述**：计算 Lamé 解在确认薄壁比值下与薄壁膜解的差异。

**验收标准**：对照逻辑独立展示相对差；不把一套实现输出作为另一套真值。

**文件**：`mechanics-toolbox/qa/unit/lame-thin-limit.test.ts`。

**对应规格**：测试门“薄壁极限与 Lamé 解趋近”。

### [x] P3-LM09：编写 Lamé 单元测试

**描述**：覆盖 P3-LM-01～08、量纲、边界压力、符号、非法半径和非有限数。

**验收标准**：用户真值通过；边界应力使用直接断言；冲突时停止模块。

**文件**：`mechanics-toolbox/qa/unit/lame-cylinder.test.ts`、`qa/fixtures/p3-lame-cylinder.json`。

**对应规格**：建议测试门。

### [x] P3-LM10：实现 Lamé 输入 UI

**描述**：实现轴向边界、几何、材料、压力和求值半径输入。

**验收标准**：轴向状态为空时禁止计算；`ri/ro` 与图示同步；单位可选。

**文件**：`mechanics-toolbox/src/features/plate-shell/lame-cylinder/LameCylinderCalculator.vue`。

**对应规格**：软件和 UI 规则。

### [x] P3-LM11：实现 Lamé 示意图与结果 UI

**描述**：显示截面压力方向、半径、厚度、应力曲线和表面结果。

**验收标准**：内外表面不混淆；压力箭头方向正确；结果带半径/方向/单位/公式。

**文件**：`LameCylinderDiagram.vue`、`LameCylinderResults.vue`。

**对应规格**：示意图和结果规则。

### [x] P3-LM12：Lamé E2E 与移动验收

**描述**：测试边界必选、求值半径、压力符号、错误和移动布局。

**验收标准**：表面边界结果可见；无横向溢出或标注重叠。

**文件**：`mechanics-toolbox/qa/e2e/lame-cylinder.spec.ts`。

**对应规格**：Chrome 验收。

### [x] P3-LM13：厚壁圆筒用户算例验收

**描述**：与验收负责人核对 P3-LM-01～08 的表面边界、应力梯度、轴向状态和薄壁极限。

**验收标准**：全部首版算例在已签容差内；内外表面和轴向假设获用户确认；差异有裁决记录。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`、`mechanics-toolbox/qa/fixtures/p3-lame-cylinder.json`。

**对应规格**：每个计算器单独验收。

## E. Gate P3-2：圆板轴对称弯曲

### [x] P3-CP01：登记首个边界/载荷公式

**描述**：只登记确认的一个边界 + 一个载荷垂直切片。

**验收标准**：公式含 `w/Mr/Mθ`、中心条件、周边条件、表面应力关系和适用性。

**文件**：`mechanics-toolbox/docs/formulas/p3-circular-plate.md`。

**对应规格**：Gate P3-2。

### [x] P3-CP02：核对首个圆板公式边界

**描述**：手工代入中心、周边和零载荷条件。

**验收标准**：形成可测试恒等式；公式与用户 P3-CP-01～03 无冲突。

**文件**：`mechanics-toolbox/docs/formulas/p3-circular-plate.md`。

**对应规格**：先过中心、边界、极限条件。

### [x] P3-CP03：定义圆板输入/输出类型

**描述**：定义实心/环形、边界、载荷、半径求值和结果。

**验收标准**：边界必填；未确认几何/载荷无法构造；中心奇点状态可表达。

**文件**：`mechanics-toolbox/src/core/plate-shell/circular-plate/types.ts`。

**对应规格**：圆板范围质询。

### [x] P3-CP04：实现首个圆板挠度内核

**描述**：实现确认垂直切片的 `w(r)` 纯函数。

**验收标准**：中心有限/对称条件、周边位移条件、零载荷和符号反转通过。

**文件**：`mechanics-toolbox/src/core/plate-shell/circular-plate/deflection.ts`。

**对应规格**：Gate P3-2。

### [x] P3-CP05：实现圆板弯矩/应力恢复

**描述**：由已确认理论计算 `Mr/Mθ` 和正反面应力。

**验收标准**：方向、表面和单位明确；中心退化稳定；不返回未确认结果。

**文件**：`mechanics-toolbox/src/core/plate-shell/circular-plate/stress.ts`。

**对应规格**：圆板输出和应力符号。

### [x] P3-CP06：编写首个圆板单元测试

**描述**：覆盖 P3-CP-01～03、零载荷、符号、边界和非法几何。

**验收标准**：用户真值与闭式恒等式均通过；量纲正确。

**文件**：`mechanics-toolbox/qa/unit/circular-plate.test.ts`、`qa/fixtures/p3-circular-plate.json`。

**对应规格**：圆板测试门。

### [x] P3-CP07：登记第二边界/载荷公式（条件性）

**描述**：首个切片通过后，登记确认的下一工况。

**验收标准**：独立公式 ID；奇点/边界性质明确；不复用错误边界系数。

**文件**：`mechanics-toolbox/docs/formulas/p3-circular-plate.md`。

**对应规格**：通过首切片后再扩展。

### [x] P3-CP08：实现第二工况内核（条件性）

**描述**：扩展已确认的第二工况分支。

**验收标准**：首工况回归不变；新工况用户真值和边界条件通过。

**文件**：`mechanics-toolbox/src/core/plate-shell/circular-plate/solve.ts`。

**对应规格**：Gate P3-2 扩展规则。

### [x] P3-CP09：实现圆板输入 UI

**描述**：实现边界、几何、材料、载荷和半径控制。

**验收标准**：边界为空禁止计算；只展示确认载荷；中心奇点提示清楚。

**文件**：`mechanics-toolbox/src/features/plate-shell/circular-plate/CircularPlateCalculator.vue`。

**对应规格**：软件和 UI 规则。

### [x] P3-CP10：实现圆板示意图

**描述**：显示半径坐标、周边边界、正反面和载荷方向。

**验收标准**：`r=0/a`、压力箭头、表面定义可辨；移动端无重叠。

**文件**：`CircularPlateDiagram.vue`。

**对应规格**：Gate P3-2 图示规则。

### [x] P3-CP11：实现圆板结果 UI

**描述**：显示中心/最大挠度、弯矩、表面应力、位置和适用性。

**验收标准**：每项带半径/表面/方向/单位/公式 ID；理论假设可展开。

**文件**：`CircularPlateResults.vue`。

**对应规格**：结果显示规则。

### [x] P3-CP12：圆板 E2E 与移动验收

**描述**：测试边界必选、首工况、警告、单位和示意图。

**验收标准**：P3-CP-01 UI 结果通过；桌面/移动无溢出、标注重叠。

**文件**：`mechanics-toolbox/qa/e2e/circular-plate.spec.ts`。

**对应规格**：Chrome 验收。

### [x] P3-CP13：圆板用户算例验收

**描述**：与验收负责人核对 P3-CP-01～06 的中心条件、周边条件、表面方向和适用性。

**验收标准**：全部首版算例在已签容差内；中心奇点/后置工况处理获用户确认；差异有裁决记录。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`、`mechanics-toolbox/qa/fixtures/p3-circular-plate.json`。

**对应规格**：每个计算器单独验收。

## F. Gate P3-3：矩形薄板

### [x] P3-RP01：登记首个边界/载荷公式

**描述**：登记确认的首个组合，建议候选为 `SSSS + 全板均布压力`，不预设为已确认。

**验收标准**：独立公式 ID；坐标、挠度、弯矩、应力和边界完整。

**文件**：`mechanics-toolbox/docs/formulas/p3-rectangular-plate.md`。

**对应规格**：每个边界/载荷组合独立公式 ID。

### [x] P3-RP02：定义矩形板级数策略

**描述**：按确认表冻结项集、最大项数、收敛量、容限和未收敛处理。

**验收标准**：算法能输出截断项数、收敛状态、误差估计；规则不依赖 UI。

**文件**：`mechanics-toolbox/docs/formulas/p3-rectangular-plate.md`。

**对应规格**：级数截断规则和误差判断。

### [x] P3-RP03：定义矩形板输入/输出类型

**描述**：定义 `a/b/t`、边界、载荷、级数配置和结果。

**验收标准**：边界必填且无默认；每种载荷是判别联合；结果含收敛元数据。

**文件**：`mechanics-toolbox/src/core/plate-shell/rectangular-plate/types.ts`。

**对应规格**：Gate P3-3。

### [x] P3-RP04：实现级数求和器

**描述**：实现稳定求和、项计数、相邻截断误差估计和上限停止。

**验收标准**：固定项数可复现；自适应策略符合确认值；非收敛不伪装成功。

**文件**：`mechanics-toolbox/src/core/plate-shell/rectangular-plate/series.ts`。

**对应规格**：级数收敛要求。

### [x] P3-RP05：实现首个矩形板挠度内核

**描述**：实现确认组合的 `w(x,y)` 和中心/最大值候选。

**验收标准**：边界条件、对称性、零载荷、符号和 P3-RP-01 真值通过。

**文件**：`mechanics-toolbox/src/core/plate-shell/rectangular-plate/deflection.ts`。

**对应规格**：矩形薄板输出。

### [x] P3-RP06：实现矩形板弯矩/应力恢复

**描述**：实现已确认的 `Mx/My/Mxy` 和正反面应力。

**验收标准**：坐标、表面、方向和单位完整；边界/中心关键点通过用户真值。

**文件**：`mechanics-toolbox/src/core/plate-shell/rectangular-plate/stress.ts`。

**对应规格**：矩形薄板输出。

### [x] P3-RP07：编写级数与首工况测试

**描述**：覆盖 P3-RP-01～05、截断、收敛、长宽比、薄板阈值和非法输入。

**验收标准**：两档截断关系正确；长宽比极限通过；未收敛状态明确。

**文件**：`mechanics-toolbox/qa/unit/rectangular-plate.test.ts`、`qa/fixtures/p3-rectangular-plate.json`。

**对应规格**：矩形板测试门。

### [x] P3-RP08：登记固支公式/系数（条件性）

**描述**：若确认 `CCCC`，登记来源、边界、长宽比范围和近似性质。

**验收标准**：近似系数不标为精确解；超表格范围策略明确；独立公式 ID。

**文件**：`mechanics-toolbox/docs/formulas/p3-rectangular-plate.md`。

**对应规格**：固支近似不得伪装精确解。

### [x] P3-RP09：实现固支工况（条件性）

**描述**：实现确认的 `CCCC` 方法，不泛化到混合边界。

**验收标准**：用户真值通过；UI 和结果明确近似性质；不影响 `SSSS` 回归。

**文件**：`mechanics-toolbox/src/core/plate-shell/rectangular-plate/clamped.ts`。

**对应规格**：明确简支/固支边界。

### [ ] P3-RP10：登记第二载荷公式（后续版本）

**描述**：首版完成后再登记 `P3-RP-06` 单正弦载荷；本任务不进入首版发布门。

**验收标准**：独立公式 ID；作用区、奇点/不连续、边界和收敛行为明确。

**文件**：`mechanics-toolbox/docs/formulas/p3-rectangular-plate.md`。

**对应规格**：载荷范围。

### [ ] P3-RP10B：实现第二载荷内核（后续版本）

**描述**：后续版本实现 RP10 已登记载荷，不扩展其他边界/载荷组合。

**验收标准**：用户真值和收敛测试通过；首个载荷回归不变。

**文件**：`mechanics-toolbox/src/core/plate-shell/rectangular-plate/loads.ts`。

**对应规格**：每个边界/载荷组合独立实现。

### [x] P3-RP11：实现矩形板输入 UI

**描述**：实现边界、几何、材料、载荷和级数配置输入。

**验收标准**：边界为空禁止计算；无隐含默认；仅展示已确认组合。

**文件**：`mechanics-toolbox/src/features/plate-shell/rectangular-plate/RectangularPlateCalculator.vue`。

**对应规格**：Gate P3-3。

### [x] P3-RP12：实现矩形板示意图

**描述**：显示四边边界符号、`x/y/z`、正反面和载荷作用区。

**验收标准**：简支/固支可辨；箭头方向与符号一致；移动端无重叠。

**文件**：`RectangularPlateDiagram.vue`。

**对应规格**：示意图规则。

### [x] P3-RP13：实现矩形板结果 UI

**描述**：显示挠度、弯矩、应力、位置、收敛状态、误差和适用性。

**验收标准**：长级数公式可横向滚动；未收敛或近似结果显著标记。

**文件**：`RectangularPlateResults.vue`。

**对应规格**：结果和级数规则。

### [x] P3-RP14：矩形板 E2E 与移动验收

**描述**：测试边界必选、首工况、收敛失败、适用性和移动图示。

**验收标准**：P3-RP-01 UI 真值通过；无溢出、重叠或隐含边界。

**文件**：`mechanics-toolbox/qa/e2e/rectangular-plate.spec.ts`。

**对应规格**：Chrome 验收。

### [x] P3-RP15：矩形板用户算例验收

**描述**：与验收负责人核对 P3-RP-01～08 的边界、关键点、级数收敛、近似性质和适用性。

**验收标准**：全部首版算例在已签容差内；固支近似标签和未收敛处理获用户确认；差异有裁决记录。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`、`mechanics-toolbox/qa/fixtures/p3-rectangular-plate.json`。

**对应规格**：每个计算器单独验收。

## G. Gate P3-4：板壳屈曲初算

### [x] P3-BK01：登记首个板屈曲公式

**描述**：登记确认的矩形板几何、边界、载荷、屈曲系数和模态规则。

**验收标准**：公式只适用于绑定工况；输出固定定义为理想弹性初算。

**文件**：`mechanics-toolbox/docs/formulas/p3-plate-buckling.md`。

**对应规格**：Gate P3-4。

### [x] P3-BK02：实现板屈曲系数/模态搜索

**描述**：实现确认的 `k` 或 `m/n` 搜索范围。

**验收标准**：控制模态可复现；搜索上限和未收敛状态明确；边界不匹配被拒绝。

**文件**：`mechanics-toolbox/src/core/plate-shell/buckling/plate-modes.ts`。

**对应规格**：边界条件和屈曲系数来源。

### [x] P3-BK03：实现板屈曲临界量内核

**描述**：计算确认的临界应力/载荷及可选安全系数。

**验收标准**：量纲、厚度尺度关系、P3-BP-01 真值和非法载荷通过。

**文件**：`mechanics-toolbox/src/core/plate-shell/buckling/plate.ts`。

**对应规格**：板屈曲初算。

### [x] P3-BK04：登记首个圆柱壳屈曲公式

**描述**：登记确认的轴压或外压工况、端部、系数、比值范围和缺陷敏感性。

**验收标准**：边界绑定明确；来源可追溯；不宣称真实承载力。

**文件**：`mechanics-toolbox/docs/formulas/p3-shell-buckling.md`。

**对应规格**：圆柱壳屈曲范围。

### [x] P3-BK05：实现圆柱壳临界量内核

**描述**：实现一个已确认壳体工况的临界应力/压力/载荷。

**验收标准**：P3-BS-01 真值通过；端部为空禁止；超比值执行确认策略。

**文件**：`mechanics-toolbox/src/core/plate-shell/buckling/cylinder.ts`。

**对应规格**：Gate P3-4。

### [x] P3-BK06：实现屈曲理论上限警告

**描述**：统一生成理想弹性、缺陷敏感、规范折减排除等警告。

**验收标准**：壳体强警告不可折叠隐藏；任何成功结果带“理想弹性理论值/初算”。

**文件**：`mechanics-toolbox/src/core/plate-shell/buckling/warnings.ts`。

**对应规格**：屈曲警告规则。

### [x] P3-BK07：编写板屈曲单元测试

**描述**：覆盖 P3-BP-01～04、模态、长宽比、边界系数和非法几何。

**验收标准**：用户真值通过；系数/边界不匹配拒绝；理想理论标签存在。

**文件**：`mechanics-toolbox/qa/unit/plate-buckling.test.ts`、`qa/fixtures/p3-plate-buckling.json`。

**对应规格**：屈曲测试门。

### [x] P3-BK08：编写壳屈曲单元测试

**描述**：覆盖 P3-BS-01～04、适用比值、零/反向载荷、非法边界和强警告。

**验收标准**：用户真值通过；缺陷敏感强警告必现；超范围行为正确。

**文件**：`mechanics-toolbox/qa/unit/shell-buckling.test.ts`、`qa/fixtures/p3-shell-buckling.json`。

**对应规格**：屈曲测试门。

### [x] P3-BK09：实现屈曲输入 UI

**描述**：按对象、边界、几何、材料、载荷顺序实现表单。

**验收标准**：边界和工况均显式选择；不允许任意 `k` 静默覆盖公式值。

**文件**：`mechanics-toolbox/src/features/plate-shell/buckling/BucklingCalculator.vue`。

**对应规格**：软件和 UI 规则。

### [x] P3-BK10：实现板/壳屈曲示意图

**描述**：分别显示板边界、压缩方向、壳体端部和压力/轴力方向。

**验收标准**：边界与系数工况一致；移动端标注无重叠。

**文件**：`BucklingDiagram.vue`。

**对应规格**：示意图规则。

### [x] P3-BK11：实现屈曲结果 UI

**描述**：显示临界量、控制模态、适用比值、安全系数和强警告。

**验收标准**：“理想弹性理论值/初算”固定可见；不出现“真实极限承载力”表述。

**文件**：`BucklingResults.vue`。

**对应规格**：Gate P3-4。

### [x] P3-BK12：屈曲 E2E 与移动验收

**描述**：测试边界/工况必选、正常算例、超范围和固定警告。

**验收标准**：P3-BP-01/P3-BS-01 UI 真值通过；警告不可遗漏；无布局问题。

**文件**：`mechanics-toolbox/qa/e2e/buckling.spec.ts`。

**对应规格**：Chrome 验收。

### [x] P3-BK13：板屈曲用户算例验收

**描述**：与验收负责人核对 P3-BP-01～04 的边界系数、控制模态、临界量和理论上限提示。

**验收标准**：全部首版板屈曲算例通过；用户确认结果只代表理想弹性初算；差异有裁决记录。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`、`mechanics-toolbox/qa/fixtures/p3-plate-buckling.json`。

**对应规格**：每个计算器单独验收。

### [x] P3-BK14：壳屈曲用户算例验收

**描述**：与验收负责人核对 P3-BS-01～04 的端部、适用比值、临界量和缺陷敏感强警告。

**验收标准**：全部首版壳屈曲算例通过；用户确认不将理论值视为真实承载力；差异有裁决记录。

**文件**：`ai/memory-bank/p3-acceptance-cases-form.md`、`mechanics-toolbox/qa/fixtures/p3-shell-buckling.json`。

**对应规格**：每个计算器单独验收。

## H. 集成、独立对照与发布门

### [x] P3-H01：建立 P3 模块注册表

**描述**：在 P3 专属目录聚合已完成计算器元数据。

**验收标准**：只注册已过单元测试和用户真值的模块；版本/公式 ID 可见。

**文件**：`mechanics-toolbox/src/features/plate-shell/index.ts`。

**对应规格**：公共契约。

### [x] P3-H02：接入主导航（独立 integration 提交）

**描述**：把 P3 入口接入 `App.vue`，不改 P2/P4 专属目录。

**验收标准**：提交说明以 `integration:` 开头；P1 导航和计算器回归不变。

**文件**：`mechanics-toolbox/src/App.vue`。

**对应规格**：共享文件冲突规则。

### [x] P3-H03：登记 P3 独立公开对照

**描述**：为每个关键结果选择第二类闭式解/成熟工具并固定版本或访问日期。

**验收标准**：来源不依赖用户本地书籍；对照与生产实现独立；符号转换记录完整。

**文件**：`mechanics-toolbox/docs/formulas/p3-independent-checks.md`。

**对应规格**：关键结果两类独立证据。

### [x] P3-H04：实现薄壁/厚壁独立对照测试

**描述**：对圆筒关键点运行独立闭式计算或成熟工具对照。

**验收标准**：用户真值和独立对照均在各自容差内；差异报告不反改真值。

**文件**：`mechanics-toolbox/qa/unit/p3-cylinder-reference.test.ts`。

**对应规格**：独立对照门禁。

### [x] P3-H05：实现板弯曲独立对照测试

**描述**：对圆板/矩形板首工况关键点运行独立对照。

**验收标准**：边界、坐标和符号转换明确；级数误差与来源精度分开报告。

**文件**：`mechanics-toolbox/qa/unit/p3-plate-reference.test.ts`。

**对应规格**：独立对照门禁。

### [x] P3-H06：实现屈曲独立对照测试

**描述**：对已确认板/壳屈曲公式使用第二来源或成熟工具核对。

**验收标准**：系数与边界一一对应；来源差异不被静默平均。

**文件**：`mechanics-toolbox/qa/unit/p3-buckling-reference.test.ts`。

**对应规格**：独立对照门禁。

### [x] P3-H07：执行 P3 跨单位回归

**描述**：同一物理问题用工程/SI 字段单位输入。

**验收标准**：结果在用户容差内物理等价；单位切换不改边界或公式工况。

**文件**：`mechanics-toolbox/qa/unit/p3-units.test.ts`。

**对应规格**：复用 P1 单位契约。

### [x] P3-H08：执行桌面/移动截图回归

**描述**：覆盖所有 P3 页面边界标注、公式、警告和结果布局。

**验收标准**：桌面/移动无横向溢出、遮挡、重叠、空白公式；截图写入忽略目录。

**文件**：`mechanics-toolbox/qa/e2e/p3-visual.spec.ts`、`qa-results/`。

**对应规格**：Playwright 截图验收。

### [x] P3-H09：执行离线单 HTML 验收

**描述**：构建并用 `file://` 打开生产 HTML，检查外部请求。

**验收标准**：无 CDN、后台、网络依赖；全部 P3 公式、图示和交互可用。

**文件**：`mechanics-toolbox/dist/index.html`（忽略产物）。

**对应规格**：单 HTML 离线运行。

### [x] P3-H10：执行完整验证

**描述**：运行类型、单测、构建和 E2E。

**验收标准**：以下命令全部通过，且不启动后台进程：

```powershell
cd mechanics-toolbox
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

**文件**：测试输出写入现有忽略目录。

**对应规格**：P3 Agent 提示词“验证和交付”。

### [x] P3-H11：更新 P3 公式/真值追溯矩阵

**描述**：把每个 UI 结果映射到公式 ID、内核函数、用户算例和独立对照。

**验收标准**：无孤立结果；近似/理想弹性标签与公式性质一致。

**文件**：`mechanics-toolbox/docs/formulas/p3-traceability.md`。

**对应规格**：力学可信度交付。

### [x] P3-H12：编写 P3 交接记录

**描述**：按并行 README 模板报告范围、提交、公式、真值、对照、验证和集成影响。

**验收标准**：未签收时只写“P3 开发候选完成”；列出所有未完成范围和共享文件。

**文件**：交接消息；必要时更新阶段文档。

**对应规格**：并行 README 交接格式。

### [x] P3-H13：用户执行 P3 工程签收

**描述**：用户核查工程含义、边界、警告、真值和离线交付。

**验收标准**：用户明确签收；未解决问题进入独立遗留项，不静默改范围。

**文件**：确认表和验收表签收记录。

**对应规格**：统一开发门禁 10。

## 质量要求

- [x] FluxUI 组件：不适用；项目不使用 Laravel/Livewire/FluxUI。
- [x] 所有命令不能有后台进程；绝对不加 `&`。
- [x] 不写启动服务器命令；默认开发服务器已运行。
- [x] 必须适配桌面与移动端。
- [x] 所有计算器必须显式选择边界条件。
- [x] 表单非法时旧结果失效，禁止显示成功状态。
- [x] 图片优先使用自绘 SVG；如需外部占位图，只用 Unsplash 或 `https://picsum.photos/`，不用 Pexels。
- [x] 公式统一使用 `MathFormula.vue`；长公式允许横向滚动。
- [x] 执行项目 Playwright：`npm run test:e2e`。
- [x] 如仓库提供通用截图脚本，执行：`./qa-playwright-capture.sh http://localhost:8000 public/qa-screenshots`；当前不得为满足命令擅自启动服务器或新增脚本。
- [x] 运行 `npm run typecheck`、`npm run test`、`npm run build`。
- [x] 不读取用户本地参考书/PDF，不读取用户排除目录。
- [x] 不修改 P2/P4 专属目录，不创建 remote，不推送。
- [x] 不审批自己的 diff；由主 agent/用户独立审查。

## 技术说明

**开发技术栈**：Vue 3 + TypeScript + Vite；纯函数内核；Vitest；Playwright；KaTeX；ECharts 仅在已确认曲线需求时按现有依赖使用；单 HTML 离线构建。

**特殊说明**：P1 公共单位、材料、校验、警告、公式组件和结果契约必须复用；共享文件修改单独使用 `integration:` 提交。固支近似不得冒充精确解；所有屈曲结果固定标注“理想弹性理论值/初算”。

**时间线预期**：A05、A06、A07 已完成。按首版实际保留任务重新估算；日历计划必须包含公式审核、用户真值反馈、独立对照和 2–3 轮修改，不把 RP-06 后续任务计入首版。
