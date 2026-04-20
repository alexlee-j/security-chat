## 1. 布局结构重构

- [x] 1.1 将三栏布局（侧边栏导航 + 列表 + 详情）改为两栏（侧边列表 + 详情区）
- [x] 1.2 设置左侧列表宽度为 280px（w-[280px] min-w-[280px]）
- [x] 1.3 右侧详情区设置为 flex-1，自适应宽度

## 2. 顶部 Tab 导航

- [x] 2.1 实现 Tab 切换组件（好友 / 待处理 / 黑名单）
- [x] 2.2 Tab 样式与 ConversationSidebar 区域分隔风格一致
- [x] 2.3 Tab 切换时过滤对应的联系人列表

## 3. 搜索框迁移

- [x] 3.1 将自定义 `.friend-search` 替换为 `search-shell` 样式（与 ConversationSidebar 一致）
- [x] 3.2 搜索框内集成 lucide-react 的 search 图标

## 4. 联系人列表项迁移

- [x] 4.1 将 `<span className="avatar">` 替换为 shadcn/ui 的 `<Avatar>` 组件
- [x] 4.2 联系人卡片样式复用 `conversation-card` 类名（flex items-center gap-3 p-3 h-[72px] rounded-xl）
- [x] 4.3 在线状态点使用相同样式（absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full）
- [x] 4.4 待处理请求使用 `<Badge>` 组件显示「新」标签

## 5. 详情区迁移

- [x] 5.1 大头像使用 `<Avatar className="h-14 w-14">`
- [x] 5.2 操作按钮使用 `<Button>` 组件（variant: default / ghost / outline）
- [x] 5.3 关系总览使用 `conversation-card` 样式卡片展示统计数字

## 6. 移除废弃功能

- [x] 6.1 删除二维码加好友区块（.friend-qr 相关代码）
- [x] 6.2 删除复制加好友码功能
- [x] 6.3 删除批量处理请求按钮

## 7. 清理与验证

- [x] 7.1 CSS 类不再被 friend-panel.tsx 引用，styles.css 中的定义可保留（无其他组件使用）
- [x] 7.2 TypeScript 编译通过，Vite 开发服务器运行正常
- [x] 7.3 功能逻辑完整保留（搜索、添加、拉黑、发消息等 Props 接口不变）
