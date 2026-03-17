# Playwright E2E 测试报告

**测试日期**: 2026-03-16  
**测试环境**: Windows 11 + Docker Desktop  
**前端地址**: http://127.0.0.1:4173  
**后端地址**: http://127.0.0.1:3000/api/v1

---

## 测试概览

| 测试类别 | 测试项 | 状态 | 备注 |
|---------|-------|------|------|
| 服务启动 | Docker 服务启动 | ✅ 通过 | PostgreSQL, Redis, MinIO 正常运行 |
| 服务启动 | 后端服务启动 | ✅ 通过 | NestJS 后端正常运行 |
| 服务启动 | 前端服务启动 | ✅ 通过 | Vite + React 前端正常运行 (IPv4) |
| UI 测试 | 登录页面显示 | ✅ 通过 | 页面元素完整渲染 |
| UI 测试 | 注册页面切换 | ✅ 通过 | 可正常切换到注册表单 |
| UI 测试 | 验证码登录切换 | ✅ 通过 | 可正常切换到验证码表单 |
| 表单验证 | 空表单验证 | ✅ 通过 | 显示"请完整填写账号、邮箱和密码" |
| 表单验证 | 用户名长度验证 | ✅ 通过 | 显示"账号长度需在 3-50 个字符之间" |
| 表单验证 | 邮箱格式验证 | ✅ 通过 | 显示"请输入有效的邮箱地址" |
| 表单验证 | 密码长度验证 | ✅ 通过 | 显示"密码长度需在 8-64 个字符之间" |
| 认证测试 | 密码登录 | ✅ 通过 | 成功登录并进入聊天界面 |
| 会话测试 | 创建单聊会话 | ✅ 通过 | 可通过用户 ID 创建会话 |
| 消息测试 | 发送文本消息 | ✅ 通过 | 消息成功发送并显示 |

---

## 测试方法（供后续 AI 参考）

### 前置条件

1. **确保 Docker 服务运行**
   ```bash
   docker-compose ps
   ```
   确认 PostgreSQL、Redis、MinIO 容器状态为 `Up`

2. **确保后端服务运行**
   ```bash
   curl http://127.0.0.1:3000/api/v1/health
   ```
   应返回 `{"success":true,"data":{"status":"ok"}}`

3. **确保前端服务运行**
   ```bash
   curl http://127.0.0.1:4173
   ```
   应返回 HTML 页面内容

---

### Playwright MCP 工具使用方法

本项目使用 **Playwright MCP 工具** 进行浏览器自动化测试。以下是详细的测试方法和步骤：

#### 1. 导航到页面

```typescript
// 访问应用首页（使用 IPv4 地址）
mcp__playwright__browser_navigate
  url: "http://127.0.0.1:4173"
```

**说明**: 
- 前端配置为监听 IPv4 地址 `127.0.0.1:4173`
- 避免使用 IPv6 地址 `http://[::1]:4173`

#### 2. 获取页面快照

```typescript
// 获取当前页面的可访问性快照
mcp__playwright__browser_snapshot
```

**说明**: 
- 返回页面所有可交互元素的引用（ref）
- 用于定位按钮、输入框等元素
- 比截图更适合自动化操作

#### 3. 点击元素

```typescript
// 点击按钮
mcp__playwright__browser_click
  element: "立即注册按钮"  // 人类可读的元素描述
  ref: "e25"               // 从 snapshot 获取的精确引用
```

**说明**: 
- `element`: 用于文档化和权限确认
- `ref`: 从 snapshot 中获取的精确元素引用

#### 4. 填写表单

```typescript
// 填写多个表单字段
mcp__playwright__browser_fill_form
  fields:
    - name: "用户名"
      ref: "e31"
      type: "textbox"
      value: "testuser"
    - name: "密码"
      ref: "e37"
      type: "textbox"
      value: "Test123456"
```

**说明**: 
- 可一次性填写多个字段
- `type` 可选值：`textbox`, `checkbox`, `radio`, `combobox`, `slider`

