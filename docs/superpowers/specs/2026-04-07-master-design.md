# Security Chat - 桌面端设计系统

**日期**：2026-04-07
**版本**：2.0
**用途**：用于 Figma 高保真交互设计稿
**平台**：桌面端（macOS / Windows / Linux）
**最小窗口**：800 x 600px

---

## 1. 文档体系

### 1.1 文档结构

| 文档 | 说明 | Figma 页面 |
|------|------|------------|
| 总体设计文档（本文档） | 设计系统概览、品牌规范、组件库、交互流程 | - |
| [认证页面设计](./2026-04-07-auth-pages-design.md) | 登录、注册、忘记密码 | Auth Pages |
| [会话列表与聊天界面设计](./2026-04-07-ui-redesign.md) | 侧边栏、会话卡片、FAB 菜单、消息气泡、通话界面 | Conversation List & Chat Interface |

### 1.2 设计原则

1. **Telegram Desktop 设计语言** - 简洁、高效、熟悉的聊天体验
2. **安全至上** - Security Chat 的核心价值
3. **跨平台一致性** - 桌面端三平台统一设计
4. **无障碍支持** - 符合 WAI-ARIA 标准
5. **优先采用 Flex/Grid 现代化布局** - Figma 设计时使用 Auto Layout (Flex) 或 Grid 布局，减少手动定位

---

## 2. 设计规范

### 2.1 页面布局

**桌面端固定布局**：
- **主界面设计尺寸：1200×700px**
- 侧边栏宽度：280px（固定）
- 主聊天区域：自适应（flex-1）
- 页面总宽度：最小 800px
- 页面总高度：最小 600px

```
┌──────────────────────────────────────────────────────────────────┐
│                        1200px (设计宽度)                          │
├─────────────────────────┬────────────────────────────────────────┤
│                         │                                        │
│  侧边栏 (280px)         │  聊天区域 (920px flex-1)              │
│  #f8f9fa / #182533      │  #e8f4f8 / #202530                    │
│                         │                                        │
│  [顶部栏 40px]          │  [聊天头部 64px]                       │
│  [会话列表 flex-1]       │  [消息区域 flex-1]                     │
│                         │                                        │
│                         │  [输入区域 72px]                        │
└─────────────────────────┴────────────────────────────────────────┘
                         700px (设计高度)
```

### 2.2 窗口布局规格

| 属性 | 值 |
|------|-----|
| **主界面设计尺寸** | **1200×700px** |
| 页面最小宽度 | 800px |
| 页面最小高度 | 600px |
| 侧边栏宽度 | 280px（固定） |
| 侧边栏高度 | 100vh |
| 聊天区域最小宽度 | 520px |
| 聊天区域最小高度 | 700px（减去头部和输入区） |
| 聊天头部高度 | 64px |
| 输入区域高度 | 72px |

---

## 3. 品牌设计

### 3.1 品牌标识

**Logo 文字**：SC
**应用名称**：Security Chat
**品牌标语**：安全至上，畅聊无忧

### 3.2 品牌色彩

#### Light Mode

| 用途 | 色值 | CSS 变量 |
|------|------|----------|
| 主色 | #3390ec | `--primary` |
| 主色悬停 | #2b7fd4 | `--primary-hover` |
| 渐变起点 | #4da3f0 | `--brand-start` |
| 渐变终点 | #3390ec | `--brand-end` |
| 成功/在线 | #4caf50 | `--success` |
| 错误/未读 | #e53935 | `--destructive` |
| 阅后即焚 | #ff9800 | `--burn` |

#### Dark Mode

| 用途 | 色值 | CSS 变量 |
|------|------|----------|
| 主色 | #8777d1 | `--primary` |
| 主色悬停 | #9b8cd9 | `--primary-hover` |
| 渐变起点 | #9b8bd9 | `--brand-start` |
| 渐变终点 | #8777d1 | `--brand-end` |
| 成功/在线 | #4caf50 | `--success` |
| 错误/未读 | #e53935 | `--destructive` |
| 阅后即焚 | #ff9800 | `--burn` |

### 3.3 字体

| 用途 | 字体 | 规格 |
|------|------|------|
| 标题 | Inter | 32px, Bold (700) |
| 副标题 | Inter | 28px, Bold (700) |
| 页面标题 | Inter | 18px, SemiBold (600) |
| 名称文字 | Inter | 15px, SemiBold (600) |
| 正文 | Inter | 14px, Regular (400) |
| 辅助文字 | Inter | 13px, Regular (400) |
| 小文字 | Inter | 12px, Regular (400) |
| 标签文字 | Inter | 11px, Medium (500) |

