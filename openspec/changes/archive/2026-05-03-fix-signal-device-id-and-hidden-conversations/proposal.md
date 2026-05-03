## Why

当前实现存在 4 个关键问题：(1) Rust 后端使用硬编码的 DeviceId=1 导致多设备场景下 Signal 协议会话建立失败，消息无法解密；(2) 删除会话实际调用服务端删除 API，导致双方会话同时消失，不符合"本地隐藏"的产品预期；(3) 拉黑/非好友后仍能通过既有私聊发送消息，违背发送规则；(4) createDirectConversation 缺少好友关系校验。

## What Changes

### 改动 1：后端为每个用户的设备分配唯一 signal_device_id

- 后端在设备注册时生成用户内唯一的数值型 `signal_device_id`（范围 1..=127），作为 Signal 协议会话地址的设备标识
- Signal 协议的 `registration_id` 保持原有用法（libsignal 管理），不与此字段混淆
- 后端设备发现、设备列表、prekey bundle 接口同时返回 `deviceId`（UUID，用于后端投递）和 `signalDeviceId`（1..=127，用于 libsignal `DeviceId`）
- Rust commands.rs 的所有 `ProtocolAddress` / `PreKeyBundle` 设备号构造点改用后端返回的 `signal_device_id`，而非硬编码的 `DeviceId::new(1)`
- 数据库迁移：先为 `devices` 表新增 nullable `signal_device_id` 列，回填现有设备后，再创建 `(user_id, signal_device_id)` 唯一约束、1..=127 范围约束和 NOT NULL 约束
- 支持同一用户设备重新注册时复用已被回收的 `signal_device_id`

### 改动 2：删除会话改为本地隐藏

- `conversation_members` 表新增 `hidden` 布尔列（默认 false），存储用户级别隐藏状态
- 注意：`hidden` 落在 `conversation_members` 而非 `conversations`，确保仅影响当前用户
- 删除会话 API 改为更新 `conversation_members.hidden=true`（仅影响当前用户）
- 隐藏状态跨设备同步：后端记录 `conversation_members.hidden` 状态，前端拉取会话列表时返回
- 恢复逻辑：
  - 主动恢复：在好友中心点击发消息时，若存在 `hidden=true` 的会话则清除该标记
  - 被动恢复：后端发送/收到消息时检查 `hidden=true` 则自动更新为 `false`；群聊消息恢复该会话所有成员的隐藏状态
- 多设备场景：设备 A 隐藏会话后，设备 B 登录时同步隐藏状态

### 改动 3：拉黑后双方禁止发消息

- `friendships` 表 `status=2` 表示拉黑关系
- 新增 `assertCanSendDirectMessage(fromUserId, toUserId)` 方法执行拉黑双向校验
- 在所有私聊新消息创建路径（REST `/message/send-v2`、`forwardMessage`）和直接会话创建入口调用此 guard
- 私聊发送路径还必须校验双方仍是双向好友，非好友不能通过既有私聊继续发送新消息
- **不在 `assertMember` 中做拉黑校验**：`assertMember` 被媒体下载、历史查询等非发送路径复用，在其中做拉黑会导致被拉黑用户无法访问历史
- 若存在拉黑关系，返回错误码并拒绝转发消息
- 拉黑接口在创建拉黑关系时由后端同步隐藏双方会话；前端只负责刷新会话列表

### 改动 4：私聊入口增加好友关系校验

- 在创建直接会话前校验双向好友关系（双方 `status=1`）
- 在既有私聊的 `send-v2` 和 `forwardMessage` 发送入口同样校验双向好友关系
- 若任一方向非好友，返回友好错误提示
- 后端做兜底防护，前端做前置检查

## Capabilities

### New Capabilities

- `hidden-conversation-sync`: 隐藏会话的跨设备同步机制，包含隐藏/恢复时机、同步协议、数据持久化格式
- `block-bidirectional-enforce`: 双向拉黑校验，在消息发送路径拦截被拉黑方的消息

### Modified Capabilities

- `local-first-direct-history`: 修改消息回执和会话状态持久化逻辑，支持 `hidden` 字段的本地存储与查询
- `device-bound-transport-convergence`: 修改设备注册流程，新增 `signal_device_id` 字段，后端返回唯一数值 ID 用于 Signal 会话地址

## Impact

### 后端影响

- `apps/backend/src/modules/user/entities/device.entity.ts`: 新增 `signalDeviceId` 字段和复用逻辑
- `apps/backend/src/modules/user/user.service.ts`: 设备列表、批量设备发现、prekey bundle/peek 响应返回 `signalDeviceId`
- `apps/backend/src/modules/conversation/conversation.service.ts`: createDirectConversation 和私聊发送路径增加好友关系校验
- `apps/backend/src/modules/conversation/conversation.service.ts`: 删除会话改为更新 `conversation_members.hidden` 字段
- `apps/backend/src/modules/conversation/conversation.service.ts`: 新增 `assertCanSendDirectMessage` 方法
- `apps/backend/src/modules/friend/friend.service.ts`: 拉黑时同步隐藏双方会话
- 数据库迁移：新增并回填 `devices.signal_device_id` 后加用户内唯一索引，新增 `conversation_members.hidden` 列

### Rust/桌面端影响

- `apps/desktop/src-tauri/src/api/commands.rs`: `RemotePrekeyBundleDto` 携带 `signal_device_id`，所有 `ProtocolAddress` / `PreKeyBundle` 设备号构造点使用该值创建 `DeviceId`
- `apps/desktop/src/core/use-chat-client.ts`: deleteConversationFromServer 改为本地隐藏逻辑
- 设备注册流程：前端上传设备信息后，存储后端返回的 `signal_device_id`

### 前端影响

- 会话列表 UI：支持根据 `hidden` 字段过滤隐藏会话
- 好友中心：发消息按钮点击时检查并恢复隐藏会话
- 拉黑交互：拉黑后刷新会话列表
