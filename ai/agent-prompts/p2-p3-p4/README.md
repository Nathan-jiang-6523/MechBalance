# P2 / P3 / P4 并行开发说明

## 1. 分支基线

三条本地分支从同一 P1 完成点建立：

| 阶段 | 分支 | 目标 |
| --- | --- | --- |
| P2 | `phase/p2-structural-mechanics` | 机械接口与结构力学 |
| P3 | `phase/p3-plate-shell` | 板壳力学闭式解与屈曲初算 |
| P4 | `phase/p4-topology-optimization` | Q4 平面应力有限元与二维拓扑优化 |

创建提示词后的共同基线由主 agent 更新。分支仅保存在本地；不配置 remote，不向网上推送。

## 2. 并行工作规则

禁止三个 agent 在 `F:\mechanics` 主工作区反复切换分支。启动前由主 agent 创建独立 worktree：

```powershell
git -C F:\mechanics worktree add F:\mechanics\.worktrees\p2 phase/p2-structural-mechanics
git -C F:\mechanics worktree add F:\mechanics\.worktrees\p3 phase/p3-plate-shell
git -C F:\mechanics worktree add F:\mechanics\.worktrees\p4 phase/p4-topology-optimization
```

分配：

- P2 agent：`F:\mechanics\.worktrees\p2`
- P3 agent：`F:\mechanics\.worktrees\p3`
- P4 agent：`F:\mechanics\.worktrees\p4`
- 主 agent / 集成负责人：`F:\mechanics`

`.worktrees/` 已加入 Git 忽略，不污染主仓库状态。

## 3. 统一开发门禁

每个阶段必须按顺序通过：

1. 范围冻结：理论、边界、载荷、单位、正负号、输出、排除项。
2. 验收冻结：用户独立提供真值、容差和工程判断。
3. 公式登记：公式 ID、版本、符号、单位、假设、边界和来源。
4. 纯函数内核：不依赖 Vue、不生成 HTML。
5. 单元测试：解析解、量纲、极限、非法输入和退化状态。
6. Web UI：示意图、结果、极值、曲线、警告、LaTeX 公式。
7. 独立对照：第二套闭式解、公开工具或成熟程序。
8. 离线发布：单 HTML、无 CDN、无网络请求。
9. Chrome 验收：桌面和移动视口。
10. 用户签收：未签收不得宣称阶段完成。

确认表尚未完成时，agent 只能执行第 1–3 项的文档准备，不得抢跑实现。

## 4. 冲突控制

阶段专属目录优先：

- P2：`src/core/structural/`、`src/features/structural/`
- P3：`src/core/plate-shell/`、`src/features/plate-shell/`
- P4：`src/core/topology/`、`src/features/topology/`、`src/workers/`

共享文件包括：

- `mechanics-toolbox/src/App.vue`
- `mechanics-toolbox/package.json`
- `mechanics-toolbox/package-lock.json`
- `mechanics-toolbox/README.md`
- `mechanics-toolbox/src/core/units/`
- `mechanics-toolbox/src/core/contracts/`
- 全局样式和构建配置

规则：

- 优先复用 P1 公共能力，不复制单位表、格式化器或结果契约。
- 必须修改共享文件时，放入独立提交，提交说明以 `integration:` 开头。
- 不重命名、不搬动 P1 目录。
- 不删除其他阶段文件。
- 每个 agent 只提交自己阶段的内容。
- agent 不得审批自己编写的 diff；最终由主 agent 独立审查、合并和回归。

## 5. Git 规则

- 开始前：确认当前分支和工作区干净。
- 小步提交；一个提交只解决一个明确问题。
- 禁止 `git reset --hard`、强制推送、删除大量文件。
- 不创建 remote、不推送、不开在线 PR。
- 测试结果写入 `mechanics-toolbox/qa-results/`，继续保持 Git 忽略。
- 每次阶段交付必须给出提交列表、测试结果、未解决问题和共享文件改动。

## 6. 统一验证命令

```powershell
cd mechanics-toolbox
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

阶段专属参考对照命令由各 agent 增加，但不得让生产 HTML 依赖 Python、外部程序或网络。

## 7. 提示词文件

- `P2结构力学开发Agent提示词.md`
- `P3板壳力学开发Agent提示词.md`
- `P4拓扑优化开发Agent提示词.md`

复制相应文件全文给 agent。若确认表仍为空，agent 第一轮只做质询和计划；用户确认后再给同一 agent 继续执行。

## 8. 交接格式

每个 agent 最终必须提交：

```markdown
## 阶段结果
- 完成范围：
- 未完成范围：
- 本地提交：

## 力学可信度
- 公式版本：
- 用户验收算例：
- 独立对照：
- 适用边界和警告：

## 软件验证
- typecheck：
- unit：
- e2e：
- build：

## 集成影响
- 共享文件：
- 新依赖：
- 预期冲突：
- 建议合并顺序：
```
