/**
 * 文件名：api.ts
 * 所属模块：桌面端-API接口层
 * 核心作用：封装所有后端API调用，包括用户认证、消息收发、会话管理、好友关系、
 *          媒体文件上传下载等功能，统一处理请求拦截和错误处理
 * 核心依赖：axios、crypto加密模块、types类型定义
 * 创建时间：2024-01-01
 * 更新说明：2026-03-14 添加异步解密支持、转发消息接口、媒体下载接口
 */

import axios from 'axios';
import { encryptPayload, decryptPayload, decryptPayloadSync } from './crypto';
import {
  ApiEnvelope,
  AuthResult,
  BlockedFriendItem,
  ConversationListItem,
  FriendListItem,
  FriendSearchItem,
  MessageItem,
  PendingFriendItem,
} from './types';

/** API基础URL，可通过环境变量配置 */
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
/** WebSocket基础URL */
export const wsBaseUrl = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000/ws';

/** axios实例，统一配置baseURL和超时 */
const http = axios.create({ 
  baseURL: API_BASE, 
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 响应拦截器 - 统一错误处理
http.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error?.response?.status, error?.response?.data);
    // 打印完整的错误响应以便调试
    if (error?.response?.data?.error) {
      console.error('Error details:', JSON.stringify(error.response.data.error, null, 2));
    }
    return Promise.reject(error);
  }
);

/**
 * 发送消息输入参数
 */
export type SendMessageInput = {
  conversationId: string;
  messageType: 1 | 2 | 3 | 4;
  text: string;
  mediaUrl?: string;
  fileName?: string;
  mediaAssetId?: string;
  isBurn: boolean;
  burnDuration?: number;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };
  nonce?: string;
  sourceDeviceId?: string;
  encryptedPayload?: string; // Signal 加密后的 payload
};

type EncodedPayload = {
  v: 1;
  type: number;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };
};

export function setAuthToken(token: string | null): void {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('auth-token', token);
  } else {
    delete http.defaults.headers.common.Authorization;
    localStorage.removeItem('auth-token');
  }
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout');
}

export async function login(account: string, password: string, deviceId?: string): Promise<AuthResult> {
  const res = await http.post<ApiEnvelope<AuthResult>>('/auth/login', { account, password, deviceId });
  return res.data.data;
}

export async function sendLoginCode(input: { account?: string; phone?: string }): Promise<{ sent: true; expiresInSec: number; debugCode?: string }> {
  const res = await http.post<ApiEnvelope<{ sent: true; expiresInSec: number; debugCode?: string }>>(
    '/auth/login-code/send',
    input,
  );
  return res.data.data;
}

export async function loginWithCode(input: { account?: string; phone?: string; code: string; deviceId?: string }): Promise<AuthResult> {
  const res = await http.post<ApiEnvelope<AuthResult>>('/auth/login-code', input);
  return res.data.data;
}

export async function register(input: {
  username: string;
  email: string;
  phone: string;
  password: string;
  deviceName: string;
  deviceType: 'mac' | 'windows' | 'linux';
  identityPublicKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
}): Promise<AuthResult> {
  const res = await http.post<ApiEnvelope<AuthResult>>('/auth/register', input);
  return res.data.data;
}

export async function sendForgotPasswordCode(email: string): Promise<{ sent: true; message: string }> {
  const res = await http.post<ApiEnvelope<{ sent: true; message: string }>>('/auth/forgot-password/send', { email });
  return res.data.data;
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<{ success: true; message: string }> {
  const res = await http.post<ApiEnvelope<{ success: true; message: string }>>('/auth/forgot-password/reset', {
    email,
    code,
    newPassword,
  });
  return res.data.data;
}

export async function getConversations(limit = 50): Promise<ConversationListItem[]> {
  const res = await http.get<ApiEnvelope<ConversationListItem[]>>('/conversation/list', { params: { limit } });
  return res.data.data;
}

export async function createDirectConversation(peerUserId: string): Promise<{ conversationId: string }> {
  const res = await http.post<ApiEnvelope<{ conversationId: string }>>('/conversation/direct', { peerUserId });
  return res.data.data;
}

export async function getConversationMembers(conversationId: string): Promise<
  Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    role: number;
    joinedAt: string;
  }>
> {
  const res = await http.get<
    ApiEnvelope<
      Array<{
        userId: string;
        username: string;
        avatarUrl: string | null;
        role: number;
        joinedAt: string;
      }>
    >
  >(`/conversation/${conversationId}/members`);
  return res.data.data;
}

export async function getConversationBurnDefault(
  conversationId: string,
): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
  const res = await http.get<ApiEnvelope<{ conversationId: string; enabled: boolean; burnDuration: number | null }>>(
    `/conversation/${conversationId}/burn-default`,
  );
  return res.data.data;
}

export async function updateConversationBurnDefault(
  conversationId: string,
  enabled: boolean,
  burnDuration: number,
): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
  const res = await http.post<ApiEnvelope<{ conversationId: string; enabled: boolean; burnDuration: number | null }>>(
    `/conversation/${conversationId}/burn-default`,
    {
      enabled,
      burnDuration: enabled ? burnDuration : undefined,
    },
  );
  return res.data.data;
}

export async function deleteConversation(conversationId: string): Promise<{ deleted: boolean }> {
  const res = await http.delete<ApiEnvelope<{ deleted: boolean }>>(`/conversation/${conversationId}`);
  return res.data.data;
}

export async function getMessages(
  conversationId: string,
  afterIndex = 0,
  limit = 50,
  beforeIndex?: number,
): Promise<MessageItem[]> {
  const res = await http.get<ApiEnvelope<MessageItem[]>>('/message/list', {
    params: {
      conversationId,
      afterIndex,
      limit,
      beforeIndex: beforeIndex && beforeIndex > 0 ? beforeIndex : undefined,
    },
  });
  return res.data.data;
}

export async function getMessageById(messageId: string): Promise<MessageItem | null> {
  const res = await http.get<ApiEnvelope<MessageItem | null>>(`/message/${messageId}`);
  return res.data.data;
}

export async function sendMessage(input: SendMessageInput): Promise<{ messageId: string; messageIndex: string }> {
  // 如果提供了 Signal 加密后的 payload，直接使用
  // 否则使用默认的 Base64 编码
  let encryptedPayload: string;
  
  if (input.encryptedPayload) {
    encryptedPayload = input.encryptedPayload;
  } else {
    const payload: EncodedPayload = {
      v: 1,
      type: input.messageType,
    };

    if (input.text.trim()) {
      payload.text = input.text.trim();
    }
    if (input.mediaUrl?.trim()) {
      payload.mediaUrl = input.mediaUrl.trim();
    }
    if (input.fileName?.trim()) {
      payload.fileName = input.fileName.trim();
    }
    if (input.replyTo) {
      payload.replyTo = input.replyTo;
    }

    // 使用 Base64 编码而不是 AES-GCM 加密，以便前端能够正确解密自己发送的消息
    encryptedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }
  
  const nonce = input.nonce ?? crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const res = await http.post<ApiEnvelope<{ messageId: string; messageIndex: string }>>('/message/send', {
    conversationId: input.conversationId,
    messageType: input.messageType,
    encryptedPayload,
    nonce,
    sourceDeviceId: input.sourceDeviceId,
    mediaAssetId: input.mediaAssetId,
    isBurn: input.isBurn,
    burnDuration: input.isBurn ? input.burnDuration : undefined,
  });
  return res.data.data;
}

/**
 * 发送消息输入参数（v2 版本，支持多设备信封）
 */
type SendMessageV2Input = {
  conversationId: string;
  messageType: 1 | 2 | 3 | 4;
  nonce: string;
  envelopes: Array<{
    targetUserId: string;
    targetDeviceId: string;
    encryptedPayload: string;
  }>;
  mediaAssetId?: string;
  isBurn: boolean;
  burnDuration?: number;
};

export async function sendMessageV2(input: SendMessageV2Input): Promise<{ messageId: string; messageIndex: string }> {
  const res = await http.post<ApiEnvelope<{ messageId: string; messageIndex: string }>>('/message/send-v2', {
    conversationId: input.conversationId,
    messageType: input.messageType,
    nonce: input.nonce,
    envelopes: input.envelopes,
    mediaAssetId: input.mediaAssetId,
    isBurn: input.isBurn,
    burnDuration: input.isBurn ? input.burnDuration : undefined,
  });
  return res.data.data;
}

