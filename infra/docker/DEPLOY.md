# Security Chat 生产环境部署指南

**版本**: v1.0
**更新日期**: 2026-04-03
**适用环境**: AMD64/x86_64 服务器

---

## 一、服务器要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 20 GB | 50 GB SSD |
| 系统 | Ubuntu 20.04+ / CentOS 8+ | Ubuntu 22.04 LTS |

---

## 二、部署前准备

### 2.1 安装 Docker 和 Docker Compose

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
apt-get update
apt-get install -y docker-compose

# 启动 Docker
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
docker-compose --version
```

### 2.2 创建项目目录

```bash
mkdir -p /opt/security-chat
cd /opt/security-chat
```

### 2.3 获取代码

```bash
git clone <repository_url> .
```

---

## 三、配置

### 3.1 环境变量配置

```bash
# 复制配置示例文件
cp .env.production.example .env.production

# 编辑配置文件
vim .env.production
```

**必须修改的配置**:

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `DB_PASSWORD` | PostgreSQL 密码 | 强密码（至少 16 位） |
| `REDIS_PASSWORD` | Redis 密码 | 强密码 |
| `JWT_SECRET` | JWT 密钥 | `openssl rand -base64 32` 生成 |

### 3.2 SSL 证书配置

```bash
# 创建 SSL 证书目录
mkdir -p nginx/ssl

# 方式一：使用 Let's Encrypt（推荐）
apt-get install -y certbot
certbot certonly --nginx -d www.silencelee.cn -d silencelee.cn

# 方式二：使用已有证书
cp your-certificate.crt nginx/ssl/certificate.crt
cp your-private-key.key nginx/ssl/private.key
```

---

## 四、部署

### 4.1 构建并启动所有服务

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### 4.2 查看服务状态

```bash
# 查看所有容器状态
docker-compose -f docker-compose.prod.yml ps

# 查看容器日志
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### 4.3 验证部署

```bash
# 健康检查
curl http://localhost/health

# API 端点
curl http://localhost/api/v1/health
```

---

## 五、服务说明

### 5.1 服务架构

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Nginx    │ :80, :443
                    │  (反向代理)  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌──────▼──────┐    ┌────▼────┐
    │   API   │      │    API      │    │  MinIO  │
    │ Backend │      │  (备用节点)  │    │ (存储)  │
    └────┬────┘      └─────────────┘    └─────────┘
         │
    ┌────▼────┐      ┌──────▼──────┐
    │ Postgres│      │    Redis    │
    │   (DB)  │      │   (缓存)    │
    └─────────┘      └─────────────┘
```

### 5.2 服务端口

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| Nginx | 80, 443 | 80, 443 | HTTP/HTTPS |
| API | 3000 | 仅内部 | 后端服务 |
| PostgreSQL | 5432 | 仅内部 | 数据库 |
| Redis | 6379 | 仅内部 | 缓存 |
| MinIO API | 9000 | 仅内部 | 对象存储 API |
| MinIO Console | 9001 | 仅内部 | 管理界面 |

### 5.3 数据持久化

| 卷 | 路径 | 说明 |
|----|------|------|
| `postgres_data` | `/var/lib/postgresql/data` | 数据库文件 |
| `redis_data` | `/data` | 缓存数据 |
| `minio_data` | `/data` | 对象存储数据 |

---

## 六、运维

### 6.1 常用命令

```bash
# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 重启特定服务
docker-compose -f docker-compose.prod.yml restart api

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 进入容器调试
docker exec -it security-chat-api sh
docker exec -it security-chat-postgres psql -U security_chat_user -d security_chat
```

### 6.2 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose -f docker-compose.prod.yml up -d --build
```

### 6.3 备份

```bash
# 备份数据库
docker exec security-chat-postgres pg_dump -U security_chat_user security_chat > backup_$(date +%Y%m%d).sql

# 备份 MinIO 数据
docker exec security-chat-minio mc mirror /data backup/minio_$(date +%Y%m%d) --overwrite
```

### 6.4 监控

- MinIO Console: `http://your-domain:9001`
- 健康检查: `http://your-domain/health`

---

## 七、故障排查

### 7.1 服务无法启动

```bash
# 检查 Docker 状态
docker ps -a

# 查看具体错误
docker-compose -f docker-compose.prod.yml logs
```

### 7.2 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker exec security-chat-postgres pg_isready

# 检查网络连接
docker exec security-chat-api ping postgres
```

### 7.3 API 返回 502

```bash
# 检查 API 服务状态
docker exec security-chat-api curl localhost:3000/api/v1/health

# 检查 Nginx 日志
docker exec security-chat-nginx tail -f /var/log/nginx/error.log
```

---

## 八、安全建议

1. **防火墙**: 仅开放 80/443 端口
2. **SSL**: 启用 HTTPS 并强制重定向
3. **密码**: 使用强密码并定期更换
4. **更新**: 定期更新 Docker 镜像
5. **备份**: 定期备份数据库和文件

---

**文档结束**
