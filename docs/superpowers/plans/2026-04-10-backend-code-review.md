# 后端代码 Code Review 计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对后端代码进行全面 review，从单个模块功能 review 到模块间串联 review，判断整个逻辑闭环和业务自洽性

**Architecture:** 采用分阶段 review 策略：第一阶段逐个模块 review 功能完整性；第二阶段进行模块间串联 review 验证整体业务逻辑

**Review 模块清单:**
1. auth - 认证模块
2. user - 用户模块
3. conversation - 会话模块
4. message - 消息模块
5. friend - 好友模块
6. group - 群组模块
7. burn - 阅后即焚模块
8. media - 媒体模块
9. mail - 邮件模块
10. notification - 通知模块
11. security - 安全模块
12. identity - 身份模块
13. metrics - 指标模块

---

## 第一阶段：单模块功能 Review

### 模块 Review 检查清单（每个模块适用）

对于每个模块，需要检查：

1. **接口完整性**: DTO 定义、验证规则、API 路径规范
2. **业务逻辑**: 核心功能实现、边界条件处理、错误处理
3. **数据层**: Entity 定义、ORM 映射、事务处理
4. **安全性**: 权限校验、认证检查、输入校验
5. **可测试性**: 业务逻辑与基础设施分离、依赖注入
6. **代码质量**: 命名规范、无硬编码、异常处理

---

### Review Task 1: auth 模块

**Files:**
- `apps/backend/src/modules/auth/auth.module.ts`
- `apps/backend/src/modules/auth/auth.controller.ts`
- `apps/backend/src/modules/auth/auth.service.ts`
- `apps/backend/src/modules/auth/dto/*.ts`
- `apps/backend/src/modules/auth/strategies/*.ts`
- `apps/backend/src/modules/auth/guards/*.ts`

**Review 要点:**
- [ ] 登录接口 (account/password) 是否正确
- [ ] Token 生成与刷新逻辑
- [ ] Refresh Token 轮换机制
- [ ] 密码加密与验证
- [ ] JWT 配置 (expiresIn, secret)
- [ ] 登录失败锁定机制
- [ ] 单点登录冲突处理

---

### Review Task 2: user 模块

**Files:**
- `apps/backend/src/modules/user/user.module.ts`
- `apps/backend/src/modules/user/user.controller.ts`
- `apps/backend/src/modules/user/user.service.ts`
- `apps/backend/src/modules/user/entities/*.ts`
- `apps/backend/src/modules/user/dto/*.ts`

**Review 要点:**
- [ ] 用户注册流程
- [ ] 用户信息更新
- [ ] 设备注册与 Signal Key 管理
- [ ] 用户搜索与发现
- [ ] 用户状态 (在线/离线) 管理

---

### Review Task 3: conversation 模块

**Files:**
- `apps/backend/src/modules/conversation/conversation.module.ts`
- `apps/backend/src/modules/conversation/conversation.controller.ts`
- `apps/backend/src/modules/conversation/conversation.service.ts`
- `apps/backend/src/modules/conversation/entities/*.ts`
- `apps/backend/src/modules/conversation/dto/*.ts`

**Review 要点:**
- [ ] 单聊会话创建逻辑
- [ ] 会话列表查询
- [ ] 会话未读数管理
- [ ] 会话置顶/免打扰
- [ ] 会话最后消息更新机制

---

### Review Task 4: message 模块

**Files:**
- `apps/backend/src/modules/message/message.module.ts`
- `apps/backend/src/modules/message/message.controller.ts`
- `apps/backend/src/modules/message/message.service.ts`
- `apps/backend/src/modules/message/entities/*.ts`
- `apps/backend/src/modules/message/dto/*.ts`

**Review 要点:**
- [ ] 消息发送流程 (创建 → 存储 → 推送)
- [ ] 消息类型支持 (文本/图片/文件/语音/视频)
- [ ] 消息状态 (发送中/已发送/已读)
- [ ] 消息 ACK 机制
- [ ] 离线消息同步
- [ ] 消息分页加载

---

### Review Task 5: friend 模块

**Files:**
- `apps/backend/src/modules/friend/friend.module.ts`
- `apps/backend/src/modules/friend/friend.controller.ts`
- `apps/backend/src/modules/friend/friend.service.ts`
- `apps/backend/src/modules/friend/entities/*.ts`
- `apps/backend/src/modules/friend/dto/*.ts`

**Review 要点:**
- [ ] 好友请求发送与接收
- [ ] 好友请求接受/拒绝
- [ ] 好友列表管理
- [ ] 黑名单/屏蔽功能
- [ ] 好友状态变更通知

---

### Review Task 6: group 模块

**Files:**
- `apps/backend/src/modules/group/group.module.ts`
- `apps/backend/src/modules/group/group.controller.ts`
- `apps/backend/src/modules/group/group.service.ts`
- `apps/backend/src/modules/group/entities/*.ts`
- `apps/backend/src/modules/group/dto/*.ts`

**Review 要点:**
- [ ] 群创建与解散
- [ ] 群成员管理 (邀请/移除/退出)
- [ ] 群管理员权限
- [ ] 群消息发送与存储
- [ ] Sender Key 分发

---

