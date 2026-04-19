## Why

当前项目已经具备可用的安全聊天基础能力，但距离“2.0 完整产品闭环”仍有明显断层：账户恢复链路不完整、群聊只有基础收发没有治理能力、桌面端本地同步与断线恢复仍有占位逻辑。这些问题会让应用停留在可演示状态，而不是可持续使用的正式版本。

现在推进 2.0 的原因很直接：Signal Rust 主链路、直聊多设备、通知控制和群聊基础路径已经打通，仓库已经具备继续向产品完成态收口的条件。后续需要做的是补上产品闭环，而不是继续堆叠孤立特性。

## What Changes

- 完成账户安全闭环：注册密码策略、忘记密码/重置密码、设备与账户身份的一致性校验、登录异常恢复。
- 完成群聊产品闭环：群信息修改、成员增删与权限边界、退群/踢人后的可见行为、与 Rust Sender Key 生命周期对齐。
- 完成消息同步闭环：桌面端本地消息收敛、重连后的补拉与补投、失败重试、会话摘要与历史回显策略统一。
- 完成 2.0 发布闭环：把后端、Rust、桌面端、真实账号冒烟的回归矩阵升级为“版本 gate”，并补齐 2.0 文档与运维说明。
- 明确阶段边界：本变更只完成“聊天产品 2.0 核心闭环”，不在本阶段兑现桌面端除聊天核心外的全部产品表层设计，不纳入音频/视频通话能力。
- 明确协作边界：GPT 负责协议、安全、状态机、跨层一致性和发布治理等重点难点能力；MiniMax 负责低风险 UI 接入、配套页面、文档整理和支撑性整合事项。
- 明确分支治理：若后续工作属于新 change，而不是当前 2.0 闭环范围，则必须先将当前实现分支合并到 `main`，再从最新 `main` 拉取新分支开发。
- **BREAKING**: 收紧现有兼容降级行为，对不满足设备上下文、身份信任或消息状态前置条件的路径改为显式报错，而不是静默回退。

## Capabilities

### New Capabilities
- `account-recovery-and-auth-hardening`: 账户安全、密码策略、忘记密码与异常登录恢复能力。
- `group-governance-and-lifecycle`: 群资料管理、成员治理、退出/移除/重入及其可见行为规则。
- `conversation-sync-and-reliability`: 本地消息同步、断线恢复、失败重试、会话摘要与历史一致性。
- `v2-release-operability`: 2.0 发布门槛、回归矩阵、运维与版本说明。

### Modified Capabilities
- `device-bound-transport-convergence`: 把 direct message 的设备绑定要求扩展到断线重试、自同步、失败恢复与本地回放一致性。
- `group-rust-signal-messaging`: 把群聊能力从“基础可发可收”扩展为“带成员治理与 Sender Key 生命周期的完整群组行为”。
- `notification-delivery-controls`: 把通知设置扩展到密码重置、群成员变更、系统安全事件等 2.0 新事件类型。
- `release-regression-governance`: 把发布门槛从当前阶段性完成标准升级为 2.0 正式版本门槛。

## Impact

- Backend: `auth`, `user`, `friend`, `conversation`, `group`, `message`, `notification`, `mail` 模块与相关 DTO / entity / tests。
- Desktop: 登录注册/找回密码流程、群管理基础接入、会话列表与消息同步、本地数据库与重连恢复逻辑。
- Rust/Tauri: 群成员变化后的 Sender Key 生命周期约束、错误模型与历史回放验证。
- API / contract: 新增或扩展密码重置、群管理、同步恢复、系统通知相关接口。
- Docs / ops: README、2.0 回归矩阵、真实账号冒烟步骤、部署与运维说明，以及下一阶段桌面产品面闭环的分支治理约束。
