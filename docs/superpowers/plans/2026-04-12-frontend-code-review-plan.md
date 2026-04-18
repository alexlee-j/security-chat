# 前端代码 Code Review 计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对前端代码进行全面 review，从单个模块 review 到模块间串联 review，判断整个逻辑闭环和业务自洽性

**Architecture:** 采用分阶段 review 策略：第一阶段逐个模块 review 功能完整性；第二阶段进行模块间串联 review 验证整体业务逻辑

**Tech Stack:** React 18, TypeScript, Socket.IO Client, shadcn/ui, Tailwind CSS

---

## 前端模块清单

### 第一部分：核心模块 (Core)

| # | 模块 | 文件 | 主要职责 |
|---|------|------|---------|
| 1 | use-chat-client | `core/use-chat-client.ts` | 核心状态管理、WebSocket 连接、消息收发 |
| 2 | use-signal | `core/use-signal.ts` | Signal 协议实现、密钥管理 |
| 3 | api | `core/api.ts` | API 调用封装 |
| 4 | crypto | `core/crypto.ts` | 加密工具函数 |
| 5 | secure-storage | `core/secure-storage.ts` | 安全存储 |
| 6 | auth-storage | `core/auth-storage.ts` | 认证数据存储 |

### 第二部分：功能模块 (Features)

| # | 模块 | 主要文件 | 主要职责 |
|---|------|---------|---------|
| 7 | auth | `features/auth/*` | 用户登录、注册、验证码 |
| 8 | chat | `features/chat/*` | 聊天界面、会话管理、消息显示 |
| 9 | friend | `features/friend/friend-panel.tsx` | 好友管理 |

### 第三部分：串联 Review

| # | Review 类型 | 描述 |
|---|-------------|------|
| 10 | 模块间串联 | 验证模块间数据流和事件流 |
| 11 | 业务逻辑闭环 | 验证核心业务流程完整性 |
| 12 | 安全检查 | E2E 加密、会话安全 |

---

## 第一阶段：单模块功能 Review

### 模块 Review 检查清单（每个模块适用）

对于每个模块，需要检查：

1. **接口完整性**: 类型定义、API 签名、回调处理
2. **业务逻辑**: 核心功能实现、边界条件、错误处理
3. **状态管理**: React 状态、副作用、内存泄漏
4. **安全性**: 敏感数据处理、加密实现、存储安全
5. **用户体验**: 加载状态、错误提示、交互反馈

---

## Task 1: use-chat-client 模块 Review

**Files:**
- `apps/desktop/src/core/use-chat-client.ts`

**Review 要点:**
- [ ] WebSocket 连接管理 (connect/disconnect/reconnect)
- [ ] 消息发送和接收流程
- [ ] 会话状态管理 (conversations, messages)
- [ ] 好友状态管理
- [ ] 错误处理和重试机制
- [ ] 内存泄漏风险 (useEffect cleanup)

---

## Task 2: use-signal 模块 Review

**Files:**
- `apps/desktop/src/core/use-signal.ts`
- `apps/desktop/src/core/signal/*`

**Review 要点:**
- [ ] Signal 协议初始化
- [ ] 密钥生成和存储
- [ ] 消息加密/解密流程
- [ ] PreKey 管理
- [ ] 会话建立流程

---

## Task 3: api 模块 Review

**Files:**
- `apps/desktop/src/core/api.ts`

**Review 要点:**
- [ ] API 请求/响应类型定义
- [ ] 错误处理机制
- [ ] Token 管理
- [ ] 请求重试逻辑

---

## Task 4: crypto 模块 Review

**Files:**
- `apps/desktop/src/core/crypto.ts`

**Review 要点:**
- [ ] 加密算法选择
- [ ] 密钥处理
- [ ] 随机数生成

---

## Task 5: secure-storage 模块 Review

**Files:**
- `apps/desktop/src/core/secure-storage.ts`

**Review 要点:**
- [ ] 数据加密方式
- [ ] 密钥管理
- [ ] 存储安全

---

## Task 6: auth-storage 模块 Review

**Files:**
- `apps/desktop/src/core/auth-storage.ts`

**Review 要点:**
- [ ] 凭证存储方式
- [ ] 自动登录逻辑
- [ ] 登出清理

---

## Task 7: auth 模块 Review

**Files:**
- `apps/desktop/src/features/auth/*`

**Review 要点:**
- [ ] 登录流程 (account/password)
- [ ] 验证码登录流程
- [ ] 注册流程
- [ ] 密码重置流程
- [ ] 表单验证

---

## Task 8: chat 模块 Review

**Files:**
- `apps/desktop/src/features/chat/*`

**Review 要点:**
- [ ] ChatPanel 聊天主界面
- [ ] ConversationSidebar 会话列表
- [ ] MessageBubble 消息显示
- [ ] 消息发送/接收
- [ ] 阅后即焚触发
- [ ] 消息上下文菜单

---

## Task 9: friend 模块 Review

**Files:**
- `apps/desktop/src/features/friend/friend-panel.tsx`

**Review 要点:**
- [ ] 好友列表展示
- [ ] 好友请求处理
- [ ] 搜索用户
- [ ] 好友状态同步

---

## 第二阶段：模块间串联 Review

### Task 10: 模块间数据流 Review

**Review 要点:**
- [ ] App → ChatPanel → use-chat-client 数据流
- [ ] App → FriendPanel → use-chat-client 数据流
- [ ] WebSocket 事件 → 状态更新 → UI 渲染
- [ ] API 调用 → 状态更新 → 本地存储

---

### Task 11: 业务逻辑闭环 Review

**Review 要点:**
- [ ] **登录流程**: 登录 → Token 存储 → 自动登录 → 登出
- [ ] **发送消息流程**: 消息输入 → 加密 → 发送 → 确认 → 显示
- [ ] **接收消息流程**: WebSocket → 解密 → 存储 → 显示
- [ ] **阅后即焚流程**: 触发 → 服务器确认 → 双方删除
- [ ] **好友请求流程**: 搜索 → 发送请求 → 接受/拒绝 → 好友列表更新

---

### Task 12: 安全检查 Review

**Review 要点:**
- [ ] E2E 加密完整性 (Signal Protocol)
- [ ] 敏感数据存储安全
- [ ] WebSocket 安全 (JWT 验证)
- [ ] API 请求安全

---

## 输出文档

Review 完成后，输出以下文档：

1. **模块 review 报告**: 每个模块的发现与建议
2. **串联 review 报告**: 业务流程验证结果
3. **问题汇总**: 需修复的问题列表 (按优先级)
4. **改进建议**: 架构与代码质量优化方向

---

## 执行方式选择

**1. Subagent-Driven (推荐)** - 每个模块由独立 subagent review，reviewer 汇总结果

**2. Inline Execution** - 在当前 session 中逐个模块 review

---

## 下一步

选择执行方式后开始 Review
