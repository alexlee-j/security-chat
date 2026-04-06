export type AuthState = {
  token: string;
  userId: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export type ConversationListItem = {
  conversationId: string;
  type: number;
  defaultBurnEnabled: boolean;
  defaultBurnDuration: number | null;
  unreadCount: number;
  peerUser: { userId: string; username: string; avatarUrl: string | null } | null;
  groupInfo: { name: string; memberCount: number } | null;
  lastMessage: {
    messageId: string;
    messageIndex: string;
    senderId: string;
    messageType: number;
    encryptedPayload: string;
    isBurn: boolean;
    deliveredAt: string | null;
    readAt: string | null;
    createdAt: string;
  } | null;
};

export type MessageItem = {
  id: string;
  conversationId: string;
  senderId: string;
  sourceDeviceId?: string;
  messageType: number;
  encryptedPayload: string;
  nonce: string;
  mediaAssetId: string | null;
  messageIndex: string;
  isBurn: boolean;
  isRevoked?: boolean; // 消息是否已被撤回
  burnDuration: number | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type WsConversationEvent = {
  conversationId?: string;
};

export type FriendRelation =
  | 'none'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'friends'
  | 'blocked';

export type FriendSearchItem = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  relation: FriendRelation;
};

export type PendingFriendItem = {
  requesterUserId: string;
  username: string;
  avatarUrl: string | null;
  remark: string | null;
};

export type FriendListItem = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  online: boolean;
  remark: string | null;
};

export type BlockedFriendItem = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

/**
 * Week 2 新增类型定义 - Tauri 前端使用
 */

/** 消息类型 */
export type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: number;
  isEncrypted: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  type: 'text' | 'image' | 'voice' | 'file';
};

/** 会话类型 */
export type Conversation = {
  id: string;
  participantId: string;
  participantName: string;
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: number;
};

/** 聊天状态 */
export type ChatState = {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
};

// ==================== 群聊相关类型 (Week 12) ====================

/** 群组类型 */
export type GroupType = 1 | 2; // 1: 私密群, 2: 公开群

/** 群组成员角色 */
export type GroupMemberRole = 1 | 2; // 1: 管理员, 2: 成员

/** 群组信息 */
export type GroupInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: GroupType;
  creatorId: string;
  createdAt: number;
  updatedAt: number;
  memberCount?: number;
};

/** 群组成员信息 */
export type GroupMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: GroupMemberRole;
  joinedAt: number;
};

/** 创建群组请求 */
export type CreateGroupRequest = {
  name: string;
  type: GroupType;
  memberIds: string[];
};

/** 群组列表项 */
export type GroupListItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: GroupType;
  memberCount: number;
  unreadCount: number;
  lastMessage?: {
    senderId: string;
    senderName: string;
    messageType: number;
    encryptedPayload: string;
    createdAt: string;
  } | null;
};
