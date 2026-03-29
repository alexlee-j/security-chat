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
