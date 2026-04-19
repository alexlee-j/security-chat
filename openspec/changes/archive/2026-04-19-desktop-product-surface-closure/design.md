## Context

`security-chat-v2-closed-loop` 已完成并合并到 `main`，当前工作基线是从 `main` 创建的 `feature/desktop-product-surface-closure`。本 change 的目标是在该基线上兑现桌面端设计文档中的聊天产品面能力，覆盖 `docs/superpowers/specs/2026-04-07-master-design.md`、认证页面设计和聊天界面设计中除音频/视频通话外的桌面体验。

当前桌面端已有若干基础件：主题 hook、导航抽屉壳、会话搜索 UI、FAB 菜单、群创建弹窗、emoji picker、通知设置 sheet 和若干 shadcn/Radix 原子组件。问题不是完全缺组件，而是这些组件尚未形成完整、可验证、一致的产品面。

## Goals / Non-Goals

**Goals:**
- 在 `feature/desktop-product-surface-closure` 分支完成本 change，保持分支与 OpenSpec change 一一对应。
- 兑现桌面端除通话/视频外的设计文档关键交互和页面流。
- 将 UI 表层动作绑定到 2.0 已完成的核心契约，避免“看起来可点但状态不闭环”。
- 建立桌面产品面回归 gate，包括 build、关键 Playwright/desktop smoke 和设计对照清单。
- 明确 GPT / MiniMax 分工，确保高风险状态语义由 GPT 收口，低风险 UI 实现由 MiniMax 承担。

**Non-Goals:**
- 不实现音频通话、视频通话、屏幕共享、RTC 信令或媒体链路。
- 不重写 2.0 已完成的认证、Signal、群治理和同步核心能力。
- 不引入新的前端框架或替换 Tauri / React / shadcn/Radix 基础。
- 不把移动端产品面纳入本阶段。

## Decisions

### 1. 本 change 严格绑定到 `feature/desktop-product-surface-closure`

实施必须发生在 `feature/desktop-product-surface-closure`。如果发现当前分支不是该分支，应先停止实施并切换到正确分支。

理由：
- 2.0 核心闭环已经合入 `main`；
- 本阶段是新的产品面 change；
- 从 `main` 分支重新派生能保持回滚、审查和归档边界清晰。

备选方案：
- 在旧阶段分支继续开发。拒绝，因为会混淆 2.0 核心闭环和桌面产品面闭环的责任边界。

### 2. 桌面产品面按“页面流 + 行为簇”组织，而不是按组件散点实现

功能按六个行为簇推进：

1. 全局导航与页面流
2. 设计系统与主题一致性
3. 会话列表交互
4. 聊天线程交互
5. 输入区交互
6. 群管理表层

这样可以把设计文档中的交互映射到可验收场景，而不是只完成一批孤立组件。

### 3. GPT / MiniMax 按风险边界分工

GPT 负责：
- 会话列表和消息线程的状态语义；
- 删除、引用、转发、下载、失败态和重试规则；
- 群管理 UI 与后端群治理契约一致性；
- 输入区与本地消息状态机边界；
- 验收 gate、回归矩阵和风险收口。

MiniMax 负责：
- 导航抽屉、profile/settings/about 页面；
- 主题切换、搜索框、FAB、菜单、弹层；
- emoji、附件、录音入口 UI shell；
- 设计稿还原、样式整理、低风险页面拼装；
- 文档和冒烟辅助。

MiniMax 执行约束：
- 每个任务开始前必须先列出将复用的现有组件、hook、API 和样式入口。
- 能用 shadcn/Radix 组件表达的 UI 必须优先使用 `apps/desktop/src/components/ui/*` 中的现有组件；缺组件时先补标准化 primitive，再组合业务组件。
- 不允许为了局部页面快速完成而重复手写 Dialog、Sheet、Dropdown、Context Menu、Popover、Tooltip、Button、Input、Switch、Checkbox 等基础控件。
- 不允许自行决定协议、认证、消息状态、群权限、删除/转发/重试语义；这些由 GPT 给出规则矩阵或复核结论。
- 每个完成项必须同时给出验证方式：人工 smoke、Playwright、build、或明确说明为何只需静态检查。
- 如果实现需要新增后端 API、改变数据结构或改变消息/群状态语义，MiniMax 必须暂停并交由 GPT 评估。

