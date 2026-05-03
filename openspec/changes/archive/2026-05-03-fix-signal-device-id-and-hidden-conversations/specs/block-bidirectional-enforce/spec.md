## Purpose

定义双向拉黑校验机制，确保拉黑后双方都不能发送消息。

## ADDED Requirements

### Requirement: 拉黑关系 SHALL 双向禁止发消息

When a block relationship exists (friendships.status = 2), neither user SHALL be able to send messages to the other.

#### Scenario: 用户 A 向已拉黑的用户 B 发送消息
- **WHEN** 用户 A attempts to send a message to 用户 B after 用户 A has blocked 用户 B
- **THEN** 系统 SHALL reject the message with error code `BLOCKED`
- **AND** the message SHALL NOT be delivered

#### Scenario: 用户 A 向拉黑自己的用户 B 发送消息
- **WHEN** 用户 A attempts to send a message to 用户 B after 用户 B has blocked 用户 A
- **THEN** 系统 SHALL reject the message with error code `BLOCKED`
- **AND** the message SHALL NOT be delivered

#### Scenario: 用户 A 在拉黑后尝试发送多设备消息
- **WHEN** 用户 A has blocked 用户 B and attempts to send a message targeting multiple devices of 用户 B
- **THEN** 系统 SHALL check the block status before fan-out
- **AND** reject the entire message send request

### Requirement: Message sending guard SHALL 执行拉黑双向校验

All direct-message creation paths SHALL include bidirectional block checking before allowing message forwarding. This check SHALL be implemented in a sending-specific guard such as `assertCanSendDirectMessage` and SHALL NOT be added to generic conversation membership checks used by history, media, call, settings, receipt, or burn flows.

#### Scenario: sending guard 检测到用户 A 拉黑了用户 B
- **WHEN** `assertCanSendDirectMessage` is called for 用户 A sending to 用户 B
- **AND** friendships shows 用户 A blocked 用户 B (status = 2)
- **THEN** 系统 SHALL throw BLOCKED error
- **AND** SHALL NOT forward the message

#### Scenario: sending guard 检测到用户 B 拉黑了用户 A
- **WHEN** `assertCanSendDirectMessage` is called for 用户 A sending to 用户 B
- **AND** friendships shows 用户 B blocked 用户 A (status = 2)
- **THEN** 系统 SHALL throw BLOCKED error
- **AND** SHALL NOT forward the message

#### Scenario: server-side forward path is blocked
- **WHEN** 用户 A attempts to forward an existing message into a direct conversation with 用户 B
- **AND** either 用户 A blocked 用户 B or 用户 B blocked 用户 A
- **THEN** 系统 SHALL reject the forward request with error code `BLOCKED`
- **AND** SHALL NOT create a new forwarded message

#### Scenario: blocked users still access existing conversation history
- **WHEN** 用户 A is blocked by 用户 B
- **AND** 用户 A fetches readable history, receipts, media, or conversation settings for an existing conversation
- **THEN** generic membership checks SHALL still allow access when 用户 A is a conversation member
- **AND** only new message sending SHALL be rejected with BLOCKED

### Requirement: 私聊发送 SHALL require 双向好友关系

All direct-message creation paths SHALL verify that both users still have accepted friendship rows (`friendships.status = 1` in both directions) before creating a new message. This check SHALL apply to existing direct conversations as well as newly created direct conversations, and SHALL NOT be added to generic conversation membership checks used by history, media, receipt, or settings flows.

#### Scenario: 非好友不能通过既有私聊 send-v2 发送
- **WHEN** 用户 A and 用户 B have an existing direct conversation
- **AND** they are no longer bidirectional friends
- **AND** 用户 A attempts to send through REST `/message/send-v2`
- **THEN** 系统 SHALL reject the request with a friendly forbidden error
- **AND** SHALL NOT create message or envelope rows

#### Scenario: 非好友不能通过服务端 forward 发送
- **WHEN** 用户 A and 用户 B have an existing direct conversation
- **AND** they are no longer bidirectional friends
- **AND** 用户 A attempts to forward a legacy message into that conversation
- **THEN** 系统 SHALL reject the forward request with a friendly forbidden error
- **AND** SHALL NOT create a forwarded message

#### Scenario: 非好友仍可读取已有历史
- **WHEN** 用户 A and 用户 B are no longer bidirectional friends
- **AND** 用户 A fetches existing history, media, receipts, or conversation settings as a conversation member
- **THEN** generic membership checks SHALL still allow access
- **AND** only new direct-message creation SHALL be rejected

### Requirement: 拉黑操作 SHALL 触发会话隐藏

When a block relationship is created, both users' conversations SHALL be hidden.

#### Scenario: 用户 A 拉黑用户 B 后检查会话状态
- **WHEN** 用户 A blocks 用户 B
- **THEN** 用户 A's conversation with 用户 B SHALL be set to `hidden=true`
- **AND** 用户 B's conversation with 用户 A SHALL be set to `hidden=true`
