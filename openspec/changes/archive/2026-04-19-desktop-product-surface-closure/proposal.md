## Why

Security Chat 2.0 核心闭环已经从协议、认证、群治理、同步可靠性和发布门槛层面完成，但桌面端仍有大量产品表层能力没有按 2026-04-07 设计文档兑现。现在需要在 2.0 核心闭环之上补齐桌面产品面，使应用从“核心可用”进入“桌面聊天产品完整可用”状态。

本 change 必须在 `feature/desktop-product-surface-closure` 分支实施。该分支已基于包含 2.0 核心闭环的 `main` 创建；不得在旧阶段分支上继续叠加本 change。

## What Changes

- 完成桌面端全局导航产品面：导航抽屉、个人中心、设置、关于、退出登录确认与页面流转。
- 完成桌面端主题和设计系统兑现：浅色、深色、自动模式，设计变量、布局、最小窗口和跨平台一致性。
- 完成会话列表产品面：会话搜索、选中态、置顶、静音、删除会话、复制会话 ID、未读与摘要展示一致性。
- 完成聊天线程产品面：聊天头部更多菜单、消息右键菜单、复制、引用、转发、删除、下载、搜索命中定位。
- 完成输入区产品面：emoji、附件、录音入口、引用态、发送按钮状态、输入内容优先级。
- 完成群管理表层：群资料入口、群成员列表、加人、移人、退群、成员变化提示，并与 2.0 群治理规则一致。
- 完成桌面产品面回归 gate：build、Playwright/desktop smoke、设计文档关键行为对照表。
- 明确协作边界：GPT 负责高风险状态语义、跨层契约、规则矩阵和验收 gate；MiniMax 负责设计还原、页面拼装、低风险 UI 交互和文档支撑。
- 明确 UI 组件约束：能使用现有 shadcn/Radix 组件的场景必须优先使用现有组件或在现有组件上组合；禁止为常见控件重复手写未受控的自定义实现。
- 明确 MiniMax 执行约束：MiniMax 执行任务前必须先识别可复用组件、确认状态来源、说明验证方式；涉及协议、认证、消息状态、群治理、后端契约的判断必须交由 GPT 定义或复核。
- **BREAKING**: 移除或禁用设计中除音频/视频通话外的“仅展示但不可用”伪入口；未实现能力必须明确置灰、隐藏或展示可解释状态。

## Capabilities

### New Capabilities
- `desktop-global-navigation`: 导航抽屉、个人中心、设置、关于、退出登录确认和全局页面流转。
- `desktop-design-system-compliance`: 主题切换、设计变量、布局尺寸、响应式最小窗口和视觉一致性。
- `desktop-conversation-list-surface`: 会话搜索、会话卡片状态、上下文菜单、置顶/静音/删除/复制 ID。
- `desktop-chat-thread-interactions`: 聊天头部菜单、消息上下文菜单、复制/引用/转发/删除/下载、聊天内搜索定位。
- `desktop-input-surface`: emoji、附件、录音入口、引用态、发送按钮状态和输入区内容优先级。
- `desktop-product-regression-gates`: 桌面产品面 build、Playwright、真实冒烟和设计对照验收门槛。

### Modified Capabilities
- `group-governance-and-lifecycle`: 将已完成的群治理规则映射到桌面端群资料、成员列表、成员变更提示和可见状态。
- `conversation-sync-and-reliability`: 将本地消息状态机和同步可靠性要求扩展到桌面产品交互层，例如失败态、重试、删除、转发和摘要回显。
- `notification-delivery-controls`: 将设置页与通知控制能力在桌面端完整暴露，并保证设置值与后端生效值一致。
- `release-regression-governance`: 将桌面产品面设计兑现纳入独立阶段的合并门槛。

## Impact

- Branch: implementation SHALL happen on `feature/desktop-product-surface-closure`.
- Desktop: `apps/desktop/src/App.tsx`, `features/chat/*`, `features/settings/*`, potential `features/profile/*`, `features/about/*`, shared UI components, styles, local state hooks.
- UI components: prefer existing shadcn/Radix-based components under `apps/desktop/src/components/ui/*`; add new primitives only when the existing component set cannot express the required interaction.
- Backend/API: only contract fixes required by desktop surface behavior; no broad backend rewrite is expected.
- Tests: desktop Playwright scenarios, targeted frontend/unit tests if available, smoke checklist for navigation, settings, conversation list, chat thread, input surface and group UI.
- Docs: 2026-04-07 desktop design docs, README surface description, release readiness matrix for this phase.
