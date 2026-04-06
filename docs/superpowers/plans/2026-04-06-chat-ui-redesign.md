# 聊天界面 UI 改版实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按照设计稿对 Security Chat 桌面端进行 UI 改版，实现会话列表和聊天界面的完整重构

**Architecture:** 采用组件化架构，CSS 变量实现 Light/Dark 双主题，响应式布局支持桌面端自适应

**Tech Stack:** React + TypeScript + CSS Variables + emoji-mart

---

## 文件结构

```
apps/desktop/src/
├── styles.css                          # 全局样式和 CSS 变量
├── features/
│   ├── chat/
│   │   ├── chat-panel.tsx             # 聊天面板主组件
│   │   ├── conversation-sidebar.tsx    # 会话列表侧边栏
│   │   ├── group-chat.tsx            # 群聊列表组件
│   │   ├── top-bar.tsx               # 新增：顶部栏组件
│   │   ├── message-bubble.tsx         # 新增：消息气泡组件
│   │   ├── message-context-menu.tsx    # 新增：右键菜单组件
│   │   ├── fab-menu.tsx              # 新增：FAB 按钮和菜单组件
│   │   └── emoji-picker.tsx           # 新增：表情选择器组件
│   └── friend/
│       └── friend-panel.tsx           # 好友面板（后续改动）
```

---

## Task 1: CSS 变量定义（Light/Dark Mode）

**Files:**
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 添加 Light Mode CSS 变量**

在 `:root` 中添加以下变量：

```css
:root {
  /* Background Colors */
  --sidebar-bg: #f8f9fa;
  --chat-bg: #e8f4f8;
  --card-bg: #ffffff;
  --search-bg: #eef0f2;
  --input-bg: #f8f9fa;

  /* Message Bubbles */
  --msg-in: #ffffff;
  --msg-out: #e6ffde;

  /* Text Colors */
  --text-primary: #000000;
  --text-secondary: #707579;

  /* Brand & Status */
  --brand-primary: #3390ec;
  --brand-hover: #2b7fd4;
  --success: #4caf50;
  --error: #e53935;

  /* File Icons */
  --file-in-icon: #4caf50;
  --file-out-icon: #3390ec;

  /* Borders & Shadows */
  --border: #dfe1e5;
  --shadow-light: #00000014;
  --shadow-medium: #0000001a;

  /* Active State */
  --card-active: #3390ec;
  --fab-bg: #3390ec;
}
```

- [ ] **Step 2: 添加 Dark Mode CSS 变量**

在 `[data-theme="dark"]` 或 `@media (prefers-color-scheme: dark)` 中添加：

```css
[data-theme="dark"] {
  --sidebar-bg: #182533;
  --chat-bg: #202530;
  --card-bg: #2d3748;
  --search-bg: #2d3748;
  --input-bg: #2d3748;

  --msg-in: #2d3748;
  --msg-out: #2d3d2d;

  --text-primary: #ffffff;
  --text-secondary: #a0aec0;

  --brand-primary: #3390ec;
  --brand-hover: #4da3ff;
  --success: #4caf50;
  --error: #e53935;

  --file-in-icon: #4caf50;
  --file-out-icon: #64b5f6;

  --border: #2d3a47;
  --shadow-light: #00000033;
  --shadow-medium: #0000004d;
}
```

- [ ] **Step 3: 验证主题切换**

检查是否有 `data-theme` 属性设置机制，如果没有需要添加到 App 组件

---

## Task 2: 侧边栏布局重构

**Files:**
- Modify: `apps/desktop/src/features/chat/conversation-sidebar.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 简化侧边栏结构**

移除以下元素：
- 发起聊天输入框 (`new-chat-form`)
- 筛选按钮 (`sidebar-filter-row`)
- 会话分组标题
- 导航抽屉 (`nav-drawer`)

保留：
- 搜索框
- 会话列表
- 菜单按钮（保留用于未来扩展）

- [ ] **Step 2: 更新侧边栏 CSS 样式**

```css
.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100vh;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
}