---

## 4. 组件系统

### 4.1 shadcn/ui 组件库

基于 [shadcn/ui](https://ui.shadcn.com) 组件库，使用 Tailwind CSS 进行样式定制。

**核心组件**：

| 组件 | 用途 |
|------|------|
| Button | 按钮，支持多种变体 |
| Input | 输入框 |
| Checkbox | 复选框 |
| Label | 标签 |
| Form | 表单验证 |
| Card | 卡片容器 |
| Avatar | 头像 |
| Badge | 徽章 |
| Dropdown Menu | 下拉菜单 |
| Context Menu | 右键菜单 |
| Tooltip | 提示 |
| Popover | 弹出框 |
| Dialog | 对话框 |
| Sheet | 侧边抽屉 |
| Separator | 分隔线 |
| ScrollArea | 滚动区域 |
| Skeleton | 加载骨架屏 |

### 4.2 图标库

**Material Symbols Rounded**
- 权重：400
- 填充：1（可调）
- 用途：所有 UI 图标

**图标尺寸规范**：

| 用途 | 尺寸 |
|------|------|
| 侧边栏头部按钮 | 24x24px |
| 聊天头部按钮 | 24x24px |
| 输入区域按钮 | 28x28px |
| 消息内图标 | 20x20px |
| 徽章/状态点 | 8-10px |

### 4.3 CSS 变量系统

```css
/* ========================================
   Security Chat - CSS Variables
   基于 shadcn/ui 设计系统
   ======================================== */

/* === Light Mode === */
:root {
  /* shadcn/ui 标准变量 */
  --background: #ffffff;
  --foreground: #1a1a1a;
  --card: #ffffff;
  --card-foreground: #1a1a1a;
  --popover: #ffffff;
  --popover-foreground: #1a1a1a;
  --primary: #3390ec;
  --primary-foreground: #ffffff;
  --secondary: #f8f9fa;
  --secondary-foreground: #1a1a1a;
  --muted: #f8f9fa;
  --muted-foreground: #707579;
  --accent: #f8f9fa;
  --accent-foreground: #1a1a1a;
  --destructive: #e53935;
  --destructive-foreground: #ffffff;
  --border: #dfe1e5;
  --input: #f8f9fa;
  --ring: #3390ec;

  /* 品牌渐变 */
  --brand-start: #4da3f0;
  --brand-end: #3390ec;

  /* 页面背景 */
  --page-background: #e8f4f8;
  --sidebar-background: #f8f9fa;
  --chat-background: #e8f4f8;

  /* 搜索框 */
  --search-bg: #eef0f2;

  /* 消息气泡 */
  --msg-in: #ffffff;
  --msg-out: #e6ffde;
  --msg-reply-bar: #3390ec;
  --msg-reply-bg: #f0f0f0;

  /* 阴影 */
  --shadow: #00000014;
  --shadow-md: #0000001a;
  --shadow-lg: #00000020;

  /* 在线状态 */
  --success: #4caf50;

  /* 阅后即焚 */
  --burn: #ff9800;

  /* 圆角 */
  --radius: 0.875rem;  /* 14px */

  /* 通话 */
  --call-overlay: rgba(0, 0, 0, 0.6);
  --call-card: #ffffff;
}

/* === Dark Mode === */
:root[data-theme="dark"] {
  --background: #202530;
  --foreground: #ffffff;
  --card: #232936;
  --card-foreground: #ffffff;
  --popover: #232936;
  --popover-foreground: #ffffff;
  --primary: #8777d1;
  --primary-foreground: #ffffff;
  --secondary: #2d3a47;
  --secondary-foreground: #ffffff;
  --muted: #2d3a47;
  --muted-foreground: #8b9aa3;
  --accent: #2d3a47;
  --accent-foreground: #ffffff;
  --destructive: #e53935;
  --destructive-foreground: #ffffff;
  --border: #3d4a57;
  --input: #1a242d;
  --ring: #8777d1;

  /* 品牌渐变 */
  --brand-start: #9b8bd9;
  --brand-end: #8777d1;

  /* 页面背景 */
  --page-background: #202530;
  --sidebar-background: #182533;
  --chat-background: #202530;

  /* 搜索框 */
  --search-bg: #2d3a47;

  /* 消息气泡 */
  --msg-in: #2d3a47;
  --msg-out: #8777d1;
  --msg-reply-bar: #8777d1;
  --msg-reply-bg: #2d2d2d;

  /* 阴影 */
  --shadow: #00000033;
  --shadow-md: #0000004d;
  --shadow-lg: #00000050;

  /* 在线状态 */
  --success: #4caf50;

  /* 阅后即焚 */
  --burn: #ff9800;

  /* 通话 */
  --call-overlay: rgba(0, 0, 0, 0.8);
  --call-card: #232936;
}
```

---

## 5. 页面清单

### 5.1 页面列表

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录页 | /login | 用户名+密码登录 |
| 验证码登录 | /login?mode=code | 手机号/邮箱+验证码 |
| 注册页 | /register | 创建账号 |
| 忘记密码 | /forgot-password | 邮箱验证重置密码 |
| 会话列表 | /chat | 侧边栏 + 聊天面板 |

### 5.2 页面流程

```
┌─────────────┐
│   登录页    │
└──────┬──────┘
       │
       ├── [注册] ──→ 注册页
       │
       ├── [忘记密码] ──→ 忘记密码页
       │
       └── [登录成功] ──→ 会话列表
                              │
                              ├── [点击会话] ──→ 聊天界面
                              ├── [FAB + 新建群聊] ──→ 创建群聊
                              └── [FAB + 发起私聊] ──→ 发起私聊
```

---

## 6. 交互流程

### 6.1 侧边栏交互

#### 6.1.1 汉堡菜单交互

**触发方式**：点击侧边栏顶部左侧的汉堡菜单图标（☰）

**交互流程**：

```
┌─────────────────┐
│  ☰  搜索        │  ← 点击 ☰
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ☰  搜索        │     ┌─────────────────┐
│                 │     │  ← 导航抽屉      │
│  [会话卡片1]     │     │                 │
│  [会话卡片2]     │ ←── │  ☀️ 浅色模式    │
│  [会话卡片3]     │     │  🌙 深色模式    │
│                 │     │  💻 自动模式     │
│            [+]  │     │                 │
└─────────────────┘     │  ─────────────  │
                        │                 │
                        │  👤 个人中心    │
                        │  ⚙️ 设置        │
                        │  📱 关于        │
                        │                 │
                        │  🚪 退出登录    │
                        └─────────────────┘
```

**导航抽屉内容**：

| 元素 | 图标 | 说明 |
|------|------|------|
| 浅色模式 | light_mode | 切换到浅色主题 |
| 深色模式 | dark_mode | 切换到深色主题 |
| 自动模式 | contrast | 跟随系统设置 |
| 个人中心 | person | 用户信息（跳转 /profile） |
| 设置 | settings | 应用设置（跳转 /settings） |
| 关于 | info | 关于我们（跳转 /about） |
| 退出登录 | logout | 退出当前账号 |

**导航抽屉页面跳转流程**：

```
[导航抽屉] ──点击菜单项──→ [页面跳转]
                              │
                              ├── [个人中心] ──→ /profile
                              │                  │
                              │                  └── 显示用户信息、头像、ID 等
                              │
                              ├── [设置] ──→ /settings
                              │              │
                              │              ├── 通知设置
                              │              ├── 隐私设置
                              │              ├── 聊天设置
                              │              └── 安全设置
                              │
                              ├── [关于] ──→ /about
                              │              │
                              │              ├── 应用版本
                              │              ├── 版权信息
                              │              └── 许可证
                              │
                              └── [退出登录] ──→ [确认对话框] ──→ /login
                                                    │
                                                    └── [确认] ──→ 清除登录状态
```

**退出登录确认对话框**：

| 元素 | 规格 |
|------|------|
| 标题 | "退出登录" |
| 内容 | "确定要退出当前账号吗？" |
| 取消按钮 | 关闭对话框 |
| 确认按钮 | 执行退出，跳转登录页 |

**页面跳转规格**：

| 路由 | 页面 | 说明 |
|------|------|------|
| /profile | 个人中心 | 用户头像、昵称、ID、二维码 |
| /settings | 设置 | 通知、隐私、聊天、安全设置 |
| /about | 关于 | 版本、版权、许可证 |

**导航抽屉组件**：

```tsx
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent
    side="left"
    className="nav-drawer w-[280px] p-0"
  >
    <SheetHeader className="p-4 border-b">
      <SheetTitle className="text-lg font-semibold">
        Security Chat
      </SheetTitle>
    </SheetHeader>

    {/* 主题切换 */}
    <div className="theme-switcher p-4 border-b">
      <p className="text-xs text-muted-foreground mb-3">主题</p>
      <div className="flex gap-2">
        <Button
          variant={theme === 'light' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme('light')}
        >
          <span className="material-symbols-rounded mr-1">light_mode</span>
          浅色
        </Button>
        <Button
          variant={theme === 'dark' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme('dark')}
        >
          <span className="material-symbols-rounded mr-1">dark_mode</span>
          深色
        </Button>
        <Button
          variant={theme === 'auto' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme('auto')}
        >
          <span className="material-symbols-rounded mr-1">contrast</span>
          自动
        </Button>
      </div>
    </div>

    {/* 菜单项 */}
    <nav className="p-2">
      <button className="nav-item w-full justify-start">
        <Person className="h-5 w-5 mr-3" />
        <span>个人中心</span>
      </button>
      <button className="nav-item w-full justify-start">
        <Settings className="h-5 w-5 mr-3" />
        <span>设置</span>
      </button>
      <button className="nav-item w-full justify-start">
        <Info className="h-5 w-5 mr-3" />
        <span>关于</span>
      </button>
    </nav>

    {/* 退出登录 */}
    <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
      <Button
        variant="ghost"
        className="w-full justify-start text-destructive"
      >
        <Logout className="h-5 w-5 mr-3" />
        <span>退出登录</span>
      </Button>
    </div>
  </SheetContent>
</Sheet>
```

**导航抽屉规格**：

| 元素 | 规格 |
|------|------|
| 宽度 | 280px |
| 背景 | --card |
| 阴影 | --shadow-lg |
| 内边距 | 0 |
| 主题切换区 | 独立区域，p-4，底部边框 |
| 菜单项高度 | 44px |
| 菜单项圆角 | 8px |
| 菜单项内边距 | 0 12px |
| 退出登录按钮 | 底部固定，p-4，顶部边框 |

**关闭方式**：
- 点击抽屉外部区域
- 点击关闭按钮（X）
- 按 ESC 键
- 点击菜单项后自动关闭

#### 6.1.2 搜索框交互

**触发方式**：点击搜索框

**交互流程**：

```
┌─────────────────────────────────┐
│  🔍 搜索                        │  ← 初始状态
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  🔍 输入搜索内容...              │  ← 聚焦状态
│                               │     （无边框聚焦效果）
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  🔍 输入搜索内容...           ✕ │  ← 有内容时显示清除按钮
└─────────────────────────────────┘
```

**搜索框规格**：

| 属性 | 规格 |
|------|------|
| 圆角 | 16px |
| 背景 | --search-bg |
| 高度 | 32px |
| 图标尺寸 | 18px |
| 图标颜色 | --muted-foreground |
| 占位文字 | "搜索"，--muted-foreground |
| 聚焦效果 | 无边框高亮，保持背景色不变 |

**搜索行为**：
- 实时过滤会话列表
- 匹配会话名称、消息预览
- 空关键词显示全部会话

**清除按钮交互**：

```
[有内容时] ──点击清除按钮──→ [清空输入框] ──→ [重新显示全部会话]
```

| 状态 | 显示 |
|------|------|
| 无内容 | 不显示清除按钮 |
| 有内容 | 显示清除按钮（X 图标） |
| 点击清除 | 清空输入框，隐藏清除按钮，输入框失焦 |

### 6.2 会话卡片交互

#### 6.2.1 点击选择

**触发方式**：单击会话卡片

**交互流程**：

```
[会话卡片] ──点击──→ [选中状态] ──→ [加载聊天记录] ──→ [显示聊天界面]
```

**选中状态样式**：

| 元素 | Default | Active |
|------|---------|--------|
| 背景 | --card | --primary |
| 文字颜色 | --foreground | --primary-foreground |
| 未读徽章 | --destructive 背景 | --primary-foreground 背景，--primary 文字 |

#### 6.2.2 右键上下文菜单

**触发方式**：右键单击（或长按 300ms）会话卡片

**交互流程**：

```
[会话卡片] ──右键──→ [上下文菜单] ──点击菜单项──→ [执行操作]
                              │
                              ├── [置顶会话] ──→ 切换置顶状态
                              ├── [静音会话] ──→ 切换静音状态
                              ├── [删除会话] ──→ 显示确认对话框
                              └── [复制ID] ──→ 复制到剪贴板
```

**上下文菜单规格**：

| 元素 | 规格 |
|------|------|
| 触发方式 | 右键点击 / 长按 300ms |
| 背景 | --popover |
| 圆角 | 8px |
| 阴影 | blur:8px, offset:0,2px, --shadow-md |
| 菜单元项高度 | 36px |
| 菜单元项内边距 | 0 12px |
| 菜单图标尺寸 | 18px |
| 菜单文字 | Inter 14px, --foreground |

**菜单项**：

| 菜单项 | 图标 | 说明 |
|--------|------|------|
| 置顶会话 | push_pin | 切换置顶状态 |
| 静音会话 | volume_off | 切换静音状态 |
| 删除会话 | delete | 删除会话（需确认） |
| 复制ID | content_copy | 复制会话ID到剪贴板 |

**上下文菜单关闭方式**：

| 关闭方式 | 行为 |
|----------|------|
| 点击菜单外部区域 | 关闭菜单 |
| 按 ESC 键 | 关闭菜单 |
| 选择菜单项 | 执行操作后关闭菜单 |

**删除会话确认对话框**：

```
[右键菜单] ──点击"删除会话"──→ [确认对话框]
                                       │
                                       ├── [取消] ──→ 关闭对话框
                                       │
                                       └── [确认删除] ──→ 删除会话并返回会话列表
```

| 元素 | 规格 |
|------|------|
| 标题 | "删除会话" |
| 内容 | "确定要删除该会话吗？删除后无法恢复。" |
| 取消按钮 | 关闭对话框 |
| 确认按钮 | 删除会话，跳转回会话列表 |

### 6.3 FAB 菜单交互

**触发方式**：点击 FAB 按钮

**交互流程**：

```
[FAB +] ──点击──→ [展开菜单] ──点击菜单项──→ [执行操作] ──→ [关闭菜单]
              │
              │ ──点击外部──→ [关闭菜单]
              │
              │ ──ESC 键──→ [关闭菜单]
```

**展开菜单规格**：

| 元素 | 规格 |
|------|------|
| 触发方式 | 点击 FAB 按钮 |
| 菜单位置 | FAB 上方，水平居中 |
| 宽度 | 200px |
| 圆角 | 12px |
| 背景 | --card |
| 阴影 | blur:12px, offset:0,4px, --shadow-md |
| 内边距 | 8px |
| 菜单元项高度 | 44px |
| 菜单元项圆角 | 8px |
| 菜单元项内边距 | 0 12px |

**菜单项**：

| 菜单项 | 图标 | 说明 |
|--------|------|------|
| 新建群聊 | group_add | 打开好友选择面板，创建群聊 |
| 发起私聊 | person_add | 清空输入框，开始新对话 |

**新建群聊流程**：

```
[FAB +] ──点击"新建群聊"──→ [好友选择面板]
                                       │
                                       ▼
                                [显示好友列表，可多选]
                                       │
                                       ▼
                                [已选好友显示在面板顶部]
                                       │
                                       ▼
                                [点击"创建群聊"按钮]
                                       │
                                       ▼
                                [创建群聊成功] ──→ [跳转到新群聊会话]
```

**好友选择面板组件**：

```tsx
<Dialog open={isCreatingGroup}>
  <DialogContent className="create-group-dialog max-w-md">
    <DialogHeader>
      <DialogTitle>新建群聊</DialogTitle>
    </DialogHeader>

    {/* 已选好友标签 */}
    <div className="flex flex-wrap gap-2 min-h-[32px]">
      {selectedFriends.map((friend) => (
        <Badge key={friend.id} variant="secondary">
          {friend.name}
          <button
            className="ml-1"
            onClick={() => removeFriend(friend.id)}
          >
            ×
          </button>
        </Badge>
      ))}
    </div>

    {/* 搜索框 */}
    <Input
      placeholder="搜索好友"
      value={searchKeyword}
      onChange={(e) => setSearchKeyword(e.target.value)}
    />

    {/* 好友列表 */}
    <ScrollArea className="h-[250px]">
      <div className="space-y-1">
        {filteredFriends.map((friend) => (
          <button
            key={friend.id}
            className={cn(
              "friend-item w-full flex items-center gap-3 p-2 rounded-lg",
              "hover:bg-accent",
              selectedIds.includes(friend.id) && "bg-accent"
            )}
            onClick={() => toggleSelection(friend.id)}
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getInitials(friend.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="font-medium">{friend.name}</p>
            </div>
            <Checkbox checked={selectedIds.includes(friend.id)} />
          </button>
        ))}
      </div>
    </ScrollArea>

    <DialogFooter>
      <Button variant="outline" onClick={() => setIsCreatingGroup(false)}>
        取消
      </Button>
      <Button
        disabled={selectedIds.length === 0}
        onClick={() => handleCreateGroup()}
      >
        创建群聊 ({selectedIds.length})
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**好友选择面板规格**：

| 元素 | 规格 |
|------|------|
| 对话框宽度 | 最大 448px |
| 已选好友标签 | Badge 组件，显示已选人数 |
| 搜索框高度 | 40px |
| 好友列表高度 | 最大 250px |
| 好友项高度 | 56px |
| 头像尺寸 | 40×40px |
| 创建按钮 | 显示选中数量，禁用时为 0 |

### 6.4 聊天头部交互

#### 6.4.1 搜索按钮

**触发方式**：点击搜索图标

**交互行为**：打开聊天内搜索功能（暂不实现，可扩展）

#### 6.4.2 语音通话按钮

**触发方式**：点击电话图标

**交互流程**：

```
[语音通话按钮] ──点击──→ [呼出界面] ──对方接听──→ [通话中界面]
                                │
                                │ ──对方未接──→ [通话结束]
                                │ ──对方拒接──→ [通话结束]
                                │ ──取消呼叫──→ [关闭]
```

#### 6.4.3 视频通话按钮

**触发方式**：点击视频图标

**交互流程**：

```
[视频通话按钮] ──点击──→ [呼出界面] ──对方接听──→ [视频通话中界面]
                                  │
                                  │ ──对方未接──→ [通话结束]
                                  │ ──对方拒接──→ [通话结束]
                                  │ ──取消呼叫──→ [关闭]
```

#### 6.4.4 更多菜单

**触发方式**：点击更多图标（⋮）

**交互流程**：

```
[更多按钮] ──点击──→ [下拉菜单] ──点击菜单项──→ [执行操作]
                           │
                           ├── [阅后即焚] ──→ 切换阅后即焚模式
                           ├── [删除该会话] ──→ 删除会话（需确认）
                           ├── [置顶聊天] ──→ 切换置顶状态
                           └── [静音] ──→ 切换静音状态
```

### 6.5 消息气泡交互

#### 6.5.1 右键上下文菜单

**触发方式**：右键点击消息气泡

**交互流程**：

```
[消息气泡] ──右键──→ [上下文菜单] ──点击菜单项──→ [执行操作]
                               │
                               ├── [复制] ──→ 复制消息内容
                               ├── [引用] ──→ 激活输入框引用模式
                               ├── [转发] ──→ 打开转发选择器
                               └── [删除] ──→ 删除消息（仅自己发送）
```

**菜单位置规则**：

| 消息方向 | 水平位置 |
|----------|----------|
| 发送的消息 | 菜单在气泡**右侧** |
| 收到的消息 | 菜单在气泡**左侧** |

| 消息位置 | 垂直位置 |
|----------|----------|
| 屏幕上半部分 | 菜单在气泡**下方** |
| 屏幕下半部分 | 菜单在气泡**上方** |

**菜单项（按消息类型）**：

| 消息类型 | 菜单项 |
|----------|--------|
| 文本消息 | 复制、引用、转发、删除 |
| 图片消息 | 复制、引用、转发、下载、删除 |
| 文件消息 | 复制、引用、转发、下载、删除 |
| 语音消息 | 复制、引用、转发、删除 |

**上下文菜单关闭方式**：

| 关闭方式 | 行为 |
|----------|------|
| 点击菜单外部区域 | 关闭菜单 |
| 按 ESC 键 | 关闭菜单 |
| 选择菜单项 | 执行操作后关闭菜单 |

### 6.6 输入区域交互

#### 6.6.1 文本输入

**触发方式**：点击输入框

**交互状态**：

```
[输入框] ──点击──→ [聚焦状态] ──输入内容──→ [发送按钮可点击]
                              │
                              │ ──发送内容──→ [清空输入框] ──→ [显示消息]
```

**发送按钮状态**：

| 输入框内容 | 发送按钮状态 | 按钮图标 |
|------------|--------------|----------|
| 无内容 | 禁用，灰色 | ➤ |
| 有文本内容 | 可点击，高亮 | ➤ |
| 有图片/文件预览 | 可点击，高亮 | ➤ |
| 有引用内容 | 可点击，高亮 | ➤ |

**输入框状态下的内容优先级**：

| 状态 | 显示内容 |
|------|----------|
| 无任何内容 | 显示占位文字 "输入消息..." |
| 有文本 | 显示文本内容 |
| 有图片预览 | 显示图片缩略图 + 文本（如有） |
| 有文件预览 | 显示文件信息 + 文本（如有） |

#### 6.6.2 表情选择器

**触发方式**：点击表情图标

**交互流程**：

```
[表情按钮] ──点击──→ [表情面板 Popover]
                        │
                        ├── [选择表情] ──→ [插入输入框] ──→ [关闭面板]
                        ├── [点击分类标签] ──→ [切换分类]
                        ├── [搜索表情] ──→ [显示搜索结果]
                        └── [点击外部 / ESC] ──→ [关闭面板]
```

**表情面板分类**：

| 分类 | 图标 | 说明 |
|------|------|------|
| 最近 | schedule | 常用表情 |
| 表情 | sentiment_satisfied | 笑脸表情 |
| 动物 | pets | 动物和虫子 |
| 食物 | restaurant | 食物和饮料 |
| 活动 | sports_soccer | 活动和运动 |
| 旅行 | place | 旅行和地点 |
| 物品 | lightbulb | 物品和物体 |
| 符号 | emoji_symbols | 符号和旗帜 |

#### 6.6.3 附件

**触发方式**：点击附件图标

**交互行为**：打开系统文件选择器，选择文件后发送文件消息

#### 6.6.4 麦克风

**触发方式**：按下麦克风按钮开始录音，松开结束录音并发送

**交互状态**：

| 状态 | 样式 |
|------|------|
| 默认 | 麦克风图标 |
| 录音中 | 麦克风图标变红，显示录音时长 |
| 发送中 | 显示发送动画 |

### 6.7 通话界面交互

#### 6.7.1 来电呼入

**触发方式**：收到对方通话邀请

**交互流程**：

```
[收到通话邀请]
       │
       ├── [接听] ──→ [通话中界面]
       │
       └── [拒绝] ──→ [关闭对话框]
```

#### 6.7.2 呼出中

**触发方式**：发起通话后等待对方接听

**交互流程**：

```
[正在呼叫...]
       │
       ├── [对方接听] ──→ [通话中界面]
       │
       ├── [对方未接] ──→ [通话结束界面]
       │
       ├── [对方拒接] ──→ [通话结束界面]
       │
       └── [取消] ──→ [关闭对话框]
```

#### 6.7.3 通话中

**控制按钮**：

| 按钮 | 功能 |
|------|------|
| 静音 | 切换麦克风状态 |
| 挂断 | 结束通话 |
| 更多 | 显示更多选项（如视频通话切换） |

**语音通话 → 视频通话**：点击更多 → 选择"开启视频"

#### 6.7.4 视频通话 PiP 小窗口

**拖拽交互**：

```
[PiP 窗口] ──拖拽──→ [新位置] ──释放──→ [固定新位置]
```

**PiP 窗口控制**：

| 元素 | 功能 |
|------|------|
| 点击小窗口 | 全屏显示视频 |
| X 按钮 | 关闭小窗口（仅关闭小窗口，不挂断） |

### 6.8 主题切换交互

**触发方式**：在导航抽屉中点击主题选项

**交互流程**：

```
[导航抽屉] ──点击主题──→ [应用主题] ──[保存到 localStorage]
                    │
                    ├── [☀️ 浅色] ──→ 立即切换到浅色
                    ├── [🌙 深色] ──→ 立即切换到深色
                    └── [💻 自动] ──→ 跟随系统 prefers-color-scheme
```

**过渡动画**：

```css
:root {
  transition: background-color 200ms ease, color 200ms ease;
}

* {
  transition: background-color 200ms ease, border-color 200ms ease;
}
```

**持久化**：

- 使用 `localStorage.setItem('theme', theme)` 保存
- 页面加载时读取并应用

---

## 7. 设计文件

### 7.1 .pen 设计文件

**路径**：`/Users/jerry/Desktop/security-chat.pen`

| 节点 ID | 页面 | 说明 |
|---------|------|------|
| QU5PV | Light - Login | 登录页 Light Mode |
| LnBJf | Dark - Login | 登录页 Dark Mode |
| Keaay | Light - Register | 注册页 Light Mode |
| dkDjk | Dark - Register | 注册页 Dark Mode |
| OsJbt | Light Mode | 聊天页面 Light Mode |
| E65nJ | Dark Mode | 聊天页面 Dark Mode |
| dmVZ1 | Group Chat | 群聊页面 |

### 7.2 设计文档

| 文档路径 | 说明 |
|----------|------|
| `docs/superpowers/specs/2026-04-07-auth-pages-design.md` | 认证页面设计 |
| `docs/superpowers/specs/2026-04-07-ui-redesign.md` | 会话列表与聊天界面设计 |

---

## 8. 技术实现

### 8.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 前端框架 |
| Tailwind CSS | 样式 |
| shadcn/ui + Radix UI | 组件库 |
| react-hook-form + zod | 表单验证 |
| Lucide React / Material Symbols | 图标 |
| Inter Font | 字体 |

### 8.2 组件安装

```bash
# 安装 shadcn/ui 核心组件
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add label
npx shadcn-ui@latest add form
npx shadcn-ui@latest add card
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add context-menu
npx shadcn-ui@latest add tooltip
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add skeleton

# 安装表单验证
npm install react-hook-form @hookform/resolvers zod

# 安装图标
npm install lucide-react
```

### 8.3 cn 工具函数

```tsx
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 9. 设计标注规范

### 9.1 Figma 标注要求

每个设计组件必须标注：

1. **尺寸** - 宽度、高度、圆角（px）
2. **颜色** - 精确 HEX 色值
3. **字体** - Font Family、Size、Weight
4. **间距** - Margin、Padding、Gap（px）
5. **状态** - Default、Hover、Focus、Active、Disabled、Error
6. **组件** - shadcn/ui 组件名称
7. **交互** - 触发方式、动画时长

### 9.2 组件命名

```
组件/变体/状态
例如：
- Button/default/Default
- Button/default/Hover
- Button/default/Loading
- Input/default/Focus
- Input/default/Error
- NavDrawer/default/Default
- NavDrawer/item/Default
- NavDrawer/item/Hover
- ContextMenu/default/Default
- ContextMenu/item/Default
```

### 9.3 图层组织

```
Page: Security Chat Design System
├── 00_Brand (品牌规范)
│   ├── Colors
│   ├── Typography
│   └── Icons
│
├── 01_Auth_Pages (认证页面)
│   ├── Login
│   ├── Register
│   └── Forgot_Password
│
├── 02_Conversation_List (会话列表)
│   ├── Sidebar
│   │   ├── Toolbar
│   │   │   ├── Hamburger_Menu
│   │   │   └── Search_Box
│   │   └── Conversation_List
│   │       ├── Card_Default
│   │       ├── Card_Hover
│   │       ├── Card_Active
│   │       └── Card_Unread
│   ├── FAB_Button
│   ├── FAB_Menu
│   ├── Nav_Drawer
│   │   ├── Theme_Switcher
│   │   └── Menu_Items
│   └── Context_Menu
│
├── 03_Chat_Interface (聊天界面)
│   ├── Chat_Header
│   │   ├── Avatar
│   │   ├── User_Info
│   │   ├── Search_Button
│   │   ├── Call_Button
│   │   ├── Video_Call_Button
│   │   └── More_Menu
│   ├── Message_List
│   │   ├── Message_In
│   │   ├── Message_Out
│   │   ├── Reply_Reference
│   │   ├── Message_Status
│   │   └── Context_Menu
│   ├── Input_Area
│   │   ├── Input_Box
│   │   ├── Attach_Button
│   │   ├── Emoji_Picker
│   │   └── Mic_Button
│   └── Call_Interface
│       ├── Call_Incoming
│       ├── Call_Calling
│       ├── Call_Active
│       ├── Call_Ended
│       └── Call_Missed
│
└── 04_Components (通用组件)
    ├── Avatar
    ├── Badge
    ├── Button
    ├── Input
    └── Card
```

---

## 10. 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0 | 2026-04-07 | 初始版本，建立设计系统 |
| 2.0 | 2026-04-07 | 更新文档结构，添加完整交互流程设计 |
| 2.1 | 2026-04-07 | 补充导航抽屉页面跳转流程、退出登录确认、搜索清除交互 |
| 2.2 | 2026-04-07 | 补充上下文菜单关闭行为、新建群聊完整流程、删除会话确认、发送按钮状态、表情面板分类切换 |

---

## 11. 参考资料

- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Material Symbols](https://fonts.google.com/icons)
- [Telegram Desktop Design](https://desktop.telegram.org)
- [2026-04-07-auth-pages-design.md](./2026-04-07-auth-pages-design.md)
- [2026-04-07-ui-redesign.md](./2026-04-07-ui-redesign.md)
