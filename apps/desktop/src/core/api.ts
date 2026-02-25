import axios from 'axios';
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

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:3000/api/v1';
export const wsBaseUrl = import.meta.env.VITE_WS_BASE ?? 'http://127.0.0.1:3000/ws';

const http = axios.create({ baseURL: API_BASE, timeout: 10000 });

type SendMessageInput = {
  conversationId: string;
  messageType: 1 | 2 | 3 | 4;
  text: string;
  mediaUrl?: string;
  fileName?: string;
  isBurn: boolean;
  burnDuration?: number;
};

type EncodedPayload = {
  v: 1;
  type: number;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
};

export function setAuthToken(token: string | null): void {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
}

export async function login(account: string, password: string): Promise<AuthResult> {
  const res = await http.post<ApiEnvelope<AuthResult>>('/auth/login', { account, password });
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

export async function getMessages(conversationId: string, afterIndex = 0, limit = 50): Promise<MessageItem[]> {
  const res = await http.get<ApiEnvelope<MessageItem[]>>('/message/list', {
    params: { conversationId, afterIndex, limit },
  });
  return res.data.data;
}

export async function sendMessage(input: SendMessageInput): Promise<{ messageId: string; messageIndex: string }> {
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

  const encryptedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const res = await http.post<ApiEnvelope<{ messageId: string; messageIndex: string }>>('/message/send', {
    conversationId: input.conversationId,
    messageType: input.messageType,
    encryptedPayload,
    nonce,
    isBurn: input.isBurn,
    burnDuration: input.isBurn ? input.burnDuration : undefined,
  });
  return res.data.data;
}

export async function ackDelivered(conversationId: string, maxMessageIndex: number): Promise<void> {
  await http.post('/message/ack/delivered', { conversationId, maxMessageIndex });
}

export async function ackRead(conversationId: string, maxMessageIndex: number): Promise<void> {
  await http.post('/message/ack/read', { conversationId, maxMessageIndex });
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

export function decodePayload(payload: string): string {
  try {
    return decodeURIComponent(escape(atob(payload)));
  } catch {
    return payload;
  }
}