#### 5. 输入文本（支持快捷键）

```typescript
// 输入文本并提交
mcp__playwright__browser_type
  element: "消息输入框"
  ref: "e139"
  text: "Hello, this is a test message!"
  submit: true    // 输入后按 Enter
  slowly: false   // 是否逐字输入（触发键盘事件）
```

#### 6. 截图

```typescript
// 截取当前视口
mcp__playwright__browser_take_screenshot
  filename: "page-logined.png"
  type: "png"
  fullPage: false   // 是否截取整个页面
```

#### 7. 检查控制台日志

```typescript
// 获取控制台消息
mcp__playwright__browser_console_messages
  level: "error"    // 可选：error, warning, info, debug
```

#### 8. 检查网络请求

```typescript
// 获取网络请求记录
mcp__playwright__browser_network_requests
  includeStatic: false   // 是否包含静态资源请求
```

#### 9. 关闭浏览器

```typescript
mcp__playwright__browser_close
```

---

### 完整测试流程示例

以下是一个完整的登录测试流程：

```typescript
// 1. 导航到登录页面
mcp__playwright__browser_navigate
  url: "http://127.0.0.1:4173"

// 2. 获取页面快照，确认元素
mcp__playwright__browser_snapshot
// 返回包含登录表单的 snapshot

// 3. 填写登录信息
mcp__playwright__browser_fill_form
  fields:
    - name: "用户名"
      ref: "e18"
      type: "textbox"
      value: "admin"
    - name: "密码"
      ref: "e21"
      type: "textbox"
      value: "Admin123456"

// 4. 点击登录按钮
mcp__playwright__browser_click
  element: "登录按钮"
  ref: "e22"

// 5. 等待页面跳转（可通过 snapshot 确认）
mcp__playwright__browser_snapshot
// 确认已进入聊天主界面

// 6. 截图记录
mcp__playwright__browser_take_screenshot
  filename: "login-success.png"
```

---

### 元素定位策略

从 `browser_snapshot` 返回的 YAML 中定位元素：

```yaml
# snapshot 示例
- main [ref=e3]:
  - generic [ref=e6]:
    - button "登录" [ref=e22] [cursor=pointer]
    - textbox "请输入用户名" [ref=e18]
```

**定位方法**:
1. 找到目标元素的 `ref` 值（如 `e22`）
2. 在后续操作中使用该 `ref`
3. `element` 描述应准确反映元素功能

**常见元素类型**:
- `button`: 按钮
- `textbox`: 文本输入框
- `heading`: 标题
- `img`: 图片
- `navigation`: 导航区域

---

### 测试数据准备

#### 创建测试用户

```bash
# 运行测试用户创建脚本
node tests/create-test-users.js
```

**输出**:
```
创建测试用户...
✓ 用户 admin 创建成功
✓ 用户 testuser 创建成功
...
```

#### 查询用户 ID（UUID）

```bash
docker exec security_chat_postgres psql -U security_chat_user -d security_chat \
  -c "SELECT id, username FROM users;"
```

---

### 常见问题排查

#### 1. CORS 错误

**症状**: 前端请求被后端拒绝
```
Access to XMLHttpRequest at 'http://127.0.0.1:3000/...' 
blocked by CORS policy
```

**排查**:
```bash
# 测试 CORS 预检请求
curl -X OPTIONS http://127.0.0.1:3000/api/v1/auth/login \
  -H "Origin: http://127.0.0.1:4173" \
  -H "Access-Control-Request-Method: POST" -i
```

**修复**: 检查后端 `main.ts` 的 CORS 配置，确保允许 `http://127.0.0.1:4173`

#### 2. 服务未响应

**排查步骤**:
```bash
# 检查端口监听
netstat -ano | findstr :3000
netstat -ano | findstr :4173

# 检查 Docker 容器
docker-compose ps

# 检查后端健康
curl http://127.0.0.1:3000/api/v1/health
```

#### 3. Playwright 元素定位失败

**症状**: `TimeoutError: locator.click: Timeout 5000ms exceeded`