### 4. 交互入口必须是“可用、置灰或隐藏”三选一

桌面端设计里有多个入口，例如通话、搜索、菜单、附件、录音。除音频/视频通话外，纳入本 change 的入口必须闭环；不纳入本阶段的入口必须明确置灰、隐藏或展示可解释状态，不能保留误导性的假入口。

### 5. 状态一致性优先于视觉完整度

本阶段不是纯视觉还原。会话置顶/静音/删除、消息删除/转发/引用、群成员变化、输入失败重试等行为必须与 2.0 核心状态一致。视觉还原不能绕开后端契约、本地状态机或错误状态。

### 6. UI 组件策略：shadcn/Radix 优先，业务组件只做组合

桌面端已经存在 shadcn/Radix 风格的组件基础。本阶段组件策略为：

1. 先复用现有 primitive：`Button`、`Input`、`Dialog`、`Sheet`、`DropdownMenu`、`ContextMenu`、`Popover`、`Tooltip`、`ScrollArea`、`Switch`、`Checkbox` 等。
2. 如果缺少 primitive，新增组件应放在 `apps/desktop/src/components/ui/`，保持 shadcn/Radix API 风格、可组合性和主题变量。
3. 业务组件只组合 primitive，不在业务组件里复制底层交互实现。
4. 样式优先使用现有 CSS 变量和设计系统 token，不引入孤立颜色、尺寸和阴影。
5. 对复杂交互先建立状态表，再写 UI。

这样做的原因是降低 MiniMax 执行偏差，避免多个相似菜单、弹层、按钮实现并存。

## Risks / Trade-offs

- [UI 范围扩张导致阶段失控] → 明确排除音频/视频通话，并按行为簇拆任务。
- [表层菜单实现但状态不闭环] → GPT 先定义动作规则矩阵，MiniMax 再做 UI 绑定。
- [现有半成品组件行为不一致] → 先盘点并复用可用基础件，不符合设计/状态语义的组件再重构。
- [MiniMax 产出偏离架构约束] → 在 tasks 中为 MiniMax 任务增加组件复用、状态来源和验证方式要求；涉及高风险语义时必须交由 GPT。
- [重复造 UI primitive 导致维护成本上升] → shadcn/Radix 优先，新增 primitive 只能进入共享 UI 层。
- [Playwright 覆盖成本上升] → 以关键产品流为 gate，不要求每个视觉细节都有 E2E。
- [后端契约缺口被桌面实现放大] → 仅做必要契约补丁，不在本 change 中扩展为大规模后端重构。

## Migration Plan

1. 确认当前分支为 `feature/desktop-product-surface-closure`，且基于最新 `main`。
2. 先完成桌面现状盘点和设计对照矩阵。
3. MiniMax 每个任务开始前先提交组件复用计划，GPT 对涉及状态/契约的任务先给规则矩阵。
4. 按全局导航、会话列表、聊天线程、输入区、群管理、设计 gate 顺序实施。
5. 每个行为簇完成后补对应验证：build、局部 smoke、必要 Playwright。
6. 所有行为簇完成后，执行桌面产品面回归矩阵并更新文档。

回滚策略：
- 按行为簇提交，优先回滚出问题的行为簇。
- 不回滚 2.0 核心闭环提交。
- 若群管理表层出现契约风险，回滚群 UI 表层而不是绕开群治理规则。

## Open Questions

- `/profile` 是否只展示基础账户信息，还是要包含设备列表和二维码？
- `/settings` 是否需要在本阶段落完整四类设置页，还是只保证结构完整并实现已有后端能力？
- 录音入口是否要求真实录音上传闭环，还是先以明确可解释的受限状态处理？
- 会话置顶/静音/删除是否已有后端契约可复用，还是需要补最小 API？
