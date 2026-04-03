#!/bin/bash
# 阿里云镜像推送脚本
# 使用方法：./push-to-acr.sh

set -e

echo "======================================"
echo "Security Chat 镜像推送到阿里云 ACR"
echo "======================================"

# 配置
ACR_REGISTRY="crpi-68tz69javkqd0gw3.cn-shenzhen.personal.cr.aliyuncs.com"
ACR_USERNAME="alexleej"
IMAGE_NAME="security-chat-backend"
IMAGE_TAG="v2.0"

echo ""
echo "镜像信息："
echo "  仓库：${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:${IMAGE_TAG}"
echo "  架构：linux/amd64"
echo "  系统：Ubuntu/Alpine"
echo ""

# 登录阿里云镜像仓库
echo "正在登录阿里云镜像仓库..."
docker login --username=${ACR_USERNAME} ${ACR_REGISTRY}
if [ $? -ne 0 ]; then
    echo "❌ 登录失败，请检查用户名和密码"
    exit 1
fi
echo "✅ 登录成功"

# 标记镜像
echo ""
echo "正在标记镜像..."
docker tag ${IMAGE_NAME}:test ${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:${IMAGE_TAG}
docker tag ${IMAGE_NAME}:test ${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:latest
echo "✅ 标记完成"

# 推送镜像
echo ""
echo "正在推送镜像到阿里云..."
echo "这可能需要 5-10 分钟，请耐心等待..."

docker push ${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:${IMAGE_TAG}
if [ $? -eq 0 ]; then
    echo "✅ ${IMAGE_TAG} 推送成功"
else
    echo "❌ ${IMAGE_TAG} 推送失败"
    exit 1
fi

docker push ${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:latest
if [ $? -eq 0 ]; then
    echo "✅ latest 推送成功"
else
    echo "❌ latest 推送失败"
fi

echo ""
echo "======================================"
echo "推送完成！"
echo "======================================"
echo ""
echo "镜像地址："
echo "  ${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:${IMAGE_TAG}"
echo "  ${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:latest"
echo ""
echo "在 Ubuntu AMD64 服务器上拉取："
echo "  docker pull ${ACR_REGISTRY}/jerrylee_image/${IMAGE_NAME}:latest"
echo ""
