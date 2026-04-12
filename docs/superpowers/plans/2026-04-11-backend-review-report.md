# 后端代码 Review 问题详细报告

> **生成时间**: 2026-04-11
> **审查范围**: apps/backend/src/modules/

---

## 一、严重问题 (P0) - 必须立即修复

### 1. WebSocket 消息发送未持久化

**影响范围**: message 模块
**严重程度**: 🔴 严重

**问题描述**:
```typescript
// apps/backend/src/modules/message/gateways/message.gateway.ts:190-233
@SubscribeMessage('message.send')
async handleSendMessage(...) {
  // 问题：直接转发给接收者，不存储到数据库！
  this.server.to(recipientRoom).emit('message.received', {...});
  client.emit('message.sent', {...});
}
```

**影响**:
- 用户通过 WebSocket 发送的消息不会存入数据库
- 断线重连后无法通过 REST API 获取历史消息
- 与 HTTP 发送路径不一致，导致数据丢失

**根本原因**: WebSocket handler 绕过了 `MessageService.sendMessage()` 直接转发消息

---

### 2. JWT 默认密钥太弱

**影响范围**: auth 模块
**严重程度**: 🔴 严重

**问题描述**:
```typescript
// apps/backend/src/modules/auth/auth.module.ts:21
secret: configService.get<string>('JWT_SECRET', 'dev_secret_change_me'),
```

**影响**:
- 生产环境使用默认密钥，攻击者可伪造任意用户 Token
- 所有 JWT 验证形同虚设

**根本原因**: 开发默认值硬编码在代码中，未强制要求配置环境变量

---

### 3. media 模块 MinIO 未实现

**影响范围**: media 模块
**严重程度**: 🔴 严重

**问题描述**:
```typescript
// apps/backend/src/modules/media/media.service.ts:35-36
this.mediaRoot = this.configService.get<string>('MEDIA_ROOT', '/tmp/security-chat-media');
// 整个模块使用本地文件系统存储，而非 MinIO
```

**影响**:
- 容器化部署后文件丢失（容器重启/重建）
- 无法实现多实例共享存储
- 不符合项目架构设计（文档声明使用 MinIO）

**根本原因**: 使用本地文件系统代替了声明的 MinIO 存储

---

### 4. notification 免打扰功能缺失

**影响范围**: notification 模块
**严重程度**: 🔴 严重

**问题描述**:
- 模块中完全没有 Do Not Disturb (DND) 功能
- 用户无法设置免打扰时间段
- 无法按通知类型设置免打扰

**影响**:
- 用户在休息时间仍会收到通知推送
- 无法实现"仅好友消息"等细粒度控制

**根本原因**: 功能设计阶段遗漏了该需求

---

### 5. metrics 端点无认证保护

**影响范围**: metrics 模块
**严重程度**: 🔴 严重

**问题描述**:
```typescript
// apps/backend/src/modules/metrics/metrics.controller.ts
@Controller('metrics')
// 没有 @UseGuards(JwtAuthGuard)
```

**影响**:
- 攻击者可获取系统内部指标
- 泄露用户量、消息量、在线设备数等商业敏感信息
- 可用于针对性攻击

**根本原因**: 开发阶段认为仅内部使用，忽略了安全设计

---

### 6. triggerBurn 权限校验不完整

**影响范围**: burn 模块
**严重程度**: 🔴 严重

**问题描述**:
```typescript
// apps/backend/src/modules/burn/burn.service.ts:44
await this.conversationService.assertMember(message.conversationId, userId);
// 问题：只检查是会话成员，未校验是否是消息接收者
```

**影响**:
- 任何会话成员都能触发阅后即焚
- 发送者可在接收者阅读前强制焚毁消息
- 破坏阅后即焚的核心语义

**根本原因**: 权限校验逻辑不完整

---

## 二、高优先级问题 (P1)

### 1. 好友请求后无实时通知

**影响范围**: friend 模块
**严重程度**: 🟠 高

**问题描述**: `FriendService.sendRequest()` 成功后未调用 `NotificationService`

**影响**: 对方无法实时收到好友请求通知

**根本原因**: friend 模块未导入 notification 模块

---

### 2. 群组与 Conversation 分离

**影响范围**: group 模块
**严重程度**: 🟠 高

**问题描述**:
- `GroupService.create()` 只创建 Group 记录
- 不会自动创建 Conversation
- 需要手动调用 `ConversationService.createGroupConversation()`

**影响**:
- 创建群组后无法发送消息
- 需要两端配合容易遗漏

**根本原因**: 设计时将"群组业务"和"群聊通信"分离，但未建立关联机制

---

### 3. identity 模块 DTO 无验证