.sidebar-toolbar {
  height: 40px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-search-shell {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--search-bg);
  border-radius: 16px;
  padding: 0 10px;
  height: 32px;
}
```

- [ ] **Step 3: 更新会话卡片样式**

```css
.conversation {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  height: 72px;
  border-radius: 12px;
  background: var(--card-bg);
  box-shadow: 0 0 1px var(--shadow-light);
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.conversation.active {
  background: var(--card-active);
  color: white;
}

.conversation:hover:not(.active) {
  background: var(--search-bg);
}
```

- [ ] **Step 4: 添加头像区分样式**

```css
/* 私聊头像 - 圆形 */
.conversation .avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

/* 群聊头像 - 圆角矩形 */
.conversation.group .avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
```

- [ ] **Step 5: 添加在线状态点**

```css
.conversation .avatar-wrapper {
  position: relative;
}

.conversation .status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background: var(--success);
  border-radius: 50%;
  border: 2px solid var(--card-bg);
}
```

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/src/features/chat/conversation-sidebar.tsx apps/desktop/src/styles.css
git commit -m "refactor(sidebar): simplify layout and add CSS variables"
```

---

## Task 3: FAB 按钮和菜单

**Files:**
- Create: `apps/desktop/src/features/chat/fab-menu.tsx`
- Modify: `apps/desktop/src/features/chat/conversation-sidebar.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 创建 FAB 菜单组件**

```tsx
// apps/desktop/src/features/chat/fab-menu.tsx
type FabMenuProps = {
  onNewGroup: () => void;
  onNewChat: () => void;
};

export function FabMenu(props: FabMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="fab-menu">
      {open && (
        <div className="fab-menu-dropdown">
          <button
            className="fab-menu-item"
            onClick={() => {
              props.onNewGroup();
              setOpen(false);
            }}
          >
            <span className="fab-menu-icon">👥</span>
            <span>新建群聊</span>
          </button>
          <button
            className="fab-menu-item"
            onClick={() => {
              props.onNewChat();
              setOpen(false);
            }}
          >
            <span className="fab-menu-icon">👤</span>
            <span>发起私聊</span>
          </button>
        </div>
      )}
      <button
        className="fab-button"
        onClick={() => setOpen(!open)}
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 添加 FAB CSS 样式**

```css
.fab-menu {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 100;
}

.fab-button {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: var(--fab-bg);
  color: white;
  border: none;
  font-size: 28px;
  cursor: pointer;
  box-shadow: 0 4px 8px var(--shadow-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab-button:hover {
  background: var(--brand-hover);
}

.fab-menu-dropdown {
  position: absolute;
  bottom: 64px;
  right: 0;
  width: 200px;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 4px 12px var(--shadow-medium);
  padding: 8px;
}

.fab-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}

.fab-menu-item:hover {
  background: var(--search-bg);
}

.fab-menu-icon {
  font-size: 20px;
}
```

- [ ] **Step 3: 集成到侧边栏**

在 `conversation-sidebar.tsx` 中导入并使用 FAB 组件

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/fab-menu.tsx apps/desktop/src/styles.css
git commit -m "feat(sidebar): add FAB button with menu"
```

---

## Task 4: 会话卡片长按菜单

**Files:**
- Create: `apps/desktop/src/features/chat/conversation-context-menu.tsx`
- Modify: `apps/desktop/src/features/chat/conversation-sidebar.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 创建会话长按菜单组件**

```tsx
// apps/desktop/src/features/chat/conversation-context-menu.tsx
type ConversationContextMenuProps = {
  x: number;
  y: number;
  conversationId: string;
  isPinned: boolean;
  isMuted: boolean;
  onPin: (id: string) => void;
  onMute: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyId: (id: string) => void;
  onClose: () => void;
};

export function ConversationContextMenu(props: ConversationContextMenuProps): JSX.Element {
  useEffect(() => {
    const handleClick = () => props.onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [props.onClose]);

  return (
    <div
      className="conversation-context-menu"
      style={{ left: props.x, top: props.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={() => props.onPin(props.conversationId)}>
        📌 {props.isPinned ? '取消置顶' : '置顶会话'}
      </button>
      <button onClick={() => props.onMute(props.conversationId)}>
        🔇 {props.isMuted ? '取消静音' : '静音会话'}
      </button>
      <button onClick={() => props.onDelete(props.conversationId)}>
        🗑 删除会话
      </button>
      <button onClick={() => props.onCopyId(props.conversationId)}>
        📋 复制ID
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 添加长按菜单 CSS**

```css
.conversation-context-menu {
  position: fixed;
  background: var(--card-bg);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-medium);
  padding: 8px;
  z-index: 1000;
  min-width: 160px;
}