**原因**: 
- 元素被其他元素遮挡
- 元素尚未渲染
- `ref` 引用过期

**解决方案**:
1. 重新获取 snapshot
2. 检查是否有弹窗/菜单遮挡
3. 先关闭遮挡元素

---

## 测试详情

### 1. 服务启动测试

#### Docker 服务
```bash
docker-compose up -d
```
- ✅ PostgreSQL (port 5432) - 正常运行
- ✅ Redis (port 6379) - 正常运行  
- ✅ MinIO (port 9000/9001) - 正常运行

#### 后端服务
```bash
pnpm start:backend:dev
```
- ✅ NestJS 后端启动成功
- ✅ 健康检查接口 `/api/v1/health` 返回正常

#### 前端服务
```bash
pnpm start:desktop
```
- ✅ Vite 开发服务器启动成功
- ✅ 页面可正常访问 (http://127.0.0.1:4173)

---

### 2. UI 功能测试

#### 登录页面
- 页面标题："Security Chat Desktop"
- Logo 图标正常显示
- 用户名输入框正常
- 密码输入框正常
- 登录按钮正常
- "立即注册"链接正常
- "使用验证码登录"链接正常

#### 注册页面
- 切换到注册表单正常
- 用户名、邮箱、密码输入框正常
- 表单验证逻辑正常
- "立即登录"返回链接正常

#### 验证码登录页面
- 切换到验证码表单正常
- 账号输入框正常
- 验证码输入框正常
- "发送验证码"按钮正常

---

### 3. 配置说明

#### 前端 IPv4 配置

修改 `apps/desktop/vite.config.ts`:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    host: '127.0.0.1',  // 使用 IPv4 地址
  },
});
```

#### 后端 CORS 配置

修改 `apps/backend/src/main.ts`:
```typescript
const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.enableCors({
  origin: (origin: string | undefined, callback) => {
    if (!origin || localhostPattern.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`), false);
  },
  credentials: true,
});
```

---

### 4. 加密消息测试

#### 发现的问题
- ⚠️ 消息加密/解密有警告日志
- ⚠️ Signal 协议密钥未正确初始化时，消息以 Base64 明文传输

**错误日志**:
```
Encryption failed, falling back to Base64
Failed to decrypt message: Error: 公钥字节数组为空
```

**建议**: 注册流程需要完整实现 Signal 协议密钥生成和交换

---

## 测试截图

- `page-ipv4-test.png` - IPv4 测试截图（包含已发送的消息）

---

## 测试用户数据

已创建以下测试用户（密码哈希存储在数据库中）:

| 用户名 | 密码 | 用户 ID |
|-------|------|--------|
| admin | Admin123456 | ce1b0706-c20f-4ca2-93a5-fd4778273a87 |
| testuser | Test123456 | 53664e1a-5f7b-4d6d-a29f-9ec3c6437804 |
| alice | Alice123456 | f3b9cef9-0ff8-4db2-a856-32dde5c36805 |
| bob | Bob123456 | 9b55e25e-5f79-43d9-ac92-aacf56c3261d |

---

## 测试脚本

### 创建测试用户
```bash
node tests/create-test-users.js
```

### Playwright 测试配置
- 配置文件：`tests/playwright.config.ts`
- 测试用例：`tests/playwright/e2e.test.ts`

---

## 总结

### 通过的功能
1. ✅ 服务启动和运行正常
2. ✅ 前端 UI 渲染正常
3. ✅ 表单验证逻辑完整
4. ✅ 用户登录功能正常
5. ✅ 会话创建功能正常
6. ✅ 消息发送功能正常（IPv4）

### 需要改进的功能
1. ⚠️ 注册流程需要完整实现 Signal 协议密钥生成
2. ⚠️ 端到端加密功能需要完善密钥交换机制
3. ⚠️ 验证码发送功能需要配置 SMTP 服务

---

**测试人员**: AI Assistant  
**报告生成时间**: 2026-03-16 23:18  
**测试方法版本**: v1.0 (IPv4)
