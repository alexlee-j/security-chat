# 设计稿合规修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复当前实现与设计稿的差异，确保界面完全符合设计规范

**Architecture:** 基于现有组件进行修复，严格按照设计稿规格

**Tech Stack:** React + TypeScript + CSS + Material Symbols Rounded

---

## 问题清单

### 1. FAB 按钮
| 问题 | 设计稿规范 | 当前实现 |
|------|----------|---------|
| 图标 | Material Symbols Rounded "add" (白色, 28px) | `+` 字符 |
| 尺寸 | 56×56px, 圆角 28px | 56×56px ✅ |
| 位置 | 右侧 72px, 底部 72px (sidebar 内) | bottom: 16px, right: 16px |
| 阴影 | blur:8, offset:0,4, #00000033 | 已正确实现 |

### 2. FAB 菜单
| 问题 | 设计稿规范 | 当前实现 |
|------|----------|---------|
| 菜单项1 | "新建群聊" + group_add 图标 | ✅ 正确 |
| 菜单项2 | "发起私聊" + person_add 图标 | 当前是"添加好友" |
| 宽度 | 200px | ✅ 正确 |
| 内边距 | 8px | ✅ 正确 |

### 3. 消息气泡
| 属性 | 设计稿规范 | 当前实现 |
|------|----------|---------|
| 收到圆角 | [8, 18, 18, 18] | ✅ 正确 |
| 发出圆角 | [18, 8, 18, 18] | ✅ 正确 |
| 收到背景 | --msg-in (#ffffff) | ✅ 正确 |
| 发出背景 | --msg-out (#e6ffde) | ✅ 正确 |
| 收到阴影 | blur:3px, offset:0,1px | 当前是 blur:1px 3px |
| 发出阴影 | 无 | ✅ 正确 |
| 文本色 | --text-primary | ✅ 正确 |
| 时间色 | --text-secondary | ✅ 正确 |
| 最大宽度 | 400px (文本), 240px (文件), 180px (语音) | ✅ 正确 |

---

## Task 1: FAB 按钮修复

**Files:**
- Modify: `apps/desktop/src/features/chat/fab-menu.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 更新 FAB 图标**

将 FAB 按钮的 `+` 字符替换为 Material Symbols Rounded "add" 图标

```tsx
<button
  className="fab-button"
  aria-expanded={open}
  aria-haspopup="menu"
  aria-label="打开操作菜单"
  onClick={() => setOpen(!open)}
>
  <span className="fab-icon material-symbols-rounded">add</span>
</button>
```

- [ ] **Step 2: 添加 FAB 图标 CSS**

```css
.fab-icon {
  font-family: 'Material Symbols Rounded';
  font-size: 28px;
  font-weight: normal;
  font-style: normal;
  color: white;
}
```

- [ ] **Step 3: 修正 FAB 位置**

设计稿中 FAB 在 sidebar 内右下角，right: 72px, bottom: 72px

```css
.fab-menu {
  position: fixed;
  bottom: 72px;
  right: 72px;
  z-index: 100;
}
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/fab-menu.tsx apps/desktop/src/styles.css
git commit -m "fix(FAB): 使用 Material Symbols Rounded add 图标，修正位置"
```

---

## Task 2: FAB 菜单文字修复

**Files:**
- Modify: `apps/desktop/src/features/chat/fab-menu.tsx`

- [ ] **Step 1: 修正菜单文字**

将"添加好友"改为"发起私聊"

```tsx
<button
  className="fab-menu-item"
  role="menuitem"
  aria-label="发起私聊"
  onClick={() => {
    props.onNewChat();
    setOpen(false);
  }}
>
  <span className="fab-menu-icon material-symbols-rounded">person_add</span>
  <span>发起私聊</span>
</button>
```

- [ ] **Step 2: 更新菜单图标**

将 emoji 👤 替换为 Material Symbols Rounded "person_add"

```tsx
<span className="fab-menu-icon material-symbols-rounded">person_add</span>
```

同样更新 group_add 图标：

```tsx
<span className="fab-menu-icon material-symbols-rounded">group_add</span>
```

- [ ] **Step 3: 添加 Material Symbols 图标样式**

```css
.fab-menu-icon {
  font-family: 'Material Symbols Rounded';
  font-size: 20px;
  font-weight: normal;
  font-style: normal;
}
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/features/chat/fab-menu.tsx apps/desktop/src/styles.css
git commit -m "fix(FAB): 使用 Material Symbols Rounded 图标，修正菜单文字"
```

---

## Task 3: 消息气泡阴影修正

**Files:**
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: 修正收到消息阴影**

设计稿: blur:3px, offset:0,1px
当前: blur:1px 3px

```css
.message-bubble {
  display: flex;
  flex-direction: column;
  max-width: 400px;
  padding: 10px 14px;
  border-radius: 8px 18px 18px 18px;
  background: var(--msg-in);
  box-shadow: 0 1px 3px var(--shadow-light);  /* 修正：0 1px 3px */
}
```

- [ ] **Step 2: 提交**

```bash
git commit -m "fix(message-bubble): 修正收到消息阴影样式"
```

---

## Task 4: 整体验证

- [ ] **Step 1: 启动开发服务器验证**

```bash
pnpm run tauri:dev
```

- [ ] **Step 2: 对比设计稿检查**

检查以下内容是否符合设计稿：
- [ ] FAB 按钮图标是否为 Material Symbols "add"
- [ ] FAB 菜单位置是否在 sidebar 右下角
- [ ] FAB 菜单项文字是否为"新建群聊"和"发起私聊"
- [ ] 消息气泡圆角是否为 [8,18,18,18] 和 [18,8,18,18]
- [ ] 消息气泡阴影是否正确

- [ ] **Step 3: 提交验证结果**

```bash
git add -A
git commit -m "fix: 完成设计稿合规修复"
```

---

## 验证命令

```bash
pnpm run tauri:dev  # 启动开发服务器
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-06-design-compliance-fix.md`**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?