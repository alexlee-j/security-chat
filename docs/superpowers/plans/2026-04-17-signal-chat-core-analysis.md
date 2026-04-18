# Signal 协议与聊天核心逻辑分析（问题记录）

## 1. 当前结论（先给结论）

当前修复**未完整闭环**。  
后端 `send-v2 + message_device_envelopes + 设备绑定 JWT` 主干已基本落地，但桌面端发送链路仍在旧路径（单设备加密 + `/message/send`），所以真实运行仍会命中“多设备不完整投递”问题。

### 新增强制约束（2026-04-17）

- Signal 核心加解密实现必须以 **Rust** 为准（通过 Tauri/Rust 或 WASM Rust 实现），不再接受仅 JS 核心实现作为目标态。

## 2. 已完成与未完成边界

### 2.1 已完成（后端主干）

- 认证设备上下文：
  - `access/refresh token` 带 `deviceId`（并保留 legacy 过渡能力）
  - 登录/验证码登录要求并校验 `deviceId` 归属
  - 刷新 token 保留 `deviceId` 语义
- 多设备消息存储：
  - 新增 `message_device_envelopes`
  - 新增 `POST /message/send-v2`
  - `send-v2` 将逻辑消息（`messages`）与设备密文（`message_device_envelopes`）分离
- 读取补丁：
  - `queryMessages` 在逻辑消息密文为空时，按 `targetDeviceId` 回填 envelope 密文
  - 直聊 `send-v2` 限制为 direct-only（防止组聊半成品写入）

### 2.2 未完成（闭环缺口）

- 桌面端发送仍走旧逻辑：
  - `apps/desktop/src/core/use-chat-client.ts` 当前仍是“取接收方 `devices[0]` -> 单份加密 -> `sendMessage`”
  - 未接入 `send-v2`，未做“按接收方所有设备 fan-out”
- 前端/后端契约仍混用：
  - 前端仍传 `sourceDeviceId` 到旧接口
  - 新接口依赖 JWT 设备上下文，但前端尚未切换

## 3. 核心逻辑拆解（Signal + 聊天）

### 3.1 设备身份与会话边界

目标语义：会话应按 `(remoteUserId, remoteDeviceId)` 唯一定位。  
现状：
- 后端正在向“设备级上下文”收敛；
- 桌面端会话键逻辑虽已部分修复，但还有历史注释和兼容路径混杂，存在误导风险（见 `key-management.ts` 注释）。

### 3.2 发送链路（目标正确形态）

正确形态应为：
1. 客户端拿到接收方全部设备列表；
2. 每个设备独立加密得到 envelope；
3. 调用 `/message/send-v2` 一次提交逻辑消息 + envelopes；
4. 后端落 `messages`（逻辑）+ `message_device_envelopes`（设备密文）。

当前状态：
- 后端已支持此模型；
- 桌面端尚未执行第 1/2/3 步（仍单设备）。

### 3.3 读取链路（历史同步）

正确形态应为：
1. 按会话拉逻辑消息；
2. 对 `encryptedPayload` 为空的行，按当前设备 ID 从 envelope 回填；
3. 客户端解密时使用 `senderId + sourceDeviceId` 做会话恢复。

当前状态：
- 后端已实现回填逻辑；
- 对无设备上下文 token，策略是遇到 v2 空密文即报错（避免回错设备密文）；
- 客户端仍有 `sourceDeviceId || '1'` 旧回退，属于兼容逻辑，后续需收口。

## 4. 聊天场景分析（重点风险）

### 场景 A：直聊，双方单设备

- 旧链路可工作；
- `send-v2` 也可工作；
- 风险低。

### 场景 B：直聊，接收方多设备

- 当前真实风险最高：
  - 前端仍单设备加密，只会投递到一台设备；
  - 其他设备历史同步会缺可解密密文。

### 场景 C：发送方多设备（自同步）

- 后端已允许直聊 envelopes 包含发送方设备；
- 但前端未构造发送方设备 envelope，导致“同账号另一设备”历史同步可能不完整。

### 场景 D：组聊

- `send-v2` 当前明确 direct-only；
- 这是保护策略，不是功能完成。

### 场景 E：legacy token 读历史

- 若命中旧消息（逻辑密文非空）可继续读；
- 若命中 v2 空逻辑密文，会要求设备上下文（重新登录），这是安全优先策略。

## 5. 问题清单（已记录，待修）

### P0（必须先修）

1. 桌面端发送未切换 `send-v2`，仍单设备加密。  
   文件：`apps/desktop/src/core/use-chat-client.ts`

2. 桌面端未做接收方设备全集 fan-out。  
   文件：`apps/desktop/src/core/use-chat-client.ts`

### P1（高优先）

3. 客户端解密仍有 `sourceDeviceId || '1'` 兼容回退，需在数据迁移完成后收口。  
   文件：`apps/desktop/src/core/use-chat-client.ts`

4. `key-management.ts` 仍存在与现状不一致的旧注释（误导后续开发）。  
   文件：`apps/desktop/src/core/signal/key-management.ts`

5. 缺少“读取链路”的强回归测试（仅有写入/去重/校验类测试）。  
   文件：`apps/backend/test/message/message.multi-device.spec.ts`

### P2（中优先）

6. conversation 列表预览仍偏向“metadata-first”，需要产品策略确认是否展示可解密摘要或占位。  
   文件：`apps/backend/src/modules/conversation/conversation.service.ts`

## 6. 后续修复建议顺序

1. **先补桌面端 Task 5**：切 `send-v2` + 接收方全设备 fan-out。  
2. **再补 Task 6**：收口 Signal 兼容分支（尤其 `'1'` 回退）并强化多账号隔离验证。  
3. **最后补测试**：补“读取链路 + 多设备历史同步 + legacy token 行为”回归。

---

本文档用于后续持续修复追踪，优先围绕 `直聊多设备闭环`，组聊 fan-out 另开专题。

## 7. 本轮修复记录（2026-04-17，前端 Signal Rust 切换）

### 7.1 已完成（更新）

- 桌面端 Signal 运行入口改为 **纯 Rust 主链路**：
  - `apps/desktop/src/core/signal/rust-signal.ts` 新增 Tauri Rust bridge 与 Rust 密文 envelope 编解码。
  - `apps/desktop/src/core/signal/message-encryption.ts` 加解密主路径优先走 Rust command。
  - `apps/desktop/src/core/use-signal.ts` 发送与接收仅接受 Rust envelope（非 Rust envelope 在 Rust-only 模式下直接报错）。
- 设备维度参数已对齐到 Rust command：
  - `apps/desktop/src-tauri/src/api/commands.rs` 的 `encrypt/decrypt/establish` 增加 `recipientDeviceId/senderDeviceId` 语义（Rust 侧采用 `userId#deviceId` 复合地址）。
- `establish_session_command` 已接入 `process_prekey_bundle`，不再是占位返回。
- 新增 Rust 侧 prekey 导出命令：
  - `get_registration_keys_command`（注册时使用 Rust 生成的 identity/signed prekey）
  - `get_prekey_bundle_command`（上传 prekeys 使用 Rust 导出材料）
- 后端 prekey 契约补齐 `kyberPrekey`：
  - `POST /user/keys/upload` 支持 `kyberPrekey`
  - `POST /user/keys/upload` 支持 `identityKey`，用于 Rust 本地 identity 轮换后同步设备身份公钥
  - `GET /user/keys/bundle/:userId/:deviceId` 返回 `kyberPrekey`
  - `GET /user/keys/bundle/:userId/:deviceId/peek` 返回 `kyberPrekeyAvailable`
- 移除运行时对 `new SignalProtocol()` 的硬依赖入口：
  - `apps/desktop/src/core/signal/key-management.ts` 改为 `X3DH` 静态方法生成密钥材料；
  - 注册流程不再直接调用 `X3DH.generateSignedPrekey`，改走 `KeyManager`。

### 7.2 验证结果（更新）

- `cargo check`（`apps/desktop/src-tauri`）通过。
- `cargo test establish_session_with_remote_bundle_and_roundtrip_message --package security-chat` 通过（新增测试，验证真实会话建立 + 加解密闭环）。
- `pnpm -C apps/backend build` 通过。
- `pnpm -C apps/desktop build` 通过（2026-04-17 本地复验，存在 Vite chunk warning，但非阻断）。

### 7.3 仍需继续修复（关键）

1. 组聊 Sender Key 链路尚未按 Rust-only 目标做同级验证，本轮仅完成直聊 Signal 闭环。

## 8. 后续流程继续分析（2026-04-17 增量）

### 8.1 新发现关键问题（未修复）

1. **P0：桌面端发送链路仍未切换到 `/message/send-v2`，仍调用旧接口 `/message/send`。**  
   - 文件：`apps/desktop/src/core/api.ts`（`sendMessage`）  
   - 风险：无法利用后端设备 fan-out 存储模型，Rust-only 多设备闭环仍断开。

2. **P0：桌面端只对接收方首个设备加密（`devices[0]?.devices?.[0]`），未对接收方全设备 fan-out。**  
   - 文件：`apps/desktop/src/core/use-chat-client.ts`（`onSendMessage`）  
   - 风险：接收方多设备场景下仍有设备收不到可解密密文。

3. **P0：`forwardMessage` 仍基于 `messages.encrypted_payload` 复制；在 v2（逻辑层 `encrypted_payload = null`）下会转发出空密文。**  
   - 文件：`apps/backend/src/modules/message/message.service.ts`（`forwardMessage`）  
   - 风险：转发消息在 v2 路径中可能不可读，且未生成 `message_device_envelopes`。

4. **P1：客户端解密仍保留旧回退：`sourceDeviceId || '1'`，并在预期错误时降级到旧解码。**  
   - 文件：`apps/desktop/src/core/use-chat-client.ts`（`decodePayload`）  
   - 风险：与 Rust-only 目标不一致，且会掩盖真实会话/设备绑定错误。

### 8.2 兼容与体验层问题（待确认策略）

5. **P1：会话列表预览仍是 metadata-first，且尝试同步解码 `lastMessage.encryptedPayload`。**  
   - 文件：`apps/backend/src/modules/conversation/conversation.service.ts`，`apps/desktop/src/features/chat/conversation-sidebar.tsx`  
   - 风险：v2 场景下预览文案可能为空或不可读，需要明确产品策略（占位文案 vs 可解密摘要缓存）。

6. **P2：WebSocket Gateway 仍保留旧 `message.send` 事件链路（调用旧 `sendMessage`）。**  
   - 文件：`apps/backend/src/modules/message/gateways/message.gateway.ts`  
   - 风险：协议面仍有“旧链路入口”，容易在后续接入/测试时误用。

### 8.3 当前状态结论（更新）

- “已分析问题是否全部修复”：**否**。  
- 已完成：Rust 核心加解密与会话建立主链路、后端 `send-v2` 主干、构建可通过。  
- 未完成：发送端 `send-v2 + 全设备 fan-out`、转发在 v2 下的 envelope 化、旧回退路径收口。
