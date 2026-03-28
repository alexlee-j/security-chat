# Tauri 重构方案 - 可行性确认

**日期**: 2026-03-28  
**状态**: ✅ 技术可行

---

## 一、核心发现

### @signalapp/libsignal-client 支持情况

✅ **有完整的 Rust 实现**
- 位置：`libsignal/rust/protocol/`
- 包名：`libsignal-protocol`
- Rust 版本：1.85+

✅ **有 Node.js 绑定**
- 包名：`@signalapp/libsignal-client`
- 版本：0.90.0
- 许可证：AGPL-3.0-only

### 结论

**Tauri + 官方库方案完全可行！**

---

## 二、推荐架构

### 方案 A: 纯 Rust 后端 (推荐)

```
Frontend (React)
    ↓
Tauri Commands (Rust)
    ↓
libsignal-protocol (Rust)
    ↓
SQLite (本地存储)
```

**优点**:
- 最佳性能
- 最小包体积
- 最高安全性
- 完整的 Rust 类型安全

**缺点**:
- 需要 Rust 开发能力
- 开发周期较长 (10-15 天)

### 方案 B: Node.js 桥接 (备选)

```
Frontend (React)
    ↓
@signalapp/libsignal-client (Node.js)
    ↓
Tauri Node.js 插件
```

**优点**:
- 开发周期短 (5-7 天)
- 熟悉的 JavaScript API

**缺点**:
- 包体积较大
- 需要 Node.js 运行时
- 性能略差

---

## 三、实施建议

### 推荐方案 A (纯 Rust)

#### 第一阶段：原型验证 (2 天)
```bash
# 1. 创建 Tauri 项目
cd apps/desktop
pnpm create tauri-app

# 2. 添加 libsignal-protocol 依赖
# 在 src-tauri/Cargo.toml 中添加:
# libsignal-protocol = { git = "https://github.com/signalapp/libsignal.git" }

# 3. 实现最小功能
# - 密钥生成
# - 消息加密
# - 消息解密
```

#### 第二阶段：核心功能 (5 天)
- [ ] X3DH 密钥交换
- [ ] Double Ratchet
- [ ] SQLite 集成
- [ ] 消息存储

#### 第三阶段：UI 迁移 (5 天)
- [ ] 登录界面
- [ ] 聊天界面
- [ ] 联系人界面

#### 第四阶段：测试发布 (3 天)
- [ ] 端到端测试
- [ ] 打包发布
- [ ] 代码签名

**总计**: 15 天

---

## 四、下一步

### 立即行动

1. **创建 Tauri 原型**
   ```bash
   cd apps/desktop
   pnpm create tauri-app
   ```

2. **测试 libsignal-protocol**
   ```bash
   cd apps/desktop/src-tauri
   # 添加依赖并测试
   ```

3. **确认开发流程**
   - Rust 工具链
   - Tauri 开发模式
   - 热更新配置

### 决策点

- [ ] 确认采用方案 A (纯 Rust)
- [ ] 确认开发时间 (15 天)
- [ ] 确认人员安排

---

## 五、参考资源

### 官方文档
- [Tauri 文档](https://tauri.app/)
- [libsignal GitHub](https://github.com/signalapp/libsignal)
- [Signal 协议文档](https://signal.org/docs/)

### 示例项目
- [Tauri 示例](https://github.com/tauri-apps/tauri/tree/dev/examples)
- [libsignal Node 示例](https://github.com/signalapp/libsignal/tree/main/node)

---

**创建时间**: 2026-03-28  
**技术负责人**: Qwen Code B  
**建议方案**: 方案 A (纯 Rust)
