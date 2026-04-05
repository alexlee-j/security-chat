# Security Chat - Phase 3 语音/视频通话设计方案

**更新日期**: 2026-04-05
**阶段**: Phase 3 - 语音/视频通话
**MVP 范围**: 1v1 语音通话（暂不支持多人通话）

---

## 1. 概述

### 1.1 目标

在 Security Chat 中实现基于 WebRTC 的实时语音通话功能，作为 Phase 3 的核心特性。

### 1.2 MVP 范围

- ✅ 1v1 语音通话
- ❌ 视频通话（后续阶段）
- ❌ 多人通话（后续阶段）

### 1.3 约束条件

- **服务器**: 阿里云 2GB 内存（混合部署）
- **性能要求**: 高性能优先，减轻服务器压力
- **自托管**: 优先使用自建服务，媒体服务器需考虑资源消耗

---

## 2. 技术架构

### 2.1 WebRTC 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户 A                                  │
│  ┌─────────┐      ┌─────────┐      ┌─────────────┐          │
│  │ 麦克风   │ ───► │ WebRTC  │ ───► │   ICE        │          │
│  │ 扬声器   │ ◄─── │ 堆栈    │ ◄─── │   候选者    │          │
│  └─────────┘      └─────────┘      └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                    信令 (WebSocket)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     用户 B (同上镜像)                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 通话建立流程

```
1. 发起方 A 发送 offer SDP → WebSocket → 接收方 B
2. 接收方 B 返回 answer SDP → WebSocket → 发起方 A
3. 双方交换 ICE 候选者
4. P2P 连接建立（或通过 TURN 中继）
5. 媒体流传输开始
```

### 2.3 混合部署架构

```
┌──────────────────────────────────────────────────────────────┐
│                      阿里云服务器 (2GB RAM)                     │
│                                                              │
│   ┌────────────┐   ┌────────────┐   ┌──────────────────┐  │
│   │  NestJS    │   │  WebSocket │   │   STUN 服务       │  │
│   │  REST API  │   │  信令服务   │   │   (coturn 轻量)   │  │
│   │  (已有)    │   │  (已有)    │   │   ~50MB 内存      │  │
│   └────────────┘   └────────────┘   └──────────────────┘  │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │              第三方 TURN 服务 (外部)                    │  │
│   │         meter.ca / Twilio / Xirsys                    │  │
│   │         (不占用阿里云内存，免费额度 10GB/月)           │  │
│   └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 基础设施方案

### 3.1 资源评估

| 服务 | 内存占用 | 部署位置 | 理由 |
|------|----------|----------|------|
| STUN | ~50MB | 阿里云自建 | STUN 服务极轻量，自建更可靠 |
| TURN | 0MB | 第三方服务 | 2GB 服务器无法承载媒体中继 |
| 信令 | ~100MB | 阿里云复用 | 复用现有 WebSocket 服务 |

### 3.2 STUN/TURN 配置

**STUN 服务器**:
- 自建: `stun:3478` (coturn 只启用 STUN)
- 公共备选: `stun.l.google.com:19302`

**TURN 服务器** (第三方，按需使用):

| 提供商 | 免费额度 | 说明 |
|--------|----------|------|
| meter.ca | 10GB/月 | 推荐，开源 |
| Twilio | 500GB免费分钟 | 需要账号 |
| Xirsys | 500MB免费 | 小额度 |

**推荐方案**: meter.ca
- 开源项目，社区支持
- 每月 10GB 流量，足够 MVP
- 配置简单

### 3.3 TURN 配置示例

```yaml
# meter.ca 或自建 coturn 配置
turnserver:
  listening_port: 3478
  min_port: 49152
  max_port: 65535
  relay_ip: <阿里云公网IP>
  external_ip: <阿里云公网IP>
  user: 'your-username:your-password'
  realm: 'meter.ca'
```

---

## 4. 前端实现

### 4.1 技术选型

| 组件 | 方案 | 理由 |
|------|------|------|
| WebRTC | 原生 WebRTC API | 浏览器内置，无需额外库 |
| 信令 | 复用现有 WebSocket | 复用 apps/desktop/src/ws.ts |
| 状态管理 | React Context + useReducer | 轻量，不需要 Redux |

### 4.2 核心模块

```
apps/desktop/src/features/calling/
├── CallingContext.tsx      # 通话状态管理
├── useWebRTC.ts           # WebRTC Hook
├── useCallSignaling.ts    # 信令处理 Hook
├── CallButton.tsx         # 通话按钮组件
├── CallWindow.tsx         # 通话窗口组件
├── IncomingCallToast.tsx  # 来电通知
└── CallingEvents.ts       # 通话事件类型定义
```

### 4.3 通话状态机

```
                    ┌─────────────┐
                    │    idle     │
                    └──────┬──────┘
                           │ 发起通话/收到来电
                           ▼
                    ┌─────────────┐
              ┌────►│  ringing    │◄────┐
              │     └──────┬──────┘     │
              │            │ 超时/拒绝   │ 对方接听
              │            │            │
              │            │            │
              │     ┌──────┴──────┐     │
              └─────│   cancelled │     │
                    └─────────────┘     │
                                         │
                    ┌─────────────┐      │
                    │  connected  │──────┘
                    └──────┬──────┘
                           │ 挂断/断开
                           ▼
                    ┌─────────────┐
                    │   ended     │
                    └─────────────┘
