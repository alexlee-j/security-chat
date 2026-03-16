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