**影响范围**: identity 模块
**严重程度**: 🟠 高

**问题描述**:
```typescript
// apps/backend/src/modules/identity/identity.service.ts:9-17
export interface RegisterIdentityDto {
  // 问题：interface 无法使用 class-validator
}
```

**影响**:
- 攻击者可提交格式错误的数据
- 可能导致数据库约束异常

**根本原因**: 使用 interface 代替 class，导致无法使用装饰器验证

---

### 4. BurnCronService 和 MessageService 重复处理

**影响范围**: burn 模块, message 模块
**严重程度**: 🟠 高

**问题描述**:
- `BurnCronService.processBurnMessages()` 每分钟执行
- `MessageService.sweepExpiredBurnMessages()` 每秒执行
- 两个定时任务可能同时处理同一消息

**影响**:
- 重复删除导致异常
- 浪费计算资源

**根本原因**: 定时任务职责分散

---

### 5. 缺少操作审计日志

**影响范围**: 整体
**严重程度**: 🟠 高

**问题描述**: 敏感操作（登录、删除会话、权限变更）未记录审计日志

**影响**:
- 安全事件无法追溯
- 合规性不满足

**根本原因**: 未设计审计日志模块

---

## 三、中优先级问题 (P2)

### 1. conversation 模块 groups 表查询问题

**位置**: `conversation.service.ts:396-415`
```typescript
const groupResult = await this.dataSource.query(
  `SELECT name FROM "groups" WHERE conversation_id = $1`,
);
```

**问题**: `groups` 表在 Entity 中不存在定义

---

### 2. media 模块文件类型验证缺失

**位置**: `media.service.ts:63-70`

**问题**: 未校验文件 magic bytes，仅依赖 MIME type

---

### 3. mail 模块 SMTP 连接验证时机不当

**位置**: `mail.service.ts:36-47`

**问题**: 构造函数中异步调用未等待

---

### 4. notification friend_request 类型未实现

**位置**: friend 模块

**问题**: 类型定义了但无任何模块创建该通知

---

### 5. security 模块 Redis 操作非原子

**位置**: `security.service.ts:44-47`

**问题**: `incr` 和 `expire` 不是原子操作

---

## 四、低优先级问题 (P3)

| 问题 | 模块 | 描述 |
|------|------|------|
| 魔法数字未提取常量 | 多个模块 | 如 `status: 0/1/2` 应使用枚举 |
| API 路径不符合 RESTful | group, notification | 如 `@Controller('group')` 应为 `@Controller('groups')` |
| 未使用 ApiEnvelope 格式 | notification, media | 部分接口直接返回原始数据 |
| console.warn/error 代替 Logger | conversation | 应使用统一日志服务 |

---

## 五、问题根因分析

### 1. 安全意识不足
- JWT 默认密钥
- metrics 端点无认证
- DTO 缺少验证
- 权限校验不完整

### 2. 模块设计不完整
- notification 免打扰功能遗漏
- friend 通知机制遗漏
- 群组与会话关联机制遗漏

### 3. 架构实现偏差
- media 模块使用本地文件系统代替 MinIO
- WebSocket handler 绕过持久化层
- Burn 定时任务分散

### 4. 代码质量不一致
- 部分模块用 interface + 无验证
- 部分模块用 class + 完整验证
- 日志、错误处理方式不统一

---

## 六、修复优先级建议

### 立即修复 (1-2天内)
1. WebSocket 消息持久化 - 防止数据丢失
2. JWT 密钥强制配置 - 防止认证失效
3. metrics 端点添加认证 - 防止信息泄露

### 本周修复
4. media 模块集成 MinIO
5. notification 免打扰功能
6. triggerBurn 权限校验修复

### 计划修复 (2周内)
7. 好友请求通知机制
8. DTO 验证体系统一
9. 审计日志模块
10. 群组与会话关联机制

---

## 七、亮点 (做得好的地方)

1. **事务处理规范** - `pg_advisory_xact_lock` 正确使用
2. **登录安全设计** - 限流、防撞库、密码加密完善
3. **阅后即焚机制** - 双重保护（手动+定时）设计严谨
4. **依赖注入规范** - NestJS 最佳实践
5. **代码注释详尽** - 关键逻辑有中文说明

---

## 八、总结

| 维度 | 问题数 | 严重占比 |
|------|--------|----------|
| P0 严重 | 6 | 25% |
| P1 高 | 5 | 21% |
| P2 中 | 5 | 21% |
| P3 低 | 4 | 17% |
| 亮点 | 5 | - |

**核心问题**: 安全意识不足 + 模块设计遗漏 + 架构实现偏差

**建议**: 优先修复 P0 问题，同时建立代码审查机制防止类似问题遗漏
