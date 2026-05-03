## 1. 改动 1：后端分配用户内唯一 signal_device_id

- [x] 1.1 数据库迁移：`devices` 表先新增 nullable `signal_device_id` 列（smallint）
- [x] 1.2 数据库迁移：按 `user_id` 为现有设备回填 1..=127 的用户内唯一 `signal_device_id`
- [x] 1.3 数据库迁移：若任一用户现有设备数超过 127，迁移 fail fast 并输出该用户 ID，需人工清理/合并设备后重跑
- [x] 1.4 数据库迁移：回填完成后新增 1..=127 范围约束、`(user_id, signal_device_id)` 唯一索引和 NOT NULL 约束
- [x] 1.5 后端设备注册逻辑：注册时为当前用户分配最小可用 `signal_device_id`
- [x] 1.6 后端设备注册接口返回分配的 `signalDeviceId` 给前端，并保留 `deviceId` UUID
- [x] 1.7 后端设备列表、批量设备发现、`getPrekeyBundle`、`peekPrekeyBundle` 响应同时返回 `deviceId`（UUID）和 `signalDeviceId`（1..=127）
- [x] 1.8 Rust `RemotePrekeyBundleDto` 增加 `signal_device_id`
- [x] 1.9 Rust 所有 `ProtocolAddress` / `PreKeyBundle` 的 `DeviceId` 构造点改用 `signal_device_id`，覆盖 `establish_session_command`、`encrypt_message_command`、`decrypt_message_command`、`convert_remote_prekey_bundle` 及相关测试
- [x] 1.10 前端存储当前设备的 `signal_device_id`，并向 Rust 传递远端设备的 `signalDeviceId` 用于后续 Signal 操作
- [x] 1.11 测试验证：多设备场景下消息加解密正常

## 2. 改动 2：删除会话改为本地隐藏

- [x] 2.1 数据库迁移：`conversation_members` 表新增 `hidden` 列（boolean DEFAULT false）
- [x] 2.2 后端修改 `deleteConversation` 接口：改为更新 `conversation_members.hidden=true`
- [x] 2.3 后端获取会话列表接口返回各会话的 `hidden` 状态
- [x] 2.4 前端 `deleteConversationFromServer` 调用新的隐藏 API
- [x] 2.5 前端会话列表默认过滤 `hidden=true` 的会话
- [x] 2.6 好友中心发消息时检查并恢复隐藏会话
- [x] 2.7 **后端处理**：发送消息时检查 `hidden=true` 则更新为 `false`
- [x] 2.8 **后端处理**：收到消息时检查 `hidden=true` 则更新为 `false`，并推送更新事件
- [x] 2.9 前端收到 envelope 后更新本地缓存，列表以服务端数据为准
- [x] 2.10 群聊消息发送成功后恢复该会话所有成员的 `hidden=false`

## 3. 改动 3：拉黑后双方禁止发消息

- [x] 3.1 新增 `assertCanSendDirectMessage(fromUserId, toUserId)` 方法，仅做拉黑双向校验
- [x] 3.2 在 REST `/message/send-v2` 对应的 `sendMessageV2` 中调用 guard
- [x] 3.3 在 REST `/message/forward` 对应的 `forwardMessage` 中调用 guard，防止旧 v1 消息服务端转发绕过拉黑
- [x] 3.4 在 `createDirectConversation` 中调用 guard/好友关系校验，防止拉黑双方重新打开发送入口
- [x] 3.5 拉黑接口在创建拉黑关系时同时隐藏双方会话
- [x] 3.6 前端拉黑操作后刷新会话列表
- [x] 3.7 测试验证：拉黑后双方都无法通过 send-v2 或 forward 发送消息，但历史记录可正常访问
- [x] 3.8 测试验证：非好友无法通过既有私聊 send-v2 或 forward 创建新消息

## 4. 改动 4：createDirectConversation 增加好友关系校验

- [x] 4.1 后端 `createDirectConversation` 增加双向好友关系校验
- [x] 4.1.1 后端 `sendMessageV2` 和 `forwardMessage` 增加双向好友关系校验，防止既有私聊绕过
- [x] 4.2 非好友时返回友好错误提示
- [x] 4.3 前端调用前先检查好友状态（前置校验）

## 5. 端到端测试

- [x] 5.1 多设备登录场景验证 `deviceId` UUID 与 `signalDeviceId` 分离且 `signalDeviceId` 正确用于 libsignal
- [x] 5.2 删除会话后对方会话仍存在验证
- [x] 5.3 跨设备隐藏状态同步验证
- [x] 5.4 好友中心发消息恢复隐藏会话验证
- [x] 5.5 拉黑后双向消息拦截验证（历史记录读取不受影响）