```

### 4.4 信令协议 (WebSocket 消息)

**发起通话**:
```typescript
{
  type: 'call_invite',
  payload: {
    conversationId: string,
    callerId: string,
    calleeId: string,
    sdp: RTCSessionDescriptionInit,
    callType: 'audio' | 'video'
  }
}
```

**接听/拒绝**:
```typescript
{
  type: 'call_answer',
  payload: {
    conversationId: string,
    accepted: boolean,
    sdp?: RTCSessionDescriptionInit
  }
}
```

**ICE 候选者**:
```typescript
{
  type: 'ice_candidate',
  payload: {
    conversationId: string,
    candidate: RTCIceCandidateInit
  }
}
```

**挂断**:
```typescript
{
  type: 'call_end',
  payload: {
    conversationId: string,
    reason: 'local' | 'remote' | 'missed'
  }
}
```

---

## 5. 后端实现

### 5.1 信令服务扩展

复用现有的 `apps/backend/src/modules/message/` WebSocket 服务，新增通话相关事件处理。

### 5.2 通话记录表 (可选)

```sql
CREATE TABLE call_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  call_type VARCHAR(10) NOT NULL DEFAULT 'audio',
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration INTEGER, -- 秒
  status VARCHAR(20) DEFAULT 'missed' -- missed | completed | declined
);
```

---

## 6. UI 设计

### 6.1 通话入口

在聊天窗口头部工具栏添加通话按钮：

```
┌─────────────────────────────────────────┐
│ [头像] 李明 在线              🔍    ⋮    │
│                              📞  📹      │ ← 新增通话按钮
└─────────────────────────────────────────┘
```

**规格**:
- 语音通话按钮: 24x24px, #3390ec (Light) / #8777d1 (Dark)
- 视频通话按钮（后续）: 24x24px, 同上

### 6.2 来电通知

```
┌─────────────────────────────────────┐
│  📞  李明 来电                    │  ← Toast 通知
│      ────  接听  ────  拒绝 ────  │
└─────────────────────────────────────┘
```

### 6.3 通话窗口

```
┌─────────────────────────────────────┐
│                                     │
│            李明                      │
│          通话中...                   │
│                                     │
│              02:34                   │ ← 通话时长
│                                     │
│     ┌─────┐  ┌─────┐  ┌─────┐       │
│     │静音 │  │ 挂断 │  │ 扬声 │       │
│     └─────┘  └─────┘  └─────┘       │
│                                     │
└─────────────────────────────────────┘
```

**规格**:
- 窗口尺寸: 360x480px (居中弹出)
- 背景: 半透明黑色遮罩 + 白色/深色通话区域
- 控制按钮: 56x56px 圆形

### 6.4 主题适配

| 元素 | Light Mode | Dark Mode |
|------|------------|-----------|
| 通话窗口背景 | rgba(255,255,255,0.95) | rgba(30,40,50,0.95) |
| 用户名文字 | #000000 | #ffffff |
| 时长文字 | #707579 | #8b9aa3 |
| 静音/扬声器按钮 | #f8f9fa | #2d3a42 |
| 挂断按钮 | #e53935 | #e53935 |
| 接听按钮 | #4caf50 | #4caf50 |

---

## 7. 实现步骤

### Phase 3.1 - 基础通话 (预计)

1. **后端信令扩展**
   - WebSocket 新增通话事件处理
   - 通话状态存储 (Redis)

2. **前端通话模块**
   - CallingContext 状态管理
   - useWebRTC Hook
   - useCallSignaling Hook

3. **UI 组件**
   - CallButton 通话按钮
   - IncomingCallToast 来电通知
   - CallWindow 通话窗口

4. **集成测试**
   - 双方通话建立
   - 通话中断重连

### Phase 3.2 - 通话体验优化 (后续)

1. 通话记录持久化
2. 未接来电通知
3. 通话中切换听筒/扬声器

### Phase 3.3 - 视频通话 (后续)

1. 视频轨道添加
2. 视频通话 UI
3. 摄像头切换

---

## 8. 文件变更

### 新增文件

```
apps/desktop/src/features/calling/
├── CallingContext.tsx
├── useWebRTC.ts
├── useCallSignaling.ts
├── CallButton.tsx
├── CallWindow.tsx
├── IncomingCallToast.tsx
└── CallingEvents.ts

apps/desktop/src/styles/calling.css          # 通话样式
```

### 修改文件

```
apps/backend/src/modules/message/             # 信令处理
apps/desktop/src/App.tsx                     # CallingContext Provider
apps/desktop/src/styles.css                  # 通话相关样式
```

---

## 9. 附录

### 9.1 WebRTC 浏览器兼容性

- Chrome 56+, Firefox 44+, Safari 11+, Edge 79+
- 移动端: iOS Safari 11+, Chrome Android

### 9.2 ICE 候选者优先级

WebRTC 连接优先使用本地网络直连（最低延迟）:

1. **host** (本地网络) - 最高优先级
2. **srflx** (STUN 反射) - 中等优先级
3. **prflx** (对等反射) - 较低优先级
4. **relay** (TURN 中继) - 最低优先级

### 9.3 音频编码

| 编码 | 码率 | 延迟 | 说明 |
|------|------|------|------|
| Opus | 64kbps | ~60ms | WebRTC 默认，推荐 |
| G.711 | 64kbps | ~100ms | 传统电话质量 |

**选择**: Opus 64kbps，平衡音质和带宽

### 9.4 参考资料

- [WebRTC W3C 规范](https://www.w3.org/TR/webrtc/)
- [meter.ca TURN 服务](https://www.meter.ca/)
- [WebRTC 信令最佳实践](https://webrtc.org/getting-started/peer-connections)
