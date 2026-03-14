# Desktop Client Review - 问题记录

**Review 日期:** 2026-03-02  
**Review 范围:** `/apps/desktop/src` 完整功能审查  
**UI 风格:** Telegram Desktop 风格优化已完成

---

## 📋 问题汇总

| 优先级 | 类别 | 问题数 |
|--------|------|--------|
| 🔴 P0 | 严重问题 | 3 |
| 🟠 P1 | 高优先级 | 5 |
| 🟡 P2 | 中优先级 | 8 |
| 🟢 P3 | 低优先级/优化 | 6 |

---

## 🔴 P0 - 严重问题 (Critical)

### 1. 消息加密仅为 Base64 编码，非真正加密

**位置:** `src/core/api.ts:136-137`

```typescript
const encryptedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
```

**问题描述:**
- 当前 `encryptedPayload` 仅使用 Base64 编码，任何人都可以解码
- 没有使用端到端加密 (E2EE)
- 与产品名 "Security Chat" 严重不符

**影响:** 安全聊天应用的核心功能缺失，用户隐私无法保障

**建议修复:**
```typescript
// 应使用 Web Crypto API 实现真正的加密
async function encryptPayload(payload: string, publicKey: CryptoKey): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    encoded
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
```

---

### 2. 敏感数据存储在 localStorage 无加密

**位置:** `src/core/use-chat-client.ts:23-25`

```typescript
const MESSAGE_CURSOR_STORAGE_KEY = 'security-chat.desktop.message-cursors.v1';
const MESSAGE_DRAFT_STORAGE_KEY = 'security-chat.desktop.message-drafts.v1';
const CONVERSATION_PREF_STORAGE_KEY = 'security-chat.desktop.conversation-prefs.v1';
```

**问题描述:**
- 消息草稿、会话偏好等敏感数据明文存储在 localStorage
- 任何有浏览器访问权限的人都可以读取
- 包含未发送的消息内容、已读状态等隐私信息

**建议修复:**
- 使用 IndexedDB + Web Crypto API 加密存储
- 或使用 `sessionStorage` 替代（会话结束自动清除）
- 至少对敏感字段进行加密

---

### 3. 验证码明文显示在 UI 中

**位置:** `src/core/api.ts:54`, `src/features/auth/login-screen.tsx:94`

```typescript
// api.ts
return res.data.data; // 包含 debugCode

// login-screen.tsx
{props.codeHint || '发送验证码后输入 6 位数字即可登录。'}
```

**问题描述:**
- 生产环境不应该在响应中返回 `debugCode`
- 前端直接显示验证码，严重安全问题
- 仅应在开发/测试环境启用

**建议修复:**
```typescript
// 后端应仅在开发环境返回 debugCode
if (process.env.NODE_ENV === 'development') {
  setCodeHint(result.debugCode ? `验证码：${result.debugCode}` : '验证码已发送');
}
```

---

## 🟠 P1 - 高优先级 (High)

### 4. WebSocket 断线重连机制不完善

**位置:** `src/core/use-chat-client.ts:588-618`

**问题描述:**
- 仅在 `disconnect` 事件时启动 fallback polling
- 没有指数退避重连策略
- 没有重连状态提示用户
- Socket 连接失败时 UI 无反馈

**建议修复:**
```typescript
// 添加重连状态
const [socketStatus, setSocketStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

// 实现指数退避
const reconnectWithBackoff = () => {
  const delays = [1000, 2000, 5000, 10000, 30000];
  // ...
};
```

---

### 5. 消息发送失败无重试机制

**位置:** `src/core/use-chat-client.ts:378-408`

```typescript
catch {
  setError('发送消息失败，请稍后重试。');
} finally {
  setSendingMessage(false);
}
```

**问题描述:**
- 发送失败后用户需手动重试
- 没有自动重试队列
- 失败消息无状态标记（用户不知道哪些消息发送失败）

**建议修复:**
- 实现消息发送队列
- 失败消息标记为红色/感叹号
- 提供"点击重试"功能
- 自动重试 3 次（指数退避）

---

### 6. 媒体文件上传无进度显示

**位置:** `src/core/use-chat-client.ts:410-429`

**问题描述:**
- 大文件上传时用户不知道进度
- 无法取消上传
- 上传失败无具体错误信息

**建议修复:**
```typescript
// axios 支持上传进度
const res = await http.post('/media/upload', formData, {
  headers: { 'content-type': 'multipart/form-data' },
  onUploadProgress: (progressEvent) => {
    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    setUploadProgress(percent);
  }
});
```

---

### 7. 已读回执可能重复发送

**位置:** `src/core/use-chat-client.ts:210-220`

```typescript
if (maxIndex > 0) {
  await Promise.all([ackDelivered(conversationId, maxIndex), ackRead(conversationId, maxIndex)])
}
```

**问题描述:**
- 每次加载消息都会发送已读回执
- 切换会话时可能重复标记已读
- 增加服务器负担

**建议修复:**
- 本地缓存已发送的已读回执
- 使用防抖 (debounce) 减少请求频率
- 仅当有新消息时才发送已读

---

### 8. 焚毁消息仅在本地过滤，服务端状态不同步

**位置:** `src/core/use-chat-client.ts:178-187`, `636-651`

```typescript
setMessages((prev) => prev.filter((row) => !isBurnExpired(row, nowMs)));
```

**问题描述:**
- 焚毁消息只在客户端 UI 隐藏
- 如果用户刷新页面，消息会重新出现（直到服务端真正删除）
- 本地定时器和服务器状态可能不一致

**建议修复:**
- 服务端应主动推送焚毁事件
- 客户端收到 `burn.triggered` 后立即移除
- 添加本地缓存清理机制

---

## 🟡 P2 - 中优先级 (Medium)

### 9. 默认账号密码硬编码

**位置:** `src/core/use-chat-client.ts:154-155`

```typescript
const [account, setAccount] = useState('alice');
const [password, setPassword] = useState('Password123');
```

**问题描述:**
- 开发测试账号硬编码
- 用户可能误用这些默认值
- 不应出现在生产代码中

**建议:** 移除默认值或添加环境检查

---

### 10. 错误处理过于笼统

**位置:** 多处 `catch { setError('...') }`

**问题描述:**
- 所有错误都显示相同提示
- 无法区分网络错误、认证错误、服务器错误
- 用户无法获得有用的排错信息

**建议修复:**
```typescript
catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      setError('认证失败，请重新登录');
    } else if (error.code === 'ECONNABORTED') {
      setError('请求超时，请检查网络');
    } else {
      setError(`错误：${error.response?.data?.message || '请稍后重试'}`);
    }
  }
}
```

---

### 11. 输入框无防抖/节流

**位置:** `src/features/chat/chat-panel.tsx`, `conversation-sidebar.tsx`

**问题描述:**
- 搜索输入每次按键都触发
- 消息草稿每次变化都写 localStorage
- 可能造成性能问题

**建议:** 使用 `lodash.debounce` 或自定义 hook

---

### 12. 好友列表无分页/虚拟滚动

**位置:** `src/features/friend/friend-panel.tsx`

**问题描述:**
- 好友数量多时会卡顿
- 没有实现虚拟滚动
- 搜索功能也未分页

**建议:** 实现虚拟列表 (react-window 或 react-virtual)

---

### 13. 无键盘快捷键帮助文档

**位置:** `src/App.tsx:13-26`

```typescript
// 仅实现了 Cmd/Ctrl+K 聚焦搜索
```

**问题描述:**
- 快捷键分散在各组件
- 用户不知道有哪些快捷键
- 没有统一的快捷键管理

**建议:**
- 创建快捷键中心 (使用 `react-hotkeys-hook`)
- 添加快捷键帮助面板 (Cmd+/)
- 允许用户自定义快捷键

---

### 14. 头像仅显示姓名首字母

**位置:** `src/features/chat/chat-panel.tsx:68-70`

```typescript
function getInitial(name?: string): string {
  return (name?.trim().slice(0, 2) ?? 'SC').toUpperCase();
}
```

**问题描述:**
- `ConversationListItem` 和 `FriendListItem` 都有 `avatarUrl` 字段但未使用
- 用户无法看到真实头像

**建议:** 优先使用 `avatarUrl`，降级到首字母

---

### 15. 消息类型标签显示冗余

**位置:** `src/features/chat/chat-panel.tsx:72-77`

```typescript
function messageTypeLabel(messageType: number): string {
  if (messageType === 2) return '图片';
  if (messageType === 3) return '语音';
  if (messageType === 4) return '文件';
  return '文本';
}
```

**问题描述:**
- 每条消息都显示类型标签（文本、图片等）
- Telegram 风格不显示这些标签
- 占用宝贵空间

**建议:** 移除文本标签，用图标替代媒体类型

---

### 16. 无离线模式支持

**位置:** 全局

**问题描述:**
- 断网后应用完全不可用
- 没有 Service Worker 缓存
- 历史消息无法离线查看

**建议:** 添加 PWA 支持，缓存静态资源和历史消息

---

## 🟢 P3 - 低优先级/优化 (Low)

### 17. CSS 文件体积较大

**位置:** `src/styles.css`

**问题描述:**
- 单文件 1400+ 行 CSS
- 未使用 CSS-in-JS 或 CSS Modules
- 可能有未使用的样式

**建议:** 
- 使用 CSS Modules 或 Tailwind
- 添加 PurgeCSS 移除未使用样式
- 按组件拆分样式文件

---

### 18. 无深色模式切换按钮

**位置:** `src/styles.css`

**问题描述:**
- CSS 定义了深色模式变量但未使用
- 用户无法手动切换主题
- 仅支持系统自动检测

**建议:** 添加主题切换按钮，支持手动切换

---

### 19. 时间格式化未考虑时区

**位置:** `src/features/chat/chat-panel.tsx:44-53`

```typescript
return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
```

**问题描述:**
- 使用本地时区格式化服务器时间
- 跨时区用户可能看到错误时间
- 服务器时间应为 UTC

**建议:** 使用 `date-fns-tz` 或 `dayjs` 处理时区

---

### 20. 无消息撤回功能

**位置:** API 和 UI 均未实现

**问题描述:**
- Telegram 核心功能之一
- 用户可能误发消息
- 需要服务端支持

**建议:** 添加消息撤回 API 和 UI

---

### 21. 无消息编辑功能

**位置:** API 和 UI 均未实现

**问题描述:**
- 发送后无法编辑消息
- 打错字只能重发

**建议:** 添加消息编辑功能（带编辑标记）

---

### 22. 无@提及功能

**位置:** 全局

**问题描述:**
- 群聊时无法@他人
- 无提及通知

**建议:** 添加@提及功能

---

### 23. 无消息回复/引用功能

**位置:** 全局

**问题描述:**
- 无法回复特定消息
- 群聊时上下文混乱

**建议:** 添加消息引用/回复功能

---

### 24. 无表情搜索

**位置:** `src/features/chat/chat-panel.tsx:13`

```typescript
const QUICK_EMOJIS = ['😀', '😂', '😍', ...]; // 仅 12 个
```

**问题描述:**
- 仅支持 12 个快速表情
- 无完整表情选择器
- 无 GIF/贴图支持

**建议:** 集成完整表情选择器（如 emoji-mart）

---

## ✅ 已完成的优化

### UI Telegram 风格优化

1. ✅ 颜色系统 - 采用 Telegram 官方色板 (#3390ec 品牌色)
2. ✅ 消息气泡 - 圆角优化、发送/接收不同背景色
3. ✅ 聊天背景 - 添加 Telegram 风格图案
4. ✅ 交互动画 - 平滑过渡效果
5. ✅ 侧边栏 - 清晰的层级和选中状态
6. ✅ 输入框 - 现代化圆角设计
7. ✅ 滚动条 - 自定义美化
8. ✅ 响应式 - 支持移动端
9. ✅ 减少动画 - 支持 `prefers-reduced-motion`

---

## 📝 建议的新功能

1. **消息置顶** - 重要消息置顶
2. **消息收藏** - 收藏重要消息
3. **文件夹/标签** - 会话分类管理
4. **夜间模式定时切换** - 自动根据时间切换主题
5. **消息定时发送** - 预约发送时间
6. **聊天背景自定义** - 每个会话独立背景
7. **隐私设置** - 在线状态、最后上线时间控制
8. **双因素认证** - 增强账户安全
9. **设备管理** - 查看和管理登录设备
10. **数据导出** - 导出聊天记录

---

## 🔧 技术债务

1. TypeScript 配置未严格模式
2. 无单元测试
3. 无 E2E 测试
4. 无代码覆盖率要求
5. 无性能监控
6. 无错误追踪 (Sentry 等)
7. 无用户行为分析
8. 无 A/B 测试框架

---

## 📊 代码质量指标

| 指标 | 当前状态 | 目标 |
|------|----------|------|
| TypeScript 严格度 | 中等 | 严格 |
| 组件复用性 | 低 | 高 |
| 错误边界 | 无 | 全局覆盖 |
| 加载状态 | 部分 | 全部 |
| 空状态处理 | 良好 | 优秀 |
| 可访问性 (a11y) | 基础 | WCAG 2.1 AA |

---

**下一步行动:**

1. 优先修复 P0 安全问题（加密、存储）
2. 实现 P1 用户体验问题（重连、重试、进度）
3. 逐步优化 P2/P3 问题
4. 规划新功能开发

---

*文档最后更新：2026-03-02*
