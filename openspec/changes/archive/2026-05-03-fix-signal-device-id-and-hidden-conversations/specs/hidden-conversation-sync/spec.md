## Purpose

定义隐藏会话的跨设备同步机制，包括隐藏/恢复时机、同步协议、数据持久化格式。

## ADDED Requirements

### Requirement: 隐藏会话 SHALL be 本地隐藏而非服务端删除

隐藏会话操作 SHALL only set the conversation's `hidden` flag to `true` in `conversation_members` table for the current user without affecting the other participant's conversation view.

#### Scenario: 用户 A 隐藏与用户 B 的会话
- **WHEN** 用户 A clicks "delete conversation"
- **THEN** 系统 SHALL only update `conversation_members` record for 用户 A to set `hidden=true`
- **AND** 用户 B's `conversation_members` record SHALL remain unchanged with `hidden=false`

#### Scenario: 多设备场景下用户 A 在设备 1 隐藏会话
- **WHEN** 用户 A 在设备 1 隐藏与用户 B 的会话
- **AND** 用户 A's 设备 2 is already logged in
- **THEN** 设备 2 SHALL receive the hidden state on next conversation list fetch
- **AND** 设备 2's UI SHALL also hide the conversation

### Requirement: 隐藏状态 SHALL 跨设备同步

后端 SHALL maintain the hidden state per user per conversation (in `conversation_members` table) and return it when fetching the conversation list.

#### Scenario: 设备重新登录后获取隐藏状态
- **WHEN** 用户 A's 设备 fetches the conversation list after re-login
- **THEN** the response SHALL include each conversation's `hidden` flag from `conversation_members` for that user
- **AND** the UI SHALL filter out conversations where `hidden=true`

#### Scenario: 隐藏会话在设备 B 上同步显示
- **WHEN** 用户 A 在设备 A 隐藏会话
- **AND** 用户 A's 设备 B requests conversation list
- **THEN** 设备 B SHALL receive `hidden=true` for that conversation
- **AND** 设备 B SHALL NOT display the conversation in the main list

### Requirement: 隐藏会话 SHALL 通过发消息恢复（后端处理）

When a user sends or receives a message in a hidden conversation, the system SHALL automatically unhide the conversation.

#### Scenario: 用户向隐藏会话的联系人发消息
- **WHEN** 用户 A sends a message to 用户 B where 用户 A's `conversation_members.hidden=true`
- **THEN** 系统 SHALL automatically set `hidden=false` for 用户 A's `conversation_members` record
- **AND** the conversation SHALL reappear in 用户 A's conversation list

#### Scenario: 用户收到隐藏会话联系人的消息
- **WHEN** 用户 A receives a message from 用户 B where 用户 A's `conversation_members.hidden=true`
- **THEN** 系统 SHALL automatically set `hidden=false` for 用户 A's `conversation_members` record
- **AND** the conversation SHALL reappear in 用户 A's conversation list
- **AND** 系统 SHALL push an update event to notify the client

#### Scenario: 群聊隐藏后任一成员发送消息
- **WHEN** a group conversation has one or more members with `conversation_members.hidden=true`
- **AND** any group member sends a message successfully
- **THEN** 系统 SHALL automatically set `hidden=false` for all current members of that conversation
- **AND** 系统 SHALL push an update event to notify clients

### Requirement: 隐藏会话 SHALL 通过好友中心发消息入口恢复

The friend center's "send message" button SHALL check if a hidden conversation exists and unhide it before navigating to the conversation.

#### Scenario: 用户在好友中心点击向隐藏会话的联系人发消息
- **WHEN** 用户 A clicks "send message" on 用户 B in friend center
- **AND** 用户 A has a hidden conversation with 用户 B (`conversation_members.hidden=true`)
- **THEN** 系统 SHALL first set `hidden=false` for that record
- **AND** then navigate to the conversation view

### Requirement: 拉黑 SHALL 触发双向隐藏

When a user blocks another user, the system SHALL hide both users' conversations.

#### Scenario: 用户 A 拉黑用户 B
- **WHEN** 用户 A blocks 用户 B
- **THEN** 系统 SHALL set `hidden=true` for 用户 A's `conversation_members` record
- **AND** 系统 SHALL also set `hidden=true` for 用户 B's `conversation_members` record