### Review Task 7: burn 模块

**Files:**
- `apps/backend/src/modules/burn/burn.module.ts`
- `apps/backend/src/modules/burn/burn.controller.ts`
- `apps/backend/src/modules/burn/burn.service.ts`
- `apps/backend/src/modules/burn/entities/*.ts`
- `apps/backend/src/modules/burn/dto/*.ts`

**Review 要点:**
- [ ] 阅后即焚消息创建
- [ ] 焚毁计时器逻辑
- [ ] 消息访问记录
- [ ] 截图/转发防护机制
- [ ] 焚毁后数据清理

---

### Review Task 8: media 模块

**Files:**
- `apps/backend/src/modules/media/media.module.ts`
- `apps/backend/src/modules/media/media.controller.ts`
- `apps/backend/src/modules/media/media.service.ts`
- `apps/backend/src/modules/media/entities/*.ts`
- `apps/backend/src/modules/media/dto/*.ts`

**Review 要点:**
- [ ] 文件上传流程 (大小限制、类型校验)
- [ ] MinIO 存储集成
- [ ] 文件下载与访问控制
- [ ] 缩略图生成
- [ ] 文件清理机制

---

### Review Task 9: mail 模块

**Files:**
- `apps/backend/src/modules/mail/mail.module.ts`
- `apps/backend/src/modules/mail/mail.controller.ts`
- `apps/backend/src/modules/mail/mail.service.ts`
- `apps/backend/src/modules/mail/dto/*.ts`

**Review 要点:**
- [ ] 邮件发送服务
- [ ] 邮件模板
- [ ] 验证码/链接生成
- [ ] 邮件发送失败重试

---

### Review Task 10: notification 模块

**Files:**
- `apps/backend/src/modules/notification/notification.module.ts`
- `apps/backend/src/modules/notification/notification.controller.ts`
- `apps/backend/src/modules/notification/notification.service.ts`
- `apps/backend/src/modules/notification/entities/*.ts`
- `apps/backend/src/modules/notification/dto/*.ts`

**Review 要点:**
- [ ] 通知推送机制
- [ ] 通知类型 (消息/好友/系统)
- [ ] 免打扰设置
- [ ] 通知已读状态

---

### Review Task 11: security 模块

**Files:**
- `apps/backend/src/modules/security/security.module.ts`
- `apps/backend/src/modules/security/security.controller.ts`
- `apps/backend/src/modules/security/security.service.ts`
- `apps/backend/src/modules/security/dto/*.ts`

**Review 要点:**
- [ ] 加密策略
- [ ] 安全审计日志
- [ ] 异常行为检测

---

### Review Task 12: identity 模块

**Files:**
- `apps/backend/src/modules/identity/identity.module.ts`
- `apps/backend/src/modules/identity/identity.controller.ts`
- `apps/backend/src/modules/identity/identity.service.ts`
- `apps/backend/src/modules/identity/entities/*.ts`
- `apps/backend/src/modules/identity/dto/*.ts`

**Review 要点:**
- [ ] 身份验证流程
- [ ] 设备指纹
- [ ] 身份绑定与解绑

---

### Review Task 13: metrics 模块

**Files:**
- `apps/backend/src/modules/metrics/metrics.module.ts`
- `apps/backend/src/modules/metrics/metrics.controller.ts`
- `apps/backend/src/modules/metrics/metrics.service.ts`

**Review 要点:**
- [ ] 统计数据收集
- [ ] API 性能指标
- [ ] 使用趋势分析

---

## 第二阶段：模块间串联 Review

### Review Task 14: 核心业务流程串联

**Review 要点:**
- [ ] **注册 → 登录 → Token 刷新** 流程完整性
- [ ] **发送消息流程**: message → conversation → notification → socket 推送
- [ ] **好友请求流程**: friend → user → notification
- [ ] **群聊流程**: group → message → conversation_member → sender_key
- [ ] **阅后即焚流程**: burn → message → timer → cleanup

---

### Review Task 15: 业务逻辑闭环验证

**Review 要点:**
- [ ] **会话一致性**: 任何消息发送都能创建/更新会话
- [ ] **状态同步**: 消息状态变更正确同步到所有相关方
- [ ] **权限闭环**: 每个操作都有权限校验
- [ ] **数据一致性**: 数据库事务正确使用
- [ ] **错误处理**: 异常情况不会导致数据不一致

---

### Review Task 16: WebSocket 与 HTTP 一致性

**Review 要点:**
- [ ] 消息通过 HTTP 和 WebSocket 发送结果一致
- [ ] 状态变更 (在线/离线) 通过两种方式同步
- [ ] 心跳机制正确

---

### Review Task 17: 安全与隐私

**Review 要点:**
- [ ] 端到端加密密钥管理 (libsignal)
- [ ] 消息存储加密
- [ ] 隐私保护 (阅后即焚、黑名单)
- [ ] 审计日志完整

---

### Review Task 18: 整体架构评估

**Review 要点:**
- [ ] 模块边界清晰度
- [ ] 依赖方向正确 (无循环依赖)
- [ ] 可扩展性设计
- [ ] 性能考量 (缓存、索引、查询优化)

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

**下一步:** 选择执行方式后开始 Review