.conversation-context-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}

.conversation-context-menu button:hover {
  background: var(--search-bg);
}
```

- [ ] **Step 3: 集成到侧边栏**

在 `conversation-sidebar.tsx` 中添加长按事件处理和菜单状态

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/conversation-context-menu.tsx
git commit -m "feat(sidebar): add conversation long-press menu"
```

---

## Task 5: 顶部栏组件

**Files:**
- Create: `apps/desktop/src/features/chat/top-bar.tsx`
- Modify: `apps/desktop/src/features/chat/chat-panel.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 创建顶部栏组件**

```tsx
// apps/desktop/src/features/chat/top-bar.tsx
type TopBarProps = {
  type: 'chat' | 'group';
  avatar: string;
  name: string;
  status?: string;        // 私聊在线状态
  memberCount?: number;    // 群聊成员数
  onSearch: () => void;
  onMore: () => void;
  onVideoCall?: () => void;
  onVoiceCall?: () => void;
};

export function TopBar(props: TopBarProps): JSX.Element {
  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <div className="chat-avatar">
          {props.avatar}
          {props.type === 'chat' && <span className="status-dot" />}
        </div>
        <div className="chat-info">
          <h3>{props.name}</h3>
          <p>
            {props.type === 'chat'
              ? props.status || '在线'
              : `${props.memberCount} 位成员`}
          </p>
        </div>
      </div>
      <div className="chat-header-actions">
        {props.type === 'group' && (
          <>
            <button className="icon-btn disabled" disabled>📹</button>
            <button className="icon-btn disabled" disabled>📞</button>
          </>
        )}
        <button className="icon-btn" onClick={props.onSearch}>🔍</button>
        <button className="icon-btn" onClick={props.onMore}>⋮</button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: 添加顶部栏 CSS**

```css
.chat-header {
  height: 64px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  position: relative;
}

.chat-avatar.group {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.chat-avatar .status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background: var(--success);
  border-radius: 50%;
  border: 2px solid var(--card-bg);
}

.chat-info h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.chat-info p {
  font-size: 12px;
  color: var(--success);
  margin: 0;
}

.chat-header-actions {
  display: flex;
  gap: 16px;
}

.chat-header-actions .icon-btn {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  opacity: 0.7;
}

.chat-header-actions .icon-btn:hover {
  opacity: 1;
}

.chat-header-actions .icon-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

- [ ] **Step 3: 集成到 ChatPanel**

替换当前 ChatPanel 中的顶部栏实现

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/top-bar.tsx
git commit -m "feat(chat): add top bar component"
```

---

## Task 6: 更多菜单（顶部栏下拉）

**Files:**
- Create: `apps/desktop/src/features/chat/chat-more-menu.tsx`
- Modify: `apps/desktop/src/features/chat/chat-panel.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 创建更多菜单组件**

```tsx
// apps/desktop/src/features/chat/chat-more-menu.tsx
type ChatMoreMenuProps = {
  type: 'chat' | 'group';
  burnEnabled: boolean;
  isPinned: boolean;
  isMuted: boolean;
  onToggleBurn: () => void;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onDeleteConversation?: () => void;
  onStartGroupChat?: () => void;   // 私聊
  onExitGroup?: () => void;         // 群聊
  onAddMember?: () => void;          // 群聊
  onClose: () => void;
};

export function ChatMoreMenu(props: ChatMoreMenuProps): JSX.Element {
  return (
    <div className="chat-more-menu">
      <button onClick={props.onToggleBurn}>
        🔥 {props.burnEnabled ? '关闭阅后即焚' : '开启阅后即焚'}
      </button>
      <button onClick={props.onTogglePin}>
        📌 {props.isPinned ? '取消置顶' : '置顶聊天'}
      </button>
      <button onClick={props.onToggleMute}>
        🔇 {props.isMuted ? '取消静音' : '静音'}
      </button>
      {props.type === 'chat' ? (
        <button onClick={props.onStartGroupChat}>
          👥 发起群聊
        </button>
      ) : (
        <>
          <button onClick={props.onAddMember}>👤 添加新成员</button>
          <button onClick={props.onExitGroup} className="danger">🚪 退出群聊</button>
        </>
      )}
      {props.type === 'chat' && (
        <button onClick={props.onDeleteConversation} className="danger">🗑 删除该会话</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 添加菜单 CSS**

```css
.chat-more-menu {
  position: absolute;
  top: 64px;
  right: 20px;
  background: var(--card-bg);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-medium);
  padding: 8px;
  z-index: 100;
  min-width: 180px;
}

.chat-more-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}

.chat-more-menu button:hover {
  background: var(--search-bg);
}

.chat-more-menu button.danger {
  color: var(--error);
}
```

- [ ] **Step 3: 集成到 ChatPanel**

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/chat-more-menu.tsx
git commit -m "feat(chat): add more menu with burn/pin/mute options"
```

---

## Task 7: 消息气泡组件

**Files:**
- Create: `apps/desktop/src/features/chat/message-bubble.tsx`
- Modify: `apps/desktop/src/features/chat/chat-panel.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 创建消息气泡组件**

```tsx
// apps/desktop/src/features/chat/message-bubble.tsx
type MessageBubbleProps = {
  type: 'in' | 'out';
  messageType: 1 | 2 | 3 | 4;  // 1文本 2图片 3语音 4文件
  content: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isBurn?: boolean;
  burnSeconds?: number;
  replyTo?: { sender: string; text: string };
  fileName?: string;
  fileSize?: string;
  voiceDuration?: string;
  onRetry?: () => void;
};

export function MessageBubble(props: MessageBubbleProps): JSX.Element {
  const renderStatus = () => {
    if (props.type === 'in') return null;
    const statusMap = {
      sending: '⏳',
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '❌',
    };
    const className = props.status === 'read' ? 'status-read' : '';
    return <span className={className}>{statusMap[props.status || 'sent']}</span>;
  };

  const renderContent = () => {
    if (props.messageType === 2) {
      return <img src={props.content} alt="图片" className="message-image" />;
    }
    if (props.messageType === 3) {
      return (
        <div className="voice-bubble">
          <span className="play-btn">▶</span>
          <span className="duration">{props.voiceDuration}</span>
        </div>
      );
    }
    if (props.messageType === 4) {
      return (
        <div className="file-bubble">
          <span className="file-icon">📄</span>
          <div>
            <div className="file-name">{props.fileName}</div>
            <div className="file-size">{props.fileSize}</div>
          </div>
        </div>
      );
    }
    return props.content;
  };

  return (
    <div className={`message-bubble ${props.type}`}>
      {props.replyTo && (
        <div className="reply-preview">
          <span className="reply-sender">{props.replyTo.sender}</span>
          <span className="reply-text">{props.replyTo.text}</span>
        </div>
      )}
      <div className="bubble-content">
        {renderContent()}
        {props.isBurn && <span className="burn-indicator">🔥{props.burnSeconds}s</span>}
      </div>
      <div className="bubble-meta">
        {renderStatus()}
        <span className="time">{props.time}</span>
        {props.status === 'failed' && (
          <button className="retry-btn" onClick={props.onRetry}>重试</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加消息气泡 CSS**

```css
.message-bubble {
  display: flex;
  flex-direction: column;
  max-width: 400px;
  padding: 10px 14px;
  border-radius: 8px 18px 18px 18px;
  background: var(--msg-in);
  box-shadow: 0 1px 3px var(--shadow-light);
}

.message-bubble.out {
  align-self: flex-end;
  border-radius: 18px 8px 18px 18px;
  background: var(--msg-out);
  box-shadow: none;
}

.bubble-content {
  font-size: 14px;
  line-height: 1.3;
  color: var(--text-primary);
}

.bubble-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.bubble-meta .status-read {
  color: var(--brand-primary);
}

.burn-indicator {
  color: var(--error);
  margin-left: 4px;
}

.voice-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
}

.voice-bubble .play-btn {
  color: var(--brand-primary);
  font-size: 16px;
}

.file-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 240px;
}

.file-bubble .file-icon {
  font-size: 32px;
  color: var(--file-in-icon);
}

.message-bubble.out .file-bubble .file-icon {
  color: var(--file-out-icon);
}

.file-bubble .file-name {
  font-weight: 500;
  font-size: 14px;
}

.file-bubble .file-size {
  font-size: 12px;
  color: var(--text-secondary);
}

.reply-btn {
  background: none;
  border: none;
  color: var(--error);
  cursor: pointer;
  font-size: 11px;
}
```

- [ ] **Step 3: 集成到 ChatPanel**

替换当前消息渲染逻辑

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/message-bubble.tsx
git commit -m "feat(chat): add message bubble component with styles"
```

---

## Task 8: 消息右键菜单

**Files:**
- Create: `apps/desktop/src/features/chat/message-context-menu.tsx`
- Modify: `apps/desktop/src/features/chat/chat-panel.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 创建消息右键菜单组件**

```tsx
// apps/desktop/src/features/chat/message-context-menu.tsx
type MessageContextMenuProps = {
  x: number;
  y: number;
  messageType: 1 | 2 | 3 | 4;
  isOwn: boolean;
  onCopy: () => void;
  onReply: () => void;
  onForward: () => void;
  onDownload?: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function MessageContextMenu(props: MessageContextMenuProps): JSX.Element {
  const menuItems = [
    { label: '复制', icon: '📋', action: props.onCopy },
    { label: '引用', icon: '↩️', action: props.onReply },
    { label: '转发', icon: '↗️', action: props.onForward },
  ];

  if ([2, 4].includes(props.messageType)) {
    menuItems.push({ label: '下载', icon: '⬇️', action: props.onDownload! });
  }

  if (props.isOwn) {
    menuItems.push({ label: '删除', icon: '🗑', action: props.onDelete, danger: true });
  }

  return (
    <div
      className="message-context-menu"
      style={{ left: props.x, top: props.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          className={item.danger ? 'danger' : ''}
          onClick={() => {
            item.action();
            props.onClose();
          }}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 添加右键菜单 CSS**

```css
.message-context-menu {
  position: fixed;
  background: var(--card-bg);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-medium);
  padding: 8px;
  z-index: 1000;
  min-width: 160px;
}

.message-context-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}

.message-context-menu button:hover {
  background: var(--search-bg);
}

.message-context-menu button.danger {
  color: var(--error);
}
```

- [ ] **Step 3: 集成到 ChatPanel**

实现右键菜单的显示位置逻辑（根据消息方向决定在左侧还是右侧）

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/message-context-menu.tsx
git commit -m "feat(chat): add message context menu"
```

---

## Task 9: 底部输入区重构

**Files:**
- Modify: `apps/desktop/src/features/chat/chat-panel.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 简化底部输入区**

移除：
- 高级选项展开区
- 消息类型下拉

保留/修改：
- 输入框 + 发送按钮（输入框内）
- 附件按钮 → 文件消息
- 表情按钮 → 打开表情选择器
- 麦克风按钮 → 语音消息

- [ ] **Step 2: 更新输入区 CSS**

```css
.composer-area {
  background: var(--card-bg);
  border-top: 1px solid var(--border);
  padding: 14px 20px;
}

.composer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.composer-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border-radius: 22px;
  padding: 0 16px;
  height: 44px;
}

.composer-input-wrapper input {
  flex: 1;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}

.composer-input-wrapper input::placeholder {
  color: var(--text-secondary);
}

.composer-input-wrapper .send-btn {
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
}

.composer-tool-btn {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.7;
  font-size: 20px;
}

.composer-tool-btn:hover {
  opacity: 1;
}
```

- [ ] **Step 3: 提交**

```bash
git commit -m "refactor(chat): simplify composer area"
```

---

## Task 10: 表情选择器

**Files:**
- Create: `apps/desktop/src/features/chat/emoji-picker.tsx`
- Modify: `apps/desktop/src/features/chat/chat-panel.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 安装 emoji-mart**

```bash
pnpm add @emoji-mart/react @emoji-mart/data
```

- [ ] **Step 2: 创建表情选择器组件**

```tsx
// apps/desktop/src/features/chat/emoji-picker.tsx
import data from '@emoji-mart/data';
import { Picker } from '@emoji-mart/react';

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function EmojiPicker(props: EmojiPickerProps): JSX.Element {
  return (
    <div className="emoji-picker-container">
      <Picker
        data={data}
        onEmojiSelect={(emoji: { native: string }) => {
          props.onSelect(emoji.native);
        }}
        theme="light"
        previewPosition="none"
        skinTonePosition="preview"
      />
    </div>
  );
}
```

- [ ] **Step 3: 添加表情选择器 CSS**

```css
.emoji-picker-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 4px 20px var(--shadow-medium);
  overflow: hidden;
}

.emoji-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 4: 集成到 ChatPanel**

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/features/chat/emoji-picker.tsx
git commit -m "feat(chat): add emoji picker with emoji-mart"
```

---

## Task 11: 空状态和加载机制

**Files:**
- Modify: `apps/desktop/src/features/chat/chat-panel.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 添加空状态**

```tsx
// 无会话选中时
<div className="chat-empty">
  <p>请选择一个会话开始聊天</p>
</div>

// 已选会话但无消息
<div className="chat-empty">
  <p>暂无聊天消息</p>
</div>
```

- [ ] **Step 2: 添加加载状态**

```tsx
// 加载历史消息时
<div className="history-loader">
  <span className="spinner" />
</div>

// 加载完毕
<div className="history-end">
  <span>没有更早消息了</span>
</div>
```

- [ ] **Step 3: 更新 CSS**

```css
.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 14px;
  padding-top: 20px;
}

.history-loader {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.history-end {
  text-align: center;
  padding: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 4: 提交**

```bash
git commit -m "feat(chat): add empty states and loading indicators"
```

---

## Task 12: 桌面端自适应

**Files:**
- Modify: `apps/desktop/src/styles.css`
- Check: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: 添加响应式布局 CSS**

```css
/* 整体布局 */
.chat-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.telegram-desktop {
  display: flex;
  width: 100%;
}

/* 聊天面板自适应 */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;  /* 允许flex子元素收缩 */
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* 气泡最大宽度 */
.message-bubble {
  max-width: 400px;
}

.message-bubble .voice-bubble {
  max-width: 180px;
}

.message-bubble .file-bubble {
  max-width: 240px;
}
```

- [ ] **Step 2: 配置 Tauri 窗口最小尺寸**

检查 `apps/desktop/src-tauri/tauri.conf.json`:

```json
{
  "app": {
    "windows": [
      {
        "minWidth": 800,
        "minHeight": 600
      }
    ]
  }
}
```

- [ ] **Step 3: 提交**

```bash
git commit -m "feat(layout): add responsive design and window constraints"
```

---

## Task 13: 最终验证和调整

- [ ] **Step 1: 运行开发服务器验证**

```bash
pnpm start:desktop
```

- [ ] **Step 2: 检查所有 CSS 变量是否正确应用**
- [ ] **Step 3: 测试 Light/Dark Mode 切换**
- [ ] **Step 4: 测试窗口缩放到最小尺寸**
- [ ] **Step 5: 测试所有交互功能**
- [ ] **Step 6: 提交所有更改**

```bash
git add -A
git commit -m "feat: complete chat UI redesign implementation"
```

---

## 依赖清单

```json
{
  "@emoji-mart/react": "^5.x",
  "@emoji-mart/data": "^5.x"
}
```

---

## 验证命令

```bash
pnpm start:desktop  # 启动开发服务器
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-06-chat-ui-redesign.md`**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
