## Why

当前好友中心（FriendPanel）使用自定义 CSS 类名，而主聊天页面的会话侧边栏（ConversationSidebar）使用 shadcn/ui 组件库 + Tailwind CSS。两者在视觉风格、组件使用、间距系统上存在明显差异，导致用户在聊天界面和好友中心之间切换时感到界面割裂。

## What Changes

- 好友中心整体迁移到 shadcn/ui + Tailwind CSS 技术栈
- 布局改为两栏结构：左侧联系人列表（280px）+ 右侧详情操作区（flex-1）
- 顶部导航改为 Tab 切换（好友 / 待处理 / 黑名单），移除左侧边栏分类导航
- 搜索框复用 ConversationSidebar 的 `search-shell` 样式
- 联系人卡片复用 `conversation-card` 样式（圆角、间距、hover 效果统一）
- 移除功能：二维码加好友、批量处理、复制加好友码
- 头像、按钮、徽章等全部改用 shadcn/ui 组件

## Capabilities

### New Capabilities

无新功能需求，纯 UI 重构。

### Modified Capabilities

无规格变更，现有好友相关功能逻辑保持不变。

## Impact

- **受影响文件**：`apps/desktop/src/features/friend/friend-panel.tsx`
- **依赖组件**：现有 shadcn/ui 组件（Avatar, Button, Badge, Input, Dialog）
- **设计系统**：复用 ConversationSidebar 的 CSS 变量和 Tailwind 类名规范
