#!/bin/bash
# Security Chat 完整部署脚本
# 在服务器上执行：bash deploy.sh

set -e

echo "======================================"
echo "Security Chat 部署脚本"
echo "======================================"

# 进入目录
cd /opt/security-chat

echo ""
echo "步骤 1: 登录阿里云镜像仓库"
echo "======================================"
# 请手动执行：docker login --username=alexleej crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com
echo "请先执行以下命令登录："
echo "docker login --username=alexleej crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com"
echo "按回车继续..."
read -p ""

echo ""
echo "步骤 2: 拉取镜像"
echo "======================================"
docker pull crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/node:20-alpine
docker pull crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/postgres:16-alpine
docker pull crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/redis:7-alpine
docker pull crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/nginx:alpine

echo ""
echo "步骤 3: 修改 docker-compose 配置"
echo "======================================"
cp docker-compose.prod.yml docker-compose.prod.yml.bak

# 使用更简单的替换方式
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  api:
    image: crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/node:20-alpine
    container_name: security-chat-api
    working_dir: /app
    command: sh -c "npm install -g pnpm && pnpm install --prod && pnpm start"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - LOG_HTTP=${LOG_HTTP:-1}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - security_chat_net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

  postgres:
    image: crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/postgres:16-alpine
    container_name: security-chat-postgres
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - security_chat_net
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/redis:7-alpine
    container_name: security-chat-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - security_chat_net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com/jerrylee_image/nginx:alpine
    container_name: security-chat-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/logs:/var/log/nginx
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - security_chat_net
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  security_chat_net:
    driver: bridge
EOF

echo "配置已更新"
grep "image:" docker-compose.prod.yml

echo ""
echo "步骤 4: 创建环境变量"
echo "======================================"
DB_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -hex 32)

cat > .env.production << EOF
DB_USER=security_chat_user
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=security_chat
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
PORT=3000
LOG_HTTP=1
EOF

echo ""
echo "======================================"
echo "请保存以下密码！"
echo "======================================"
echo "DB_PASSWORD=${DB_PASSWORD}"
echo "REDIS_PASSWORD=${REDIS_PASSWORD}"
echo "JWT_SECRET=${JWT_SECRET}"
echo "======================================"
echo ""

echo "步骤 5: 启动服务"
echo "======================================"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "步骤 6: 查看状态"
echo "======================================"
docker compose ps

echo ""
echo "步骤 7: 验证服务"
echo "======================================"
sleep 10
curl http://localhost/api/v1/health || echo "服务可能还在启动中，请稍后重试"

echo ""
echo "======================================"
echo "部署完成！"
echo "======================================"
echo ""
echo "常用命令："
echo "  docker compose ps                    # 查看状态"
echo "  docker compose logs -f               # 查看日志"
echo "  docker compose restart               # 重启服务"
echo "  curl http://localhost/api/v1/health  # 健康检查"
echo ""
