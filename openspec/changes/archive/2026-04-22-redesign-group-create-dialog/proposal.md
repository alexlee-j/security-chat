## Why

当前“新建群聊”弹窗在切换到 shadcn Dialog 后仍出现结构性问题（嵌套 form、缺少 DialogTitle、布局裁切与遮挡），导致控制台持续告警且 UI 在真实窗口尺寸下可用性不足。该入口属于 FAB 的核心高频动作，必须保证稳定、可访问、可读，并且与现有桌面设计系统一致。

## What Changes

- 重新定义群聊新建/管理弹窗的结构约束，禁止无效 DOM 嵌套并补齐 shadcn/Radix 的可访问性要求。
- 明确群聊弹窗在常见桌面窗口尺寸下的布局行为，避免内容裁切、遮挡、滚动区域不可达等问题。
- 统一群聊弹窗与桌面端现有 shadcn 组件行为（header/body/footer、关闭行为、焦点管理）。
- 强化 FAB 触发“新建群聊”后的前端交互闭环（打开、提交、关闭、回到聊天上下文）。

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `desktop-conversation-list-surface`: FAB 新建群聊入口需要保证弹窗交互闭环与当前页内完成，不产生异常跳转或不可操作状态。
- `group-governance-and-lifecycle`: 桌面端群组创建/管理表面需要满足一致的可用性和可访问性要求，确保创建与管理动作在 UI 上可靠可达。
- `desktop-design-system-compliance`: 群聊弹窗必须遵循共享 shadcn/Radix primitive 的结构和可访问性约束。

## Impact

- Desktop 前端：`GroupCreateModal`、`App` 中弹窗挂载状态与触发链路、FAB 到群聊创建的交互路径。
- UI/UX：弹窗布局系统、滚动容器、表单区块划分、对话框可访问性语义。
- QA/验证：需要补充针对控制台无 DOM nesting/a11y 警告、以及中小窗口可操作性的回归检查。
