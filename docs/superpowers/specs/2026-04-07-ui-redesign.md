# Security Chat - 会话列表与聊天界面设计方案

**日期**：2026-04-07
**版本**：1.1
**用途**：用于 Figma 高保真交互设计稿
**UI 组件库**：shadcn/ui + Tailwind CSS
**设计参考**：Telegram Desktop + Security Chat 品牌风格

---

## 1. 技术栈与组件规范

### 1.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 框架 |
| Tailwind CSS | 样式 |
| shadcn/ui | 组件库 |
| Radix UI | 无障碍底层 |
| react-hook-form + zod | 表单验证（用于搜索、创建群聊等） |
| Lucide React / Material Symbols Rounded | 图标 |

### 1.2 shadcn/ui 组件清单

| 组件 | 用途 | 变体 |
|------|------|------|
| `Button` | 按钮 | default, outline, ghost, link |
| `Input` | 文本输入框 | default |
| `Avatar` | 头像 | - |
| `Badge` | 徽章（未读数） | - |
| `Dropdown Menu` | 下拉菜单 | - |
| `Context Menu` | 右键菜单 | - |
| `Popover` | 弹出框 | - |
| `Tooltip` | 提示 | - |
| `ScrollArea` | 滚动区域 | - |
| `Sheet` | 侧边抽屉 | - |
| `Separator` | 分隔线 | - |
| `Skeleton` | 加载骨架屏 | - |
| `Dialog` | 对话框 | - |

### 1.3 组件设计原则

1. **使用 shadcn/ui 变体** - 通过 `cn()` 工具函数合并品牌色
2. **Radix UI 原语** - 保证无障碍支持（WAI-ARIA）
3. **Tailwind CSS** - 使用 `tailwind-merge` 和 `clsx` 合并类名
4. **CSS 变量** - 通过 CSS 变量注入主题色，便于 Dark Mode 切换
5. **Material Symbols Rounded** - 权重 400，用于所有 UI 图标

---

## 2. 页面布局

### 2.1 整体结构

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

### 2.2 布局规格

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

### 2.3 垂直方向自适应

| 区域 | 高度 |
|------|------|
| 聊天头部 | 固定 64px |
| 消息区域 | 自适应 (flex-1) |
| 底部输入区 | 固定 72px |

---

## 3. CSS 变量系统

### 3.1 设计系统颜色变量

基于 shadcn/ui WAI-ARIA 标准 CSS 变量命名，扩展 Security Chat 品牌色：

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

  /* 品牌渐变（Tailwind Extended） */
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
  --radius: 0.875rem;  /* 14px - 组件默认圆角 */

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

### 3.2 Tailwind 配置

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          start: "var(--brand-start)",
          end: "var(--brand-end)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        burn: "var(--burn)",
        success: "var(--success)",
        "msg-in": "var(--msg-in)",
        "msg-out": "var(--msg-out)",
        "msg-reply-bar": "var(--msg-reply-bar)",
        "msg-reply-bg": "var(--msg-reply-bg)",
        "search-bg": "var(--search-bg)",
        "call-overlay": "var(--call-overlay)",
        "call-card": "var(--call-card)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        lg: "0 10px 15px -3px var(--shadow-lg), 0 4px 6px -4px var(--shadow-lg)",
      },
    },
  },
}
```

---

## 4. 侧边栏设计

### 4.1 侧边栏结构

```
┌─────────────────────────┐
│ ☰  🔍 搜索              │  ← 顶部：菜单图标 + 搜索框
├─────────────────────────┤
│                         │
│  [会话卡片1]             │
│  [会话卡片2]             │
│  [会话卡片3]             │
│  [会话卡片4]             │
│  [会话卡片5]             │
│                         │
│                    [+]  │  ← 右下角 FAB 按钮
└─────────────────────────┘
```

### 4.2 侧边栏组件规格

| 元素 | 规格 |
|------|------|
| 宽度 | 280px |
| 背景 | --sidebar-background |
| 顶部区域高度 | 40px |
| 顶部区域内边距 | 12px |
| 会话列表区域 | 剩余高度自适应 |

### 4.3 顶部栏组件

**菜单按钮**：
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-9 w-9"
>
  <span className="material-symbols-rounded">menu</span>
</Button>
```

| 属性 | 规格 |
|------|------|
| 尺寸 | 24×24px |
| 图标 | Material Symbols Rounded, `menu` |
| 颜色 | --muted-foreground |

**搜索框**：
```tsx
<div className="search-shell">
  <span className="search-icon material-symbols-rounded">search</span>
  <Input
    className="search-input"
    placeholder="搜索"
  />
</div>
```

| 属性 | 规格 |
|------|------|
| 圆角 | 16px |
| 背景 | --search-bg |
| 高度 | 32px |
| 图标 | 搜索图标（--muted-foreground, 18px） |

---

## 5. 会话卡片设计

### 5.1 会话卡片组件

```tsx
// 会话卡片组件
<Button
  variant="ghost"
  className={cn(
    "conversation-card h-[72px] w-full p-3 rounded-xl",
    "justify-start items-center gap-3",
    isActive && "bg-primary text-primary-foreground"
  )}
>
  {/* 头像 */}
  <Avatar className="h-10 w-10">
    <AvatarFallback
      className={cn(
        "text-sm font-medium",
        isActive ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"
      )}
    >
      {getInitials(name)}
    </AvatarFallback>
    {isOnline && !isActive && <AvatarIndicator className="status-dot" />}
  </Avatar>

  {/* 中间：名称 + 消息预览 */}
  <div className="flex-1 min-w-0 text-left">
    <div className="flex items-center justify-between">
      <span className={cn(
        "font-semibold text-sm truncate",
        isActive ? "text-primary-foreground" : "text-foreground"
      )}>
        {name}
      </span>
      <span className={cn(
        "text-xs",
        isActive ? "text-primary-foreground/70" : "text-muted-foreground"
      )}>
        {time}
      </span>
    </div>
    <p className={cn(
      "text-xs truncate",
      isActive ? "text-primary-foreground/70" : "text-muted-foreground"
    )}>
      {preview}
    </p>
  </div>

  {/* 右侧：在线状态 + 未读数 */}
  <div className="flex flex-col items-end gap-1">
    {isOnline && isActive && <span className="status-dot" />}
    {unread > 0 && (
      <Badge
        variant="destructive"
        className={cn(
          "h-5 min-w-5 px-1.5 rounded-full text-xs font-medium",
          isActive && "bg-primary-foreground text-primary"
        )}
      >
        {unread > 99 ? '99+' : unread}
      </Badge>
    )}
  </div>
</Button>
```

### 5.2 卡片尺寸规格

| 元素 | 规格 |
|------|------|
| 卡片高度 | 72px |
| 卡片圆角 | 12px |
| 卡片内边距 | 12px |
| 头像尺寸 | 40×40px |
| 头像形状 | 圆形 |
| 头像背景 | --primary |
| 头像文字 | --primary-foreground（白色） |

### 5.3 卡片状态

| 状态 | 背景 | 文字颜色 |
|------|------|----------|
| Default | --card | --card-foreground |
| Hover | --accent | --accent-foreground |
| Active（选中） | --primary | --primary-foreground |
| Disabled | --muted | --muted-foreground |

### 5.4 头像规格

