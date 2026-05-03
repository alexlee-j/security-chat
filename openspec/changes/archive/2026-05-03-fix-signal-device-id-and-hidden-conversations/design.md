## Context

当前系统存在 4 个关键问题需要修复：

1. **DeviceId 硬编码问题**：Rust 后端 `DeviceId::new(1).unwrap()` 硬编码设备 ID，导致多设备场景下 Signal 协议会话建立失败。当前会话以 `(recipient_id, device_id=1)` 存储，但实际设备 ID 各不相同。

2. **删除会话行为错误**：前端调用 `DELETE /conversation/delete` 实际删除服务端会话，双方会话同时消失。产品需求是"本地隐藏"，仅影响当前用户。

3. **拉黑/非好友后仍能发消息**：`friendships.status=2` 或双方已非好友时，既有私聊仍可发送新消息，违背产品发送规则。

4. **缺少好友关系校验**：`createDirectConversation` 未校验双向好友关系。

## Goals / Non-Goals

**Goals:**

- 后端为每个用户的设备分配稳定的 `signal_device_id`（范围 1..=127，用户内唯一），用于 Signal 协议会话地址
- Signal 协议的 `registration_id` 保持原有用法（Signal 标准定义），`signal_device_id` 作为内部设备标识
- 删除会话改为本地隐藏（`hidden=true` 在 `conversation_members` 表），后端记录用户级别隐藏状态
- 拉黑后双向禁止发消息
- `createDirectConversation` 和既有私聊发送路径增加好友关系校验

**Non-Goals:**

- 不改变 Signal 协议的 `registration_id` 语义（由 libsignal 库管理）
- 不重新设计会话数据结构，仅扩展 `conversation_members` 表字段
- 不实现"删除会话"的服务器端彻底删除（本地隐藏已满足产品需求）

## Decisions

### 决策 1：后端分配 `signal_device_id` 而非混用 `registration_id`

**选择**：后端在设备注册时分配用户内唯一的 `signal_device_id`（1..=127），用于 Signal 协议会话地址；`registration_id` 保持为 Signal 标准字段。

**理由**：
- Signal 协议中 `registration_id` 是 libsignal 内部概念，用于标识设备注册状态
- `signal_device_id` 是我们系统内部生成的设备标识，用于构建 `ProtocolAddress`
- 分离两个概念避免职责混淆
- libsignal 的 `DeviceId` 合法范围为 1..=127，因此 `signal_device_id` 必须限制在该范围内
- 后端作为唯一数据源确保同一用户下的 `signal_device_id` 唯一；全局设备标识继续使用现有 `devices.id` UUID
- API 响应必须同时暴露 `deviceId`（现有 `devices.id` UUID，用于 REST/WebSocket 投递、prekey 查询和 message_device_envelopes）与 `signalDeviceId`（用于客户端 libsignal `DeviceId`）

**替代方案**：
- 直接复用 `registration_id`：与 Signal 协议语义冲突，libsignal 可能修改其值
- 前端生成 UUID 转数值：无法保证跨设备唯一性

### 决策 2：`hidden` 字段存储在 `conversation_members` 表

**选择**：`conversation_members` 表新增 `hidden` 列，类型为 `boolean DEFAULT false`。

**理由**：
- `conversations` 表是共享会话记录，用户 A 隐藏会话会影响用户 B 的视图
- `conversation_members` 是用户与会话的对联表，存储用户级别状态
- 已有 `userId` 字段，直接增加 `hidden` 字段即可
- 查询高效，无需关联额外表

**替代方案**：
- `conversations.hidden`：会导致所有用户看到同一隐藏状态（错误）
- 独立 `conversation_hidden` 表：增加查询复杂度

### 决策 3：拉黑校验在发送路径 guard 执行，而非 assertMember

**选择**：新增 `assertCanSendDirectMessage(fromUserId, toUserId)` 方法，仅在消息发送路径调用。

**理由**：
- `assertMember` 被媒体下载、通话、会话设置、历史查询、回执、burn 操作等多种路径复用
- 在 `assertMember` 中做拉黑校验会导致被拉黑用户无法查看历史、下载附件等
- 拉黑的业务语义是"禁止发送/接收消息"，而非"禁止访问会话"
- 发送路径 guard 专注于消息发送校验，职责单一

**实现位置**：
- HTTP `/message/send-v2` 端点对应的 `sendMessageV2`
- REST `/message/forward` 对应的 `forwardMessage`（服务端会创建新的私聊消息）
- `createDirectConversation` 前置校验

### 决策 3.5：私聊发送路径校验双向好友关系

**选择**：`sendMessageV2`、`forwardMessage` 和 `createDirectConversation` 均 SHALL 校验双方存在双向 `friendships.status=1` 关系。

**理由**：
- 产品规则是非好友不能继续在已有私聊里发送新消息
- 只在 `createDirectConversation` 校验会留下既有会话绕过路径
- 好友关系校验仍属于发送/打开入口 guard，不应放入 `assertMember`，避免影响历史读取、媒体访问、回执等非发送路径

### 决策 4：恢复隐藏会话的职责边界