export async function uploadMedia(
  file: File,
  mediaKind?: 2 | 3 | 4,
): Promise<{ mediaAssetId: string; mediaKind: number; mimeType: string; fileSize: number; sha256: string; createdAt: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (mediaKind) {
    formData.append('mediaKind', String(mediaKind));
  }
  const res = await http.post<
    ApiEnvelope<{ mediaAssetId: string; mediaKind: number; mimeType: string; fileSize: number; sha256: string; createdAt: string }>
  >('/media/upload', formData, {
    headers: { 'content-type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function ackDelivered(conversationId: string, maxMessageIndex: number): Promise<void> {
  await http.post('/message/ack/delivered', { conversationId, maxMessageIndex });
}

export async function ackRead(conversationId: string, maxMessageIndex: number): Promise<void> {
  await http.post('/message/ack/read', { conversationId, maxMessageIndex });
}

export async function ackReadOne(messageId: string): Promise<void> {
  await http.post('/message/ack/read-one', { messageId });
}

export async function searchUsers(keyword: string, limit = 20): Promise<FriendSearchItem[]> {
  const res = await http.get<ApiEnvelope<FriendSearchItem[]>>('/friend/search', {
    params: { keyword, limit },
  });
  return res.data.data;
}

export async function requestFriend(targetUserId: string): Promise<void> {
  await http.post('/friend/request', { targetUserId });
}

export async function getIncomingRequests(): Promise<PendingFriendItem[]> {
  const res = await http.get<ApiEnvelope<PendingFriendItem[]>>('/friend/pending/incoming');
  return res.data.data;
}

export async function respondFriend(requesterUserId: string, accept: boolean): Promise<void> {
  await http.post('/friend/respond', { requesterUserId, accept });
}

export async function getFriends(): Promise<FriendListItem[]> {
  const res = await http.get<ApiEnvelope<FriendListItem[]>>('/friend/list');
  return res.data.data;
}

export async function getBlockedUsers(): Promise<BlockedFriendItem[]> {
  const res = await http.get<ApiEnvelope<BlockedFriendItem[]>>('/friend/blocked');
  return res.data.data;
}

export async function blockUser(targetUserId: string): Promise<void> {
  await http.post('/friend/block', { targetUserId });
}

export async function unblockUser(targetUserId: string): Promise<void> {
  await http.post('/friend/unblock', { targetUserId });
}

export async function triggerBurn(messageId: string): Promise<void> {
  await http.post('/burn/trigger', { messageId });
}

export async function revokeMessage(messageId: string): Promise<void> {
  await http.post('/message/ack/revoke', { messageId });
}

export async function forwardMessage(originalMessageId: string, conversationId: string, isBurn?: boolean, burnDuration?: number): Promise<{ messageId: string; messageIndex: string }> {
  const res = await http.post<ApiEnvelope<{ messageId: string; messageIndex: string }>>('/message/forward', {
    originalMessageId,
    conversationId,
    isBurn,
    burnDuration,
  });
  return res.data.data;
}

export async function downloadMedia(mediaAssetId: string): Promise<Blob> {
  const res = await http.get(`/media/${mediaAssetId}/download`, {
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function copyMediaAsset(mediaAssetId: string, conversationId: string): Promise<{ mediaAssetId: string; conversationId: string }> {
  const res = await http.post<ApiEnvelope<{ mediaAssetId: string; conversationId: string }>>(
    `/media/${mediaAssetId}/copy`,
    { conversationId },
  );
  return res.data.data;
}

export function decodePayload(payload: string): string {
  return decryptPayloadSync(payload);
}

export async function decodePayloadAsync(payload: string, password?: string): Promise<string> {
  return await decryptPayload(payload, password);
}

// Signal协议相关API

export interface SignalInfo {
  identityPublicKey: string;
  identityKeyFingerprint: string;
  registrationId: number;
  signalVersion: number;
}

export interface PrekeyBundle {
  registrationId: number;
  identityKey: string;
  signedPrekey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePrekey?: {
    preKeyId: string;
    keyId: number;
    publicKey: string;
  };
  kyberPrekey?: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
}

export interface PrekeyBundlePeek {
  registrationId: number;
  identityKey: string;
  signedPrekey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePrekeyAvailable: boolean;
  kyberPrekeyAvailable: boolean;
}

export interface PrekeyStats {
  total: number;
  used: number;
  available: number;
  needsReplenish: boolean;
}

export interface DeviceInfo {
  deviceId: string;
  identityPublicKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  registrationId: number | null;
}

export interface LinkingQRCode {
  temporaryToken: string;
  qrCodeData: string;
  expiresAt: Date;
}

export interface LinkingVerification {
  valid: boolean;
  userId?: string;
  fingerprint?: string;
  expiresAt?: Date;
}

export interface VerificationStatus {
  userId: string;
  fingerprint: string;
  isVerified: boolean;
  verifiedAt?: string;
  devices: Array<{
    deviceId: string;
    deviceName: string;
    fingerprint: string;
    isVerified: boolean;
  }>;
}

export interface IdentityKeyResponse {
  userId: string;
  identityKey: string;
  fingerprint: string;
  registrationId: number;
}

export async function getSignalInfo(): Promise<SignalInfo> {
  const res = await http.get<ApiEnvelope<SignalInfo>>('/user/signal/info');
  return res.data.data;
}

export async function verifyIdentityKey(deviceId: string, fingerprint: string): Promise<{ verified: boolean }> {
  const res = await http.post<ApiEnvelope<{ verified: boolean }>>('/user/signal/verify-key', { deviceId, fingerprint });
  return res.data.data;
}

export async function updateSignedPrekey(deviceId: string, signedPreKey: string, signedPreKeySignature: string): Promise<{ updated: boolean }> {
  const res = await http.put<ApiEnvelope<{ updated: boolean }>>('/user/signal/signed-prekey', { deviceId, signedPreKey, signedPreKeySignature });
  return res.data.data;
}

export async function getDevicesByUserIds(userIds: string[]): Promise<Array<{ userId: string; devices: DeviceInfo[] }>> {
  const res = await http.post<ApiEnvelope<Array<{ userId: string; devices: DeviceInfo[] }>>>('/user/signal/devices/batch', { userIds });
  return res.data.data;
}

export async function getPrekeyBundle(userId: string, deviceId: string): Promise<PrekeyBundle> {
  const res = await http.get<ApiEnvelope<PrekeyBundle>>(`/user/keys/bundle/${userId}/${deviceId}`);
  return res.data.data;
}

export async function peekPrekeyBundle(userId: string, deviceId: string): Promise<PrekeyBundlePeek> {
  const res = await http.get<ApiEnvelope<PrekeyBundlePeek>>(`/user/keys/bundle/${userId}/${deviceId}/peek`);
  return res.data.data;
}

export async function getPrekeyStats(deviceId: string): Promise<PrekeyStats> {
  const res = await http.get<ApiEnvelope<PrekeyStats>>(`/user/keys/prekeys/${deviceId}/stats`);
  return res.data.data;
}

// 设备链接API
export async function generateLinkingQRCode(deviceName: string, deviceType: string): Promise<LinkingQRCode> {
  const res = await http.post<ApiEnvelope<LinkingQRCode>>('/user/device/linking/qrcode', { deviceName, deviceType });
  return res.data.data;
}

export async function verifyLinkingToken(temporaryToken: string): Promise<LinkingVerification> {
  const res = await http.post<ApiEnvelope<LinkingVerification>>('/user/device/linking/verify', { temporaryToken });
  return res.data.data;
}

export interface LinkDeviceData {
  deviceName: string;
  deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
  identityPublicKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  registrationId?: number;
}

export async function confirmLinkDevice(temporaryToken: string, deviceData: LinkDeviceData): Promise<{ deviceId: string; success: boolean }> {
  const res = await http.post<ApiEnvelope<{ deviceId: string; success: boolean }>>('/user/device/linking/confirm', { temporaryToken, ...deviceData });
  return res.data.data;
}

// 密钥验证API
export async function verifyKey(userId: string, deviceId: string | undefined, fingerprint: string, isVerified: boolean): Promise<{ success: boolean; message: string }> {
  const res = await http.post<ApiEnvelope<{ success: boolean; message: string }>>('/user/keys/verify', { userId, deviceId, fingerprint, isVerified });
  return res.data.data;
}

export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const res = await http.get<ApiEnvelope<VerificationStatus>>(`/user/keys/verify/${userId}`);
  return res.data.data;
}

export async function getIdentityKey(userId: string): Promise<IdentityKeyResponse> {
  const res = await http.get<ApiEnvelope<IdentityKeyResponse>>(`/user/keys/identity/${userId}`);
  return res.data.data;
}

// 设备管理 API
export async function getDevices(): Promise<Array<{
  deviceId: string;
  deviceName: string;
  deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
  identityPublicKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  registrationId: number | null;
  createdAt: string;
  lastActiveAt: string | null;
}>> {
  const res = await http.get<ApiEnvelope<Array<{
    deviceId: string;
    deviceName: string;
    deviceType: 'ios' | 'android' | 'mac' | 'windows' | 'linux';
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    registrationId: number | null;
    createdAt: string;
    lastActiveAt: string | null;
  }>>>('/user/device/list');
  return res.data.data;
}

// 预密钥上传 API
export async function uploadPrekeys(data: {
  deviceId: string;
  identityKey?: string;
  signedPrekey?: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePrekeys?: Array<{
    keyId: number;
    publicKey: string;
  }>;
  kyberPrekey?: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
}): Promise<{ inserted: number; deviceId: string }> {
  const res = await http.post<ApiEnvelope<{ inserted: number; deviceId: string }>>('/user/keys/upload', data);
  return res.data.data;
}

// ==================== 群聊 API (Week 12) ====================

/**
 * 创建群组
 */
export async function createGroup(data: {
  name: string;
  description?: string;
  type: 1 | 2;
  memberUserIds: string[];
}): Promise<{ groupId: string }> {
  const res = await http.post<ApiEnvelope<{ groupId: string }>>('/group/create', data);
  return res.data.data;
}

/**
 * 获取群组信息
 */
export async function getGroup(groupId: string): Promise<{
  id: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  type: number;
  creatorId: string;
  createdAt: number;
  updatedAt: number;
}> {
  const res = await http.get<ApiEnvelope<{
    id: string;
    name: string;
    avatarUrl: string | null;
    description: string | null;
    type: number;
    creatorId: string;
    createdAt: number;
    updatedAt: number;
  }>>(`/group/${groupId}`);
  return res.data.data;
}

export async function updateGroupProfile(groupId: string, data: {
  name?: string;
  avatarUrl?: string;
  description?: string;
}): Promise<{
  id: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  updatedAt: string;
}> {
  const res = await http.patch<ApiEnvelope<{
    id: string;
    name: string;
    avatarUrl: string | null;
    description: string | null;
    updatedAt: string;
  }>>(`/group/${groupId}/profile`, data);
  return res.data.data;
}

/**
 * 获取群组成员列表
 */
export async function getGroupMembers(groupId: string): Promise<Array<{
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: number;
  joinedAt: number;
}>> {
  const res = await http.get<ApiEnvelope<Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    role: number;
    joinedAt: number;
}>>>(`/group/${groupId}/members`);
  return res.data.data;
}

/**
 * 添加群成员
 */
export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  await http.post<ApiEnvelope<null>>(`/group/${groupId}/members`, { userIds: [userId] });
}

/**
 * 移除群成员
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await http.delete<ApiEnvelope<null>>(`/group/${groupId}/members/${userId}`);
}

/**
 * 离开群组
 */
export async function leaveGroup(groupId: string): Promise<void> {
  await http.post<ApiEnvelope<null>>(`/group/${groupId}/leave`);
}

/**
 * 获取群组列表
 */
export async function getGroupList(): Promise<Array<{
  id: string;
  name: string;
  avatarUrl: string | null;
  type: number;
  memberCount: number;
  unreadCount: number;
}>> {
  const res = await http.get<ApiEnvelope<Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    type: number;
    memberCount: number;
    unreadCount: number;
  }>>>('/group/list');
  return res.data.data;
}

// ==================== 通知设置 API ====================

export async function getNotificationSettings(): Promise<{
  messageEnabled: boolean;
  friendRequestEnabled: boolean;
  burnEnabled: boolean;
  groupEnabled: boolean;
  accountRecoveryEnabled: boolean;
  securityEventEnabled: boolean;
  groupLifecycleEnabled: boolean;
}> {
  const res = await http.get<ApiEnvelope<{
    messageEnabled: boolean;
    friendRequestEnabled: boolean;
    burnEnabled: boolean;
    groupEnabled: boolean;
    accountRecoveryEnabled: boolean;
    securityEventEnabled: boolean;
    groupLifecycleEnabled: boolean;
  }>>('/notification/settings');
  return res.data.data;
}

export async function updateNotificationSettings(settings: {
  messageEnabled?: boolean;
  friendRequestEnabled?: boolean;
  burnEnabled?: boolean;
  groupEnabled?: boolean;
  accountRecoveryEnabled?: boolean;
  securityEventEnabled?: boolean;
  groupLifecycleEnabled?: boolean;
}): Promise<{
  messageEnabled: boolean;
  friendRequestEnabled: boolean;
  burnEnabled: boolean;
  groupEnabled: boolean;
  accountRecoveryEnabled: boolean;
  securityEventEnabled: boolean;
  groupLifecycleEnabled: boolean;
}> {
  const res = await http.post<ApiEnvelope<{
    messageEnabled: boolean;
    friendRequestEnabled: boolean;
    burnEnabled: boolean;
    groupEnabled: boolean;
    accountRecoveryEnabled: boolean;
    securityEventEnabled: boolean;
    groupLifecycleEnabled: boolean;
  }>>('/notification/settings', settings);
  return res.data.data;
}