| 状态 | 背景色 | 文字色 |
|------|--------|--------|
| Default/Hover | --primary (#3390ec / #8777d1) | 白色 |
| Active（选中） | --primary-foreground (白色) | --primary |
| 在线指示器 | --success (#4caf50) | - |

**头像尺寸**：40×40px，圆形，显示名字首字母缩写

### 5.5 在线状态点

| 属性 | 规格 |
|------|------|
| 尺寸 | 10×10px |
| 形状 | 圆形 |
| 颜色 | --success (#4caf50) |
| 位置 | 头像右下角 |
| 显示逻辑 | 仅在 Default/Hover 状态且在线时显示 |

### 5.6 未读消息数徽章

```tsx
<Badge
  variant="destructive"
  className={cn(
    "h-5 min-w-5 px-1.5 rounded-full text-xs font-medium",
    isActive && "bg-primary-foreground text-primary"
  )}
>
  {unread > 99 ? '99+' : unread}
</Badge>
```

| 属性 | 规格 |
|------|------|
| Default/Hover | 背景 --destructive (#e53935)，文字白色 |
| Active | 背景 --primary-foreground (白色)，文字 --primary |
| 圆角 | 12px（胶囊形） |
| 省略 | 超过 99 显示 99+ |

### 5.7 会话卡片 Light/Dark Mode

| CSS 变量 | Light Mode | Dark Mode |
|----------|-----------|-----------|
| --card | #ffffff | #232936 |
| --card-foreground | #1a1a1a | #ffffff |
| --primary（选中/头像） | #3390ec | #8777d1 |
| --primary-foreground | #ffffff | #ffffff |
| --muted-foreground | #707579 | #8b9aa3 |
| --success（状态点） | #4caf50 | #4caf50 |
| --destructive（徽章） | #e53935 | #e53935 |

---

## 6. FAB 按钮与菜单

### 6.1 FAB 按钮组件

```tsx
<Button
  className={cn(
    "fab-button h-14 w-14 rounded-full",
    "bg-primary text-primary-foreground",
    "shadow-lg shadow-primary/25",
    "hover:opacity-90 active:scale-95",
    "fixed bottom-4 right-4"
  )}
  aria-label="打开操作菜单"
>
  <span className="text-2xl font-light">+</span>
</Button>
```

| 属性 | 规格 |
|------|------|
| 尺寸 | 56×56px |
| 形状 | 圆形（圆角 28px） |
| 背景 | --primary |
| 图标 | + 号，白色，28px |
| 阴影 | blur:8px, offset:0,4px, shadow-lg |
| 位置 | 右下角，距底部 16px, 距右侧 16px |

### 6.2 展开菜单组件

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button className="fab-button ...">...</Button>
  </PopoverTrigger>
  <PopoverContent
    className="fab-menu w-48 p-1"
    align="end"
    side="top"
  >
    <button className="fab-menu-item">
      <span className="fab-menu-icon material-symbols-rounded">group_add</span>
      <span>新建群聊</span>
    </button>
    <button className="fab-menu-item">
      <span className="fab-menu-icon material-symbols-rounded">person_add</span>
      <span>发起私聊</span>
    </button>
  </PopoverContent>
</Popover>
```

| 元素 | 规格 |
|------|------|
| 宽度 | 200px |
| 圆角 | 12px |
| 背景 | --card |
| 阴影 | blur:12px, offset:0,4px, --shadow-md |
| 内边距 | 8px |
| 菜单元项高度 | 44px |
| 菜单元项圆角 | 8px |
| 菜单元项内边距 | 0 12px |

**菜单项 1：新建群聊**

| 元素 | 规格 |
|------|------|
| 图标 | Material Symbols Rounded, `group_add` |
| 图标颜色 | --primary |
| 图标尺寸 | 20px |
| 文字 | Inter 14px, --foreground |

**菜单项 2：发起私聊**

| 元素 | 规格 |
|------|------|
| 图标 | Material Symbols Rounded, `person_add` |
| 图标颜色 | --muted-foreground |
| 图标尺寸 | 20px |
| 文字 | Inter 14px, --foreground |

### 6.3 FAB Light/Dark Mode

| CSS 变量 | Light Mode | Dark Mode |
|----------|-----------|-----------|
| --primary | #3390ec | #8777d1 |
| --card | #ffffff | #232936 |
| --primary-foreground | #ffffff | #ffffff |
| shadow-primary/25 | rgba(51,144,236,0.25) | rgba(135,119,209,0.25) |

---

## 7. 上下文菜单（右键菜单）

### 7.1 上下文菜单组件

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    {/* 会话卡片 */}
  </ContextMenuTrigger>
  <ContextMenuContent className="context-menu w-48 p-1">
    <ContextMenuItem className="context-menu-item">
      <PushPin className="context-menu-icon" />
      <span>置顶会话</span>
    </ContextMenuItem>
    <ContextMenuItem className="context-menu-item">
      <VolumeOff className="context-menu-icon" />
      <span>静音会话</span>
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem className="context-menu-item text-destructive">
      <Trash className="context-menu-icon" />
      <span>删除会话</span>
    </ContextMenuItem>
    <ContextMenuItem className="context-menu-item">
      <Copy className="context-menu-icon" />
      <span>复制ID</span>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### 7.2 菜单元项规格

| 元素 | 规格 |
|------|------|
| 背景 | --popover |
| 圆角 | 8px |
| 阴影 | blur:8px, offset:0,2px, --shadow-md |
| 菜单元项高度 | 36px |
| 菜单元项内边距 | 0 12px |
| 菜单图标尺寸 | 18px |
| 菜单文字 | Inter 14px, --foreground |

### 7.3 上下文菜单 Light/Dark Mode

| CSS 变量 | Light Mode | Dark Mode |
|----------|-----------|-----------|
| --popover | #ffffff | #232936 |
| --popover-foreground | #1a1a1a | #ffffff |
| --muted-foreground（图标） | #707579 | #8b9aa3 |
| --destructive | #e53935 | #e53935 |
| --destructive-foreground | #ffffff | #ffffff |

---

## 8. 聊天头部设计

### 8.1 私聊头部

```
┌──────────────────────────────────────────────────────────┐
│  [头像●] 李明                               🔍  📞  ⋮  │
│           在线                                             │
└──────────────────────────────────────────────────────────┘
```

```tsx
<div className="chat-header flex items-center h-16 px-5 border-b">
  {/* 左侧：头像 + 名称 + 状态 */}
  <div className="flex items-center gap-3 flex-1">
    <Avatar className="h-10 w-10">
      <AvatarFallback className="bg-primary text-primary-foreground">
        {getInitials(name)}
      </AvatarFallback>
      {isOnline && (
        <AvatarIndicator className="status-dot" />
      )}
    </Avatar>
    <div className="flex flex-col">
      <span className="font-semibold text-sm">{name}</span>
      <span className="text-xs text-success">在线</span>
    </div>
  </div>

  {/* 右侧：图标按钮 */}
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon" className="h-9 w-9">
      <Search className="h-5 w-5" />
    </Button>
    <Button variant="ghost" size="icon" className="h-9 w-9">
      <Phone className="h-5 w-5" />
    </Button>
    <Button variant="ghost" size="icon" className="h-9 w-9">
      <Video className="h-5 w-5" />
    </Button>
    <Button variant="ghost" size="icon" className="h-9 w-9">
      <MoreHorizontal className="h-5 w-5" />
    </Button>
  </div>
</div>
```

| 元素 | 规格 |
|------|------|
| 高度 | 64px |
| 背景 | --card |
| 底部边框 | 1px --border |
| 内边距 | 0 20px |
| 头像 | 40×40px 圆形 --primary 背景 + 白色字母 |
| 昵称 | Inter 15px, font-weight: 600, --foreground |
| 状态文字 | "在线", Inter 12px, --success |
| 右侧图标 | 搜索 (24px) + 语音 (24px) + 视频 (24px) + 更多 (24px)，间距 8px |

### 8.2 更多菜单（Dropdown Menu）

**私聊更多菜单**：

| 菜单项 | 图标 | 说明 |
|--------|------|------|
| 阅后即焚 | local_fire_department | 开启/关闭阅后即焚模式 |
| 删除该会话 | delete | 删除当前会话 |
| 置顶聊天 | push_pin | 切换置顶状态 |
| 静音 | volume_off | 切换静音状态 |

### 8.3 聊天头部 Light/Dark Mode

| CSS 变量 | Light Mode | Dark Mode |
|----------|-----------|-----------|
| --card（背景） | #ffffff | #232936 |
| --border | #dfe1e5 | #3d4a57 |
| --primary（头像） | #3390ec | #8777d1 |
| --primary-foreground | #ffffff | #ffffff |
| --foreground | #1a1a1a | #ffffff |
| --success | #4caf50 | #4caf50 |
| --muted-foreground | #707579 | #8b9aa3 |

---

## 9. 消息气泡设计

### 9.1 消息气泡组件

```tsx
// 收到消息
<div className="flex gap-2 items-end">
  <Avatar className="h-9 w-9">
    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
      {getInitials(sender)}
    </AvatarFallback>
  </Avatar>
  <div className="flex flex-col gap-0.5 max-w-[400px]">
    <div className="reply-bar" style={{ backgroundColor: 'var(--msg-reply-bar)' }} />
    <div className={cn(
      "message-bubble message-in",
      "rounded-tl-2 rounded-tr-[18px] rounded-br-[18px] rounded-bl-2",
      "bg-msg-in shadow-sm"
    )}>
      <p className="text-sm text-foreground">{content}</p>
      <span className="message-time text-xs text-muted-foreground">{time}</span>
    </div>
  </div>
</div>

// 发送消息
<div className="flex gap-2 items-end justify-end">
  <div className="flex flex-col gap-0.5 max-w-[400px] items-end">
    <div className="reply-bar" style={{ backgroundColor: 'var(--msg-reply-bar)' }} />
    <div className={cn(
      "message-bubble message-out",
      "rounded-tl-[18px] rounded-tr-2 rounded-br-[18px] rounded-bl-[18px]",
      "bg-msg-out text-primary-foreground"
    )}>
      <p className="text-sm">{content}</p>
      <span className="message-time text-xs opacity-70">{time} ✓✓</span>
    </div>
  </div>
  <Avatar className="h-9 w-9">
    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
      {getInitials(me)}
    </AvatarFallback>
  </Avatar>
</div>
```

### 9.2 消息尺寸规格

| 元素 | 规格 |
|------|------|
| 头像尺寸 | 36×36px 圆形 |
| 头像间距 | 与气泡间距 10px |
| 消息间距 | 消息之间间距 10px |
| 消息区域内边距 | 20px |
| 气泡最大宽度 | 400px |

### 9.3 气泡圆角规格

| 消息方向 | 圆角 [top-left, top-right, bottom-right, bottom-left] |
|----------|----------------------------------------------------|
| 收到消息 | [8, 18, 18, 18] |
| 发送消息 | [18, 8, 18, 18] |

### 9.4 文本消息样式

**收到文本消息**：

| 属性 | 规格 |
|------|------|
| 气泡背景 | --msg-in |
| 气泡圆角 | [8, 18, 18, 18] |
| 阴影 | blur:3px, offset:0,1px, --shadow-light |
| 文字 | Inter 14px, line-height: 1.3, --foreground |
| 时间 | Inter 11px, --muted-foreground，右下角 |

**发送文本消息**：

| 属性 | 规格 |
|------|------|
| 气泡背景 | --msg-out |
| 气泡圆角 | [18, 8, 18, 18] |
| 无阴影 | - |
| 文字 | Inter 14px, line-height: 1.3, --primary-foreground |
| 双勾颜色 | 已读时 --primary |

### 9.5 回复消息（引用）样式

**Telegram 风格回复消息**：

```
┌─────────────────────────────────────┐
│                                     │
│  ┌─ 回复 ────────────────────────┐  │
│  │ 👤 李明                      │  │
│  │ 你好呀，最近怎么样？          │  │
│  │ 10:15                       │  │
│  └──────────────────────────────┘  │
│                                     │
│  收到！我看看                       │
│                            10:20 ✓✓│
│                                     │
└─────────────────────────────────────┘
```

**收到回复消息组件**：

```tsx
<div className="flex gap-2 items-end">
  <Avatar className="h-9 w-9">
    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
      {getInitials(sender)}
    </AvatarFallback>
  </Avatar>
  <div className="flex flex-col gap-0.5 max-w-[400px]">
    {/* 回复引用区域 */}
    <div className="reply-container rounded-lg overflow-hidden">
      <div
        className="reply-bar w-1 self-stretch"
        style={{ backgroundColor: 'var(--msg-reply-bar)' }}
      />
      <div
        className="reply-content px-3 py-2"
        style={{ backgroundColor: 'var(--msg-reply-bg)' }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-primary">
            {replySenderName}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {replyContent}
        </p>
        <span className="text-[10px] text-muted-foreground/70">
          {replyTime}
        </span>
      </div>
    </div>

    {/* 实际消息 */}
    <div className={cn(
      "message-bubble message-in",
      "rounded-tl-2 rounded-tr-[18px] rounded-br-[18px] rounded-bl-2",
      "bg-msg-in shadow-sm"
    )}>
      <p className="text-sm text-foreground">{content}</p>
      <span className="message-time text-xs text-muted-foreground">{time}</span>
    </div>
  </div>
</div>
```

**回复引用区域规格**：

| 元素 | 规格 |
|------|------|
| 容器圆角 | 12px |
| 左侧竖条宽度 | 3px |
| 左侧竖条颜色 | --msg-reply-bar（发送者主题色） |
| 引用区域背景 | --msg-reply-bg |
| 引用区域内边距 | 8px 12px |
| 回复者名字 | Inter 12px, font-weight: 500, --primary |
| 引用内容 | Inter 12px, --muted-foreground，单行省略 |
| 引用时间 | Inter 10px, --muted-foreground，70% 透明度 |
| 引用区域与气泡间距 | 4px |

**多层引用**：

- 支持嵌套显示，最多显示 2 层引用
- 超过 2 层时折叠显示，点击展开

### 9.6 阅后即焚消息

```
[头像] ┌──────────────────────┐
       │ 什么项目？🔥5s       │
       │              10:17   │
       └──────────────────────┘
```

- 🔥5s：火焰图标 + 秒数
- 气泡样式同收到文本消息
- 倒计时结束显示销毁动画

### 9.7 语音消息

```tsx
<div className={cn(
  "message-bubble voice-message",
  "w-[180px] bg-msg-in"
)}>
  <Button variant="ghost" size="icon" className="h-8 w-8">
    <PlayArrow className="h-5 w-5 text-primary" />
  </Button>
  <div className="voice-waveform flex-1 h-8 bg-muted rounded" />
  <span className="text-xs text-muted-foreground">0:15</span>
</div>
```

| 属性 | 规格 |
|------|------|
| 气泡宽度 | 180px |
| 播放按钮 | ▶ 图标，--primary |
| 时长 | Inter 12px, --muted-foreground |
| 波形 | 灰色条形图，高度 32px |

### 9.8 文件消息

```
┌────────────────────┐
│ 📄 项目文档.pdf   │
│     2.4 MB       │
└────────────────────┘
```

| 属性 | 规格 |
|------|------|
| 文件图标 | 📄 或 description 图标，--primary |
| 文件名 | Inter 14px, font-weight: 500, --foreground |
| 文件大小 | Inter 12px, --muted-foreground |
| 气泡宽度 | 最大 240px |

### 9.9 消息发送状态（仅私聊）

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| 发送中 | ⏳ | --muted-foreground | 灰色圆圈 |
| 已发送 | ✓ | --muted-foreground | 单勾灰色 |
| 已送达 | ✓✓ | --muted-foreground | 双勾灰色 |
| 已读 | ✓✓ | --primary | 双勾蓝色 |
| 发送失败 | ❌ | --destructive | 显示重试按钮 |

### 9.10 消息气泡 Light/Dark Mode

| CSS 变量 | Light Mode | Dark Mode |
|----------|-----------|-----------|
| --msg-in（收到背景） | #ffffff | #2d3a47 |
| --msg-out（发送背景） | #e6ffde | #8777d1 |
| --msg-reply-bar | #3390ec | #8777d1 |
| --msg-reply-bg | #f0f0f0 | #2d2d2d |
| --primary-foreground | #ffffff | #ffffff |
| --foreground | #1a1a1a | #ffffff |
| --muted-foreground | #707579 | #8b9aa3 |
| --shadow-light | #00000014 | #00000033 |

---

## 10. 消息右键菜单

### 10.1 菜单位置

| 消息方向 | 菜单位置 |
|----------|----------|
| 我方消息（发送） | 菜单显示在气泡**右侧** |
| 对方消息（接收） | 菜单显示在气泡**左侧** |

**上下位置判断**：

- 消息在屏幕上半部分 → 菜单显示在气泡**下方**
- 消息在下半部分 → 菜单显示在气泡**上方**
- 确保菜单不超出屏幕边界

### 10.2 菜单内容（按消息类型）

**文本消息**：

| 菜单项 | 图标 | 说明 |
|--------|------|------|
| 复制 | content_copy | 复制消息文本 |
| 引用 | reply | 引用回复 |
| 转发 | forward | 转发消息 |
| 删除 | delete | 撤回消息（仅自己发送的） |

**图片消息**：

| 菜单项 | 图标 | 说明 |
|--------|------|------|
| 复制 | content_copy | 复制消息文本 |
| 引用 | reply | 引用回复 |
| 转发 | forward | 转发消息 |
| 下载 | download | 下载图片 |
| 删除 | delete | 撤回消息（仅自己发送的） |

**文件消息**：

| 菜单项 | 图标 | 说明 |
|--------|------|------|
| 复制 | content_copy | 复制消息文本 |
| 引用 | reply | 引用回复 |
| 转发 | forward | 转发消息 |
| 下载 | download | 下载文件 |
| 删除 | delete | 撤回消息（仅自己发送的） |

**语音消息**：

| 菜单项 | 图标 | 说明 |
|--------|------|------|
| 复制 | content_copy | 复制消息文本 |
| 引用 | reply | 引用回复 |
| 转发 | forward | 转发消息 |
| 删除 | delete | 撤回消息（仅自己发送的） |

### 10.3 菜单样式

| 元素 | 规格 |
|------|------|
| 背景 | --popover |
| 圆角 | 8px |
| 阴影 | blur:8px, offset:0,2px, --shadow-md |
| 菜单元项高度 | 36px |
| 菜单元项内边距 | 0 12px |
| 菜单图标尺寸 | 18px |
| 菜单文字 | Inter 14px, --foreground |

---

## 11. 底部输入区设计

### 11.1 输入区布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────┐  📎  😊  🎤   │
│  │ 输入消息...              ➤  │                    │
│  └─────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

```tsx
<div className="input-area flex items-center h-[72px] px-5 gap-3 border-t bg-card">
  {/* 附件按钮 */}
  <Button variant="ghost" size="icon" className="h-10 w-10">
    <AttachFile className="h-5 w-5 text-muted-foreground" />
  </Button>

  {/* 输入框 */}
  <div className="flex-1 relative">
    <Input
      className="h-11 rounded-full bg-input pr-12"
      placeholder="输入消息..."
    />
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
    >
      <Send className="h-4 w-4 text-muted-foreground" />
    </Button>
  </div>

  {/* 表情按钮 */}
  <Button variant="ghost" size="icon" className="h-10 w-10">
    <SentimentSatisfied className="h-5 w-5 text-muted-foreground" />
  </Button>

  {/* 麦克风按钮 */}
  <Button variant="ghost" size="icon" className="h-10 w-10">
    <Mic className="h-5 w-5 text-muted-foreground" />
  </Button>
</div>
```

### 11.2 输入区规格

| 元素 | 规格 |
|------|------|
| 输入区域高度 | 72px |
| 输入区域背景 | --card |
| 边框 | 顶边框 1px --border |
| 内边距 | 14px 垂直, 20px 水平 |
| 按钮间距 | 12px |

### 11.3 输入框规格

| 属性 | 规格 |
|------|------|
| 圆角 | 22px |
| 背景 | --input |
| 高度 | 44px |
| 内边距 | 0 16px |
| 占位文字 | "输入消息...", Inter 14px, --muted-foreground |
| 发送图标 | ➤, 28px, --muted-foreground |

### 11.4 工具栏按钮

| 按钮 | 图标 | 功能 |
|------|------|------|
| 附件 | attach_file | 打开文件选择器，选择后发送文件消息 |
| 表情 | sentiment_satisfied | 打开 Telegram 风格表情选择弹窗 |
| 麦克风 | mic | 录制语音，松开后发送语音消息 |
| 发送 | send | 发送消息 |

### 11.5 表情选择面板（Popover）

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="h-10 w-10">
      <SentimentSatisfied className="h-5 w-5" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="emoji-picker w-80 p-0" align="start">
    {/* Emoji Mart 组件 */}
  </PopoverContent>
</Popover>
```

### 11.6 输入区域 Light/Dark Mode

| CSS 变量 | Light Mode | Dark Mode |
|----------|-----------|-----------|
| --card | #ffffff | #232936 |
| --border | #dfe1e5 | #3d4a57 |
| --input | #f8f9fa | #1a242d |
| --muted-foreground | #707579 | #8b9aa3 |

---

## 12. 语音/视频通话设计

### 12.1 通话状态定义

| 状态 | 说明 |
|------|------|
| 来电呼入 | 收到对方语音/视频通话邀请 |
| 呼出中 | 发起通话，等待对方接听 |
| 通话中 | 双方正在通话 |
| 通话结束 | 通话已结束 |
| 未接来电 | 来电未被接听 |

### 12.2 通话来电界面

**私聊语音来电**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│                                                               │
│                        [头像]                                  │
│                          ○                                    │
│                                                               │
│                        李明                                   │
│                     语音通话邀请                               │
│                                                               │
│                                                               │
│         [拒绝]                    [接听]                      │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**私聊视频来电**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│                                                               │
│                        [头像]                                  │
│                          ○                                    │
│                                                               │
│                        李明                                   │
│                     视频通话邀请                               │
│                                                               │
│                                                               │
│         [拒绝]                    [接听]                      │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**来电界面组件**：

```tsx
<Dialog open={isIncoming}>
  <DialogContent className="call-incoming p-0 border-0 max-w-none w-screen h-screen rounded-none bg-call-overlay">
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* 头像 */}
      <Avatar className="h-32 w-32">
        <AvatarFallback className="bg-primary text-primary-foreground text-4xl font-semibold">
          {getInitials(callerName)}
        </AvatarFallback>
        {/* 头像来电动画光环 */}
        <div className="absolute inset-0 rounded-full border-4 border-primary animate-pulse" />
      </Avatar>

      {/* 名称和状态 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">{callerName}</h2>
        <p className="text-base text-muted-foreground">
          {callType === 'video' ? '视频通话邀请' : '语音通话邀请'}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-16 mt-8">
        <Button
          variant="ghost"
          size="icon"
          className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90"
        >
          <PhoneOff className="h-8 w-8 text-white" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-16 w-16 rounded-full bg-success hover:bg-success/90"
        >
          <Phone className="h-8 w-8 text-white" />
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**来电界面规格**：

| 元素 | 规格 |
|------|------|
| 全屏背景 | --call-overlay（半透明黑色） |
| 头像尺寸 | 128×128px 圆形 |
| 头像光环 | 4px 边框，--primary，pulse 动画 |
| 名称 | Inter 24px, font-weight: 600, --foreground |
| 状态文字 | Inter 14px, --muted-foreground |
| 拒绝按钮 | 64×64px 圆形，背景 --destructive |
| 接听按钮 | 64×64px 圆形，背景 --success |
| 按钮间距 | 64px |
| 按钮图标尺寸 | 32px，白色 |

### 12.3 呼出界面（对方未接）

**呼出中**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│                                                               │
│                        [头像]                                  │
│                          ○                                    │
│                                                               │
│                        李明                                   │
│                       正在呼叫...                              │
│                                                               │
│                                                               │
│                         [取消]                                │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**呼出界面组件**：

```tsx
<Dialog open={isCalling}>
  <DialogContent className="call-calling p-0 border-0 max-w-none w-screen h-screen rounded-none bg-call-overlay">
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* 头像 */}
      <Avatar className="h-32 w-32">
        <AvatarFallback className="bg-primary text-primary-foreground text-4xl font-semibold">
          {getInitials(calleeName)}
        </AvatarFallback>
      </Avatar>

      {/* 名称和状态 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">{calleeName}</h2>
        <p className="text-base text-muted-foreground animate-pulse">
          正在呼叫...
        </p>
      </div>

      {/* 取消按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 mt-8"
      >
        <PhoneOff className="h-8 w-8 text-white" />
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**呼出界面规格**：

| 元素 | 规格 |
|------|------|
| 全屏背景 | --call-overlay |
| 头像尺寸 | 128×128px 圆形 |
| 名称 | Inter 24px, font-weight: 600, --foreground |
| 状态文字 | Inter 14px, --muted-foreground，pulse 动画表示正在呼叫 |
| 取消按钮 | 64×64px 圆形，背景 --destructive |

### 12.4 通话中界面

**语音通话中**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│                                                               │
│                        [头像]                                  │
│                          ○                                    │
│                                                               │
│                        李明                                   │
│                       00:32                                   │
│                                                               │
│                                                               │
│       [静音]      [挂断]      [更多]                          │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**语音通话中组件**：

```tsx
<Dialog open={isInCall}>
  <DialogContent className="call-active p-0 border-0 max-w-none w-screen h-screen rounded-none bg-call-overlay">
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* 头像 */}
      <Avatar className="h-32 w-32">
        <AvatarFallback className="bg-primary text-primary-foreground text-4xl font-semibold">
          {getInitials(peerName)}
        </AvatarFallback>
      </Avatar>

      {/* 名称和通话时长 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">{peerName}</h2>
        <p className="text-base text-muted-foreground">{callDuration}</p>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center gap-8 mt-8">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full",
            isMuted ? "bg-destructive hover:bg-destructive/90" : "bg-muted hover:bg-muted/80"
          )}
        >
          {isMuted ? (
            <MicOff className="h-7 w-7 text-white" />
          ) : (
            <Mic className="h-7 w-7 text-foreground" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 rounded-full bg-destructive hover:bg-destructive/90"
        >
          <PhoneOff className="h-7 w-7 text-white" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 rounded-full bg-muted hover:bg-muted/80"
        >
          <MoreHorizontal className="h-7 w-7 text-foreground" />
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**通话中规格**：

| 元素 | 规格 |
|------|------|
| 全屏背景 | --call-overlay |
| 头像尺寸 | 128×128px 圆形 |
| 名称 | Inter 24px, font-weight: 600, --foreground |
| 时长 | Inter 14px, --muted-foreground，格式 MM:SS |
| 控制按钮尺寸 | 56×56px 圆形 |
| 静音/挂断/更多按钮间距 | 32px |

**控制按钮状态**：

| 按钮 | 开启状态 | 关闭状态 |
|------|----------|----------|
| 静音 | 背景 --destructive，图标白色 | 背景 --muted，图标 --foreground |
| 挂断 | 背景 --destructive，图标白色 | - |
| 更多 | 背景 --muted | - |

### 12.5 视频通话中界面（PiP 小窗口）

**视频通话中主界面**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                    [对方视频画面全屏]                          │
│                                                               │
│                                                               │
│                                                               │
│                                                               │
│                                                    ┌────────┐ │
│                                                    │ 我的   │ │
│                                                    │ 视频   │ │
│                                                    │        │ │
│                                                    └────────┘ │
│                                                               │
│       [静音]      [挂断]      [切换摄像头]      [更多]        │
└─────────────────────────────────────────────────────────────┘
```

**小窗口（PiP）组件**：

```tsx
{/* 可拖拽小窗口 */}
<div
  className={cn(
    "pip-window fixed w-40 h-52 rounded-xl overflow-hidden shadow-xl cursor-move",
    "bg-black"
  )}
  style={{
    right: pipPosition.x,
    bottom: pipPosition.y,
  }}
  draggable
  onDragEnd={handleDragEnd}
>
  <video
    className="w-full h-full object-cover"
    autoPlay
    muted
    playsInline
    ref={localVideoRef}
  />
  {/* 小窗口关闭按钮 */}
  <Button
    variant="ghost"
    size="icon"
    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 hover:bg-black/70"
    onClick={togglePiP}
  >
    <X className="h-3 w-3 text-white" />
  </Button>
</div>
```

**PiP 小窗口规格**：

| 元素 | 规格 |
|------|------|
| 窗口尺寸 | 160×208px（比例约 4:5） |
| 窗口圆角 | 12px |
| 窗口位置 | 右下角，距边缘 100px |
| 可拖拽范围 | 屏幕内任意位置 |
| 拖拽时显示阴影 | --shadow-lg |
| 背景 | 黑色（视频轨道） |
| 关闭按钮 | 24×24px 圆形，背景 rgba(0,0,0,0.5) |

**视频通话底部控制栏**：

| 按钮 | 图标 | 功能 |
|------|------|------|
| 静音 | mic / mic_off | 切换麦克风 |
| 挂断 | phone_off | 结束通话 |
| 切换摄像头 | videocam / videocam_off | 切换前后摄像头 |
| 更多 | more_horizontal | 更多选项（如小窗口、扬声器等） |

### 12.6 通话结束界面

**通话结束提示**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│                                                               │
│                        [头像]                                  │
│                          ○                                    │
│                                                               │
│                      通话结束                                  │
│                     通话时长 00:32                            │
│                                                               │
│                                                               │
│                         [确定]                                │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**通话结束组件**：

```tsx
<Dialog open={callEnded}>
  <DialogContent className="call-ended p-0 border-0 max-w-none w-screen h-screen rounded-none bg-call-overlay">
    <div className="flex flex-col items-center justify-center h-full gap-6">
      {/* 头像 */}
      <Avatar className="h-24 w-24 opacity-60">
        <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
          {getInitials(peerName)}
        </AvatarFallback>
      </Avatar>

      {/* 结束信息 */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-medium text-foreground">通话结束</h2>
        <p className="text-sm text-muted-foreground">通话时长 {callDuration}</p>
      </div>

      {/* 确定按钮 */}
      <Button
        variant="default"
        className="h-12 px-8 rounded-full bg-primary text-primary-foreground"
        onClick={() => setCallEnded(false)}
      >
        确定
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**通话结束规格**：

| 元素 | 规格 |
|------|------|
| 头像尺寸 | 96×96px，60% 透明度 |
| 标题 | Inter 18px, font-weight: 500, --foreground |
| 时长 | Inter 14px, --muted-foreground |
| 确定按钮 | h-12, px-8, 圆角 9999px（胶囊形） |

### 12.7 未接来电界面

**未接来电提示**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│                                                               │
│                        [头像]                                  │
│                          ○                                    │
│                                                               │
│                       李明                                    │
│                     未接来电                                  │
│                     刚刚                                     │
│                                                               │
│                                                               │
│         [回拨]                    [关闭]                      │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**未接来电组件**：

```tsx
<Dialog open={missedCall}>
  <DialogContent className="call-missed p-0 border-0 max-w-none w-screen h-screen rounded-none bg-call-overlay">
    <div className="flex flex-col items-center justify-center h-full gap-6">
      {/* 头像 */}
      <Avatar className="h-24 w-24">
        <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
          {getInitials(peerName)}
        </AvatarFallback>
      </Avatar>

      {/* 未接信息 */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-medium text-foreground">{peerName}</h2>
        <p className="text-sm text-destructive font-medium">未接来电</p>
        <p className="text-xs text-muted-foreground">{missedTime}</p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-8 mt-4">
        <Button
          variant="outline"
          className="h-12 px-6 rounded-full"
          onClick={() => {/* 回拨 */}}
        >
          <Phone className="h-5 w-5 mr-2" />
          回拨
        </Button>
        <Button
          variant="ghost"
          className="h-12 px-6 rounded-full text-muted-foreground"
          onClick={() => setMissedCall(false)}
        >
          关闭
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**未接来电规格**：

| 元素 | 规格 |
|------|------|
| 头像尺寸 | 96×96px |
| 名称 | Inter 18px, font-weight: 500, --foreground |
| 未接文字 | Inter 14px, font-weight: 500, --destructive |
| 时间 | Inter 12px, --muted-foreground |
| 回拨按钮 | h-12, px-6, 圆角 9999px, 边框 --border |
| 关闭按钮 | h-12, px-6, 圆角 9999px, 透明背景 |

### 12.8 通话 Light/Dark Mode

| CSS 变量 | Light Mode | Dark Mode |
|----------|-----------|-----------|
| --call-overlay | rgba(0,0,0,0.6) | rgba(0,0,0,0.8) |
| --call-card | #ffffff | #232936 |
| --foreground | #1a1a1a | #ffffff |
| --muted-foreground | #707579 | #8b9aa3 |
| --primary | #3390ec | #8777d1 |
| --success | #4caf50 | #4caf50 |
| --destructive | #e53935 | #e53935 |
| --muted | #f8f9fa | #2d3a47 |

### 12.9 通话额外场景

#### 12.9.1 通话中被对方挂断

**触发**：通话中对方主动挂断

**交互流程**：
```
[通话中] ──对方挂断──→ [通话结束界面]
                          │
                          ├── 显示 "通话已结束"
                          └── 显示通话时长 + [确定] 按钮
```

**界面样式**：同 12.6 通话结束界面

#### 12.9.2 语音通话升级为视频通话

**触发**：语音通话中，点击"更多" → "开启视频"

**交互流程**：
```
[语音通话中]
       │
       ├── [更多] ──→ [更多菜单]
       │                  │
       │                  └── [开启视频] ──→ [请求视频权限]
       │                                          │
       │                     ──权限同意──→ [视频通话中]
       │                     ──权限拒绝──→ [提示：无法开启视频]
       │
       └── [关闭视频] ──→ [语音通话中]
```

**视频权限请求**：
- 首次请求时弹出系统权限请求
- 权限被拒绝后显示提示："请在系统设置中允许使用摄像头"

#### 12.9.3 来电时正在通话

**触发**：用户 A 正在通话中，用户 B 发起通话

**交互流程**：
```
[通话中] ──收到来电──→ [来电提示弹窗]
                              │
                              ├── [切换] ──→ [保留当前通话，接听新来电]
                              │              │
                              │              └── 通话列表显示两个通话
                              │
                              ├── [拒绝] ──→ [继续当前通话]
                              │              └── 对方收到"忙碌"提示
                              │
                              └── [忽略] ──→ [继续当前通话]
                                              └── 对方收到"未接来电"提示
```

**来电提示弹窗组件**：

```tsx
<Dialog open={isSecondCallIncoming}>
  <DialogContent className="second-call p-6 border-0 max-w-sm rounded-2xl">
    <div className="flex items-center gap-4">
      <Avatar className="h-12 w-12">
        <AvatarFallback className="bg-primary text-primary-foreground">
          {getInitials(callerName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <h3 className="font-semibold">{callerName}</h3>
        <p className="text-sm text-muted-foreground">来电</p>
      </div>
    </div>
    <div className="flex gap-3 mt-4">
      <Button
        variant="outline"
        className="flex-1"
        onClick={() => rejectSecondCall()}
      >
        拒绝
      </Button>
      <Button
        variant="default"
        className="flex-1"
        onClick={() => switchToSecondCall()}
      >
        切换
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**来电提示弹窗规格**：

| 元素 | 规格 |
|------|------|
| 宽度 | 最大 384px |
| 圆角 | 16px |
| 背景 | --card |
| 头像尺寸 | 48×48px |
| 按钮布局 | 左右分布，flex-1 |

#### 12.9.4 通话超时（无人接听）

**触发**：呼出后 60 秒无人接听

**交互流程**：
```
[呼出中] ──60秒超时──→ [通话结束界面]
                              │
                              ├── 显示 "无人接听"
                              └── 显示 [确定] 按钮
```

**超时提示**：显示 "无人接听" 而不是 "通话结束"

#### 12.9.5 PiP 小窗口拖拽交互

**拖拽行为**：

| 状态 | 视觉反馈 |
|------|----------|
| 拖拽开始 | 窗口放大 5%，阴影加深 |
| 拖拽中 | 窗口跟随鼠标，保持原尺寸 |
| 拖拽释放 | 窗口缩小回原尺寸，固定在新位置 |

**位置限制**：
- 窗口不能超出屏幕可视区域
- 最小边距：距屏幕边缘 16px

**拖拽组件状态**：

```tsx
<div
  className={cn(
    "pip-window fixed rounded-xl overflow-hidden shadow-xl cursor-move",
    "bg-black",
    isDragging && "scale-105 shadow-2xl"  // 拖拽中放大
  )}
  style={{
    right: pipPosition.x,
    bottom: pipPosition.y,
    width: '160px',
    height: '208px',
  }}
  draggable
  onDragStart={handleDragStart}
  onDrag={handleDrag}
  onDragEnd={handleDragEnd}
>
  {/* 视频内容 */}
</div>
```

---

## 13. 消息交互流程

### 13.1 引用回复流程

**触发方式**：右键消息气泡 → 点击"引用"

**交互流程**：

```
[消息气泡] ──右键──→ [上下文菜单] ──点击"引用"──→ [激活引用模式]
                                                            │
                                                            ▼
                                                    [输入框上方显示引用条]
                                                            │
                                                            ▼
                                                    [用户输入回复内容]
                                                            │
                                                            ▼
                                                    [发送消息]
                                                            │
                                                            ▼
                                                    [清空引用条 + 发送消息]
```

**引用条组件**：

```tsx
{isReplyingTo && (
  <div className="reply-bar flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
    <div
      className="w-1 h-8 rounded-full"
      style={{ backgroundColor: 'var(--msg-reply-bar)' }}
    />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-primary">
        回复 {replyToSenderName}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {replyToContent}
      </p>
    </div>
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => setIsReplyingTo(null)}
    >
      <X className="h-4 w-4" />
    </Button>
  </div>
)}
```

**引用条规格**：

| 元素 | 规格 |
|------|------|
| 背景 | --muted |
| 圆角 | 8px |
| 内边距 | 8px 16px |
| 竖条宽度 | 4px |
| 竖条颜色 | --msg-reply-bar |
| 发送者名字 | Inter 12px, font-weight: 500, --primary |
| 引用内容 | Inter 12px, --muted-foreground，单行省略 |
| 关闭按钮 | 24×24px，--muted-foreground |

### 13.2 转发消息流程

**触发方式**：右键消息气泡 → 点击"转发"

**交互流程**：

```
[消息气泡] ──右键──→ [上下文菜单] ──点击"转发"──→ [转发选择器]
                                                              │
                                                              ▼
                                                    [显示好友/群聊列表]
                                                              │
                                                              ▼
                                                    [选择接收者] ──→ [确认发送]
                                                              │
                                                              ▼
                                                    [显示"已转发"提示]
```

**转发选择器组件**：

```tsx
<Dialog open={isForwarding}>
  <DialogContent className="forward-dialog max-w-md">
    <DialogHeader>
      <DialogTitle>转发消息</DialogTitle>
    </DialogHeader>

    {/* 搜索框 */}
    <Input
      placeholder="搜索联系人或群聊"
      value={searchKeyword}
      onChange={(e) => setSearchKeyword(e.target.value)}
    />

    {/* 联系人列表 */}
    <ScrollArea className="h-[300px]">
      <div className="space-y-1">
        {filteredContacts.map((contact) => (
          <button
            key={contact.id}
            className={cn(
              "forward-item w-full flex items-center gap-3 p-2 rounded-lg",
              "hover:bg-accent",
              selectedIds.includes(contact.id) && "bg-accent"
            )}
            onClick={() => toggleSelection(contact.id)}
          >
            <Checkbox
              checked={selectedIds.includes(contact.id)}
            />
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="font-medium">{contact.name}</p>
              <p className="text-xs text-muted-foreground">
                {contact.type === 'group' ? '群聊' : '好友'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>

    <DialogFooter>
      <Button variant="outline" onClick={() => setIsForwarding(false)}>
        取消
      </Button>
      <Button
        disabled={selectedIds.length === 0}
        onClick={() => handleForward()}
      >
        发送 ({selectedIds.length})
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**转发选择器规格**：

| 元素 | 规格 |
|------|------|
| 对话框宽度 | 最大 448px |
| 搜索框高度 | 40px |
| 联系人列表高度 | 最大 300px |
| 联系人项高度 | 56px |
| 头像尺寸 | 40×40px |
| 确认按钮 | 显示选中数量 |

### 13.3 删除消息/会话确认

**触发方式**：右键消息/会话 → 点击"删除"

**交互流程**：

```
[右键菜单] ──点击"删除"──→ [确认对话框]
                                     │
                                     ├── [取消] ──→ [关闭对话框]
                                     │
                                     └── [确认删除] ──→ [执行删除]
                                                          │
                                                          ├── 消息：移除消息气泡
                                                          └── 会话：返回会话列表
```

**删除确认对话框**：

```tsx
<Dialog open={showDeleteConfirm}>
  <DialogContent className="delete-confirm max-w-sm">
    <DialogHeader>
      <DialogTitle>删除消息</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      确定要删除这条消息吗？删除后无法恢复。
    </p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
        取消
      </Button>
      <Button
        variant="destructive"
        onClick={() => handleDelete()}
      >
        删除
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**删除确认规格**：

| 元素 | 规格 |
|------|------|
| 对话框宽度 | 最大 360px |
| 圆角 | 12px |
| 标题 | Inter 16px, font-weight: 600 |
| 描述文字 | Inter 14px, --muted-foreground |
| 取消按钮 | variant: outline |
| 删除按钮 | variant: destructive |

### 13.4 撤回消息流程

**触发方式**：右键自己发送的消息 → 点击"删除"

**交互流程**：

```
[右键菜单] ──点击"删除"──→ [确认对话框] ──[确认]──→ [消息显示已撤回]
```

**已撤回消息显示**：

```
┌─────────────────────────────────────┐
│                                     │
│         该消息已被撤回               │
│                                     │
└─────────────────────────────────────┘
```

**已撤回消息样式**：

| 属性 | 规格 |
|------|------|
| 文字 | Inter 13px, --muted-foreground, 斜体 |
| 居中显示 | 是 |
| 气泡背景 | 透明 |
| 高度 | 32px |

### 13.5 发送失败重试流程

**触发**：消息发送失败后

**交互流程**：

```
[消息发送失败] ──点击重试按钮──→ [重新发送]
                     │
                     └── ──发送成功──→ [显示消息状态为已发送]
```

**重试按钮样式**：

```tsx
<div className="flex items-center gap-1">
  <span className="text-xs text-destructive">发送失败</span>
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={() => retrySend()}
  >
    <RefreshCw className="h-3 w-3" />
  </Button>
</div>
```

---

## 14. 输入区交互细节

### 14.1 粘贴图片

**触发方式**：Ctrl+V 在输入框中粘贴图片

**交互流程**：

```
[输入框聚焦] ──Ctrl+V──→ [检测到图片数据]
                         │
                         ▼
                  [显示图片预览]
                         │
                         ▼
                  [输入框显示缩略图 + 删除按钮]
                         │
                         ▼
                  [发送消息] ──→ [发送图片消息]
                  │
                  └── [按 ESC 或点击删除] ──→ [取消发送]
```

**图片预览样式**：

```tsx
{pendingImage && (
  <div className="pending-image relative inline-block">
    <img
      src={pendingImage.preview}
      alt="待发送图片"
      className="h-20 w-20 object-cover rounded-lg"
    />
    <Button
      variant="ghost"
      size="icon"
      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/50"
      onClick={() => setPendingImage(null)}
    >
      <X className="h-4 w-4 text-white" />
    </Button>
  </div>
)}
```

**图片预览规格**：

| 元素 | 规格 |
|------|------|
| 预览尺寸 | 80×80px |
| 预览圆角 | 8px |
| 删除按钮位置 | 右上角 -8px |
| 删除按钮尺寸 | 24×24px 圆形 |

### 14.2 文件选择

**触发方式**：点击附件按钮

**支持的文件类型**：

| 类型 | MIME 类型 | 大小限制 |
|------|-----------|----------|
| 图片 | image/* | 10MB |
| 文档 | application/pdf, application/msword, application/vnd.* | 100MB |
| 视频 | video/* | 100MB |
| 音频 | audio/* | 50MB |
| 其他 | */* | 100MB |

**文件消息预览**：

```tsx
{pendingFile && (
  <div className="pending-file flex items-center gap-3 p-3 bg-muted rounded-lg">
    <FileIcon className="h-10 w-10 text-primary" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{pendingFile.name}</p>
      <p className="text-xs text-muted-foreground">
        {formatFileSize(pendingFile.size)}
      </p>
    </div>
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setPendingFile(null)}
    >
      <X className="h-4 w-4" />
    </Button>
  </div>
)}
```

### 14.3 麦克风录音交互

**录音状态**：

| 状态 | 视觉反馈 |
|------|----------|
| 默认 | 麦克风图标 |
| 按下开始 | 图标变红，开始计时 |
| 录音中 | 显示录音时长 "0:15" |
| 松开发送 | 发送语音消息 |
| 取消录音 | 向左滑动并松开 |

**录音组件**：

```tsx
<Button
  variant="ghost"
  size="icon"
  className={cn(
    "h-10 w-10 relative",
    isRecording && "text-destructive"
  )}
  onMouseDown={startRecording}
  onMouseUp={stopRecording}
  onMouseLeave={cancelRecording}
>
  <Mic className="h-5 w-5" />
  {isRecording && (
    <span className="absolute -bottom-5 text-xs text-destructive">
      {recordingDuration}
    </span>
  )}
</Button>
```

### 14.4 表情选择交互

**触发**：点击表情按钮

**交互流程**：

```
[表情按钮] ──点击──→ [表情面板]
                        │
                        ├── [选择表情] ──→ [插入输入框] ──→ [关闭面板]
                        │
                        ├── [点击分类] ──→ [切换分类]
                        │
                        ├── [搜索表情] ──→ [显示搜索结果]
                        │
                        └── [点击外部 / ESC] ──→ [关闭面板]
```

**表情面板规格**：

| 元素 | 规格 |
|------|------|
| 面板宽度 | 320px |
| 面板高度 | 400px |
| 分类标签高度 | 40px |
| 表情网格 | 8列 |
| 表情尺寸 | 32×32px |

---

## 15. 空状态设计

### 17.1 无会话选中

- 显示空白聊天区域
- 背景色：--chat-background

### 17.2 已选会话但无消息

```
┌─────────────────────────────────────┐
│                                     │
│         暂无聊天消息                 │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

- 文字居中显示在消息区域顶部
- 与顶部栏保持适当距离（约 20px）
- Inter 14px, --muted-foreground

---

## 16. 消息加载机制

### 16.1 初始加载

- 首次进入会话加载最近 50 条消息

### 16.2 自动加载历史

- 当滚动到顶部区域时，自动加载更早消息
- 每次加载 30 条
- 保持当前滚动位置

### 16.3 加载指示器

| 状态 | 显示 |
|------|------|
| 加载中 | 显示加载指示器（圆圈动画） |
| 已加载完毕 | 显示"没有更早消息了" |
| 仍有更多 | 无特殊提示 |

### 16.4 新消息

- 新消息自动添加到列表底部
- 自动滚动到最新消息

---

## 17. shadcn/ui 组件安装

```bash
# 安装 shadcn/ui 核心组件
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add context-menu
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add tooltip
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add dialog

# 安装图标
npm install lucide-react
```

---

## 18. cn 工具函数

```tsx
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 19. Figma 设计标注要求

### 19.1 设计系统组件标注

使用 shadcn/ui 组件库时，Figma 设计稿应标注：

| 标注项 | 说明 | 示例 |
|--------|------|------|
| 组件名称 | shadcn/ui 组件名 | `<Avatar>`, `<Button>` |
| 变体 | 组件变体 | `variant="default"`, `variant="destructive"` |
| Tailwind 类 | 样式类名 | `h-10 w-10 rounded-full` |
| CSS 变量 | 使用的主题变量 | `--primary`, `--card` |
| 状态 | 交互状态 | Default, Hover, Focus, Active, Disabled |

### 19.2 组件命名规范（shadcn/ui）

```
组件/变体/状态
例如：
- Avatar/default/Default
- Avatar/selected/Default
- Button/default/Default
- Button/default/Hover
- Button/default/Active
- Button/default/Disabled
- Badge/destructive/Default
- Input/default/Focus
- Input/default/Error
- Dialog/call-incoming/Default
- Dialog/call-calling/Default
- Dialog/call-active/Default
```

### 19.3 Figma 图层组织

```
Page: Security Chat - 会话列表与聊天界面
├── 00_Sidebar (侧边栏)
│   ├── Sidebar_Toolbar
│   │   ├── Menu_Button
│   │   └── Search_Box
│   ├── Conversation_List
│   │   ├── Conversation_Card/default
│   │   ├── Conversation_Card/hover
│   │   ├── Conversation_Card/active
│   │   └── Conversation_Card/unread
│   ├── FAB_Button
│   └── FAB_Menu
│
├── 01_Chat_Header (聊天头部)
│   ├── Chat_Header_Private
│   │   ├── Avatar
│   │   ├── Name
│   │   ├── Status
│   │   └── Action_Buttons
│   └── Dropdown_Menu
│
├── 02_Message_List (消息列表)
│   ├── Message_Bubble_In
│   │   ├── Text
│   │   ├── Voice
│   │   ├── File
│   │   ├── Reply
│   │   │   ├── Reply_Reference
│   │   │   └── Reply_Message
│   │   └── Burn_After_Read
│   ├── Message_Bubble_Out
│   │   ├── Text
│   │   ├── Voice
│   │   ├── File
│   │   ├── Reply
│   │   │   ├── Reply_Reference
│   │   │   └── Reply_Message
│   │   └── Burn_After_Read
│   ├── Message_Status
│   │   ├── Sending
│   │   ├── Sent
│   │   ├── Delivered
│   │   ├── Read
│   │   └── Failed
│   └── Context_Menu
│
├── 03_Input_Area (输入区域)
│   ├── Input_Box
│   ├── Attach_Button
│   ├── Emoji_Picker
│   └── Mic_Button
│
├── 04_Call_Interface (通话界面)
│   ├── Call_Incoming
│   │   ├── Avatar
│   │   ├── Caller_Name
│   │   ├── Call_Type (语音/视频)
│   │   ├── Decline_Button
│   │   └── Accept_Button
│   ├── Call_Calling
│   │   ├── Avatar
│   │   ├── Callee_Name
│   │   ├── Calling_Status
│   │   └── Cancel_Button
│   ├── Call_Active
│   │   ├── Avatar
│   │   ├── Peer_Name
│   │   ├── Call_Duration
│   │   ├── Control_Buttons
│   │   └── PiP_Window (视频)
│   ├── Call_Ended
│   │   ├── Avatar
│   │   ├── End_Status
│   │   ├── Call_Duration
│   │   └── Confirm_Button
│   └── Call_Missed
│       ├── Avatar
│       ├── Caller_Name
│       ├── Missed_Status
│       ├── Missed_Time
│       ├── Callback_Button
│       └── Close_Button
│
└── 05_Components (通用组件)
    ├── Avatar
    │   ├── Avatar_Default
    │   └── Avatar_Active
    ├── Badge
    ├── Context_Menu
    ├── Dropdown_Menu
    └── Popover
```

---

## 20. 设计文件节点 ID

| 页面 | Light Mode ID | Dark Mode ID |
|------|-------------|--------------|
| 会话列表 | OsJbt | E65nJ |
| 群聊 | dmVZ1 | - |

`.pen` 文件路径: `/Users/jerry/Desktop/security-chat.pen`

---

## 21. 主题切换

### 21.1 切换位置

**导航抽屉 (Sheet)** - 提供主题选择：
- 浅色模式 (☀️)
- 深色模式 (🌙)
- 自动模式 (💻) - 跟随系统设置

### 21.2 切换方式

- 点击抽屉栏中的主题按钮循环切换
- 切换时使用 CSS transition 实现平滑过渡

### 21.3 过渡动画

```css
:root {
  transition: background-color 200ms ease, color 200ms ease;
}

* {
  transition: background-color 200ms ease, border-color 200ms ease;
}
```

### 21.4 主题持久化

- 使用 localStorage 存储主题偏好
- 页面加载时读取并应用主题

---

## 22. 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0 | 2026-04-07 | 初始版本，整合会话列表与聊天界面设计 |
| 1.1 | 2026-04-07 | 添加回复消息样式、语音/视频通话界面设计 |
| 1.2 | 2026-04-07 | 补充完整通话流程（被挂断、语音→视频切换、来电时正在通话）、消息交互流程（引用回复、转发、删除确认、撤回）、输入区交互细节 |

---

## 23. 参考资料

- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Material Symbols](https://fonts.google.com/icons)
- [Telegram Desktop Design](https://desktop.telegram.org)
- [会话列表 UI 改版设计](./会话列表UI改版设计.md)
- [聊天界面 UI 改版设计](./聊天界面UI改版设计.md)
- [Security Chat 主设计文档](./2026-04-07-master-design.md)
- `.pen` 文件: `/Users/jerry/Desktop/security-chat.pen`