**选择**：
- 后端职责：发送/收到消息时更新 `conversation_members.hidden=false`
- 前端职责：收到消息后更新本地缓存，列表拉取以服务端为准

**理由**：
- 服务端是隐藏状态的主数据源
- 前端仅做展示层缓存，保证最终一致性
- 避免前端未同步导致状态不一致

**具体流程**：
1. 用户发送消息 → 后端检查 hidden=true → 更新为 false → 返回成功
2. 用户收到消息 → 后端检查 hidden=true → 更新为 false → 推送更新事件
3. 前端收到 envelope → 更新本地会话缓存 → 刷新列表
4. 群聊消息发送成功 → 后端将该会话所有成员的 `hidden` 更新为 false → 通过会话更新事件通知客户端

### 决策 5：`signal_device_id` 与 `registration_id` 关系

| 字段 | 用途 | 管理方 | 生命周期 |
|------|------|--------|----------|
| `registration_id` | Signal 协议标准字段，标识设备注册状态 | libsignal/Rust | 随设备注册生成，可能因 libsignal 内部原因变化 |
| `signal_device_id` | 系统内部设备号，用于 ProtocolAddress 的 DeviceId | 后端控制 | 设备注销前保持稳定，在同一用户下唯一，范围 1..=127 |
| `deviceId` / `devices.id` | 后端设备 UUID，用于鉴权、prekey 查询、send-v2 envelope 投递队列 | 后端控制 | 全局唯一，不传给 libsignal `DeviceId` |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `signal_device_id` 回收集成复杂 | 仅在同一用户的设备注销后复用 1..=127 范围内的最小可用值；全局身份仍使用 `devices.id` |
| 跨设备隐藏状态同步有延迟 | 前端每次拉取会话列表时带上 `hidden` 状态，后端实时返回 |
| 拉黑后消息已在发送队列中 | 拉黑操作触发时检查待发送队列，批量撤回 |
| 数据库迁移阻塞生产 | `signal_device_id` 先新增 nullable 列并回填，再添加 NOT NULL/唯一/范围约束；hidden 使用默认 false |
| `registration_id` 与 `signal_device_id` 混淆 | 代码中明确命名，接口文档清晰区分 |

## Migration Plan

### Phase 1: signal_device_id 修复（改动 1）

1. 数据库迁移：
   - `devices` 表先新增 nullable `signal_device_id` 列（smallint）
   - 按 `user_id` 为现有设备回填 1..=127 的用户内唯一值
   - 若任一用户现有设备数超过 127，迁移 SHALL fail fast 并输出该用户 ID，需人工清理/合并设备后重跑
   - 回填完成后新增 `signal_device_id BETWEEN 1 AND 127` 检查约束
   - 回填完成后新增 `(user_id, signal_device_id)` 唯一索引
   - 回填完成后将 `signal_device_id` 设为 NOT NULL
2. 后端设备注册逻辑：注册时为该用户分配最小可用 `signal_device_id`
3. 后端设备注册、设备列表、批量设备发现、prekey bundle/peek 接口返回 `signalDeviceId`，同时保留 `deviceId` UUID
4. Rust `RemotePrekeyBundleDto` 增加 `signal_device_id`
5. Rust 所有 `ProtocolAddress` / `PreKeyBundle` 的 `DeviceId` 构造点使用 `signal_device_id`
6. 前端存储当前设备的 `signal_device_id`，并在与远端设备建立会话、加密、解密时传递远端 `signalDeviceId`

### Phase 2: 隐藏会话（改动 2）

1. 数据库迁移：`conversation_members` 表新增 `hidden` 列（boolean DEFAULT false）
2. 后端修改 `deleteConversation` 接口：改为更新 `conversation_members.hidden=true`
3. 后端获取会话列表接口返回各会话的 `hidden` 状态
4. 前端 `deleteConversationFromServer` 调用新的隐藏 API
5. 前端会话列表默认过滤 `hidden=false`
6. 好友中心发消息时检查并恢复隐藏会话
7. 发送/收到消息时后端自动取消隐藏；群聊消息恢复该会话所有成员的隐藏状态

### Phase 3: 拉黑校验（改动 3）

1. 新增 `assertCanSendDirectMessage(fromUserId, toUserId)` 方法
2. 在 `sendMessageV2`、`forwardMessage` 和 `createDirectConversation` 中调用
3. 拉黑接口在创建拉黑关系时由后端同步隐藏双方会话，前端只刷新会话列表

### Phase 4: 好友关系校验（改动 4）

1. 后端 `createDirectConversation` 增加双向好友关系校验
2. 后端 `sendMessageV2` 和 `forwardMessage` 增加双向好友关系校验，防止非好友通过既有私聊继续发送
3. 非好友时返回友好错误提示
4. 前端调用前先检查好友状态

## Open Questions

1. **`signal_device_id` 回收策略**：同一用户设备注销后，其 `signal_device_id` 是否允许被该用户的新设备复用？建议允许复用，旧会话在设备重新注册后重新建立。
2. **历史数据修复**：已存在的设备需要通过重新注册流程获取 `signal_device_id`。
3. **`registration_id` 变化处理**：如果 libsignal 因内部原因改变了 `registration_id`，是否需要重新建立会话？
