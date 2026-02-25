const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://127.0.0.1:3000/api/v1';
export const wsBaseUrl = process.env.EXPO_PUBLIC_WS_BASE ?? 'http://127.0.0.1:3000/ws';

let authToken: string | null = null;

type ApiEnvelope<T> = { success: boolean; data: T };

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export type ConversationListItem = {
  conversationId: string;
  type: number;
  unreadCount: number;
  peerUser: { userId: string; username: string; avatarUrl: string | null } | null;
  lastMessage: {
    messageId: string;
    messageIndex: string;
    senderId: string;
    messageType: number;
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
  messageType: number;
  encryptedPayload: string;
  nonce: string;
  messageIndex: string;
  isBurn: boolean;
  burnDuration: number | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type FriendSearchItem = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  relation: string;
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

function headers(): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export async function login(account: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  });
}

export async function getConversations(limit = 50): Promise<ConversationListItem[]> {
  return request<ConversationListItem[]>(`/conversation/list?limit=${limit}`);
}

export async function createDirectConversation(peerUserId: string): Promise<{ conversationId: string }> {
  return request<{ conversationId: string }>('/conversation/direct', {
    method: 'POST',
    body: JSON.stringify({ peerUserId }),
  });
}

export async function getMessages(conversationId: string, afterIndex = 0, limit = 50): Promise<MessageItem[]> {
  return request<MessageItem[]>(
    `/message/list?conversationId=${encodeURIComponent(conversationId)}&afterIndex=${afterIndex}&limit=${limit}`,
  );
}

export async function sendMessage(
  conversationId: string,
  senderText: string,
): Promise<{ messageId: string; messageIndex: string }> {
  const encryptedPayload = senderText;
  const nonce = `${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
  return request<{ messageId: string; messageIndex: string }>('/message/send', {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      messageType: 1,
      encryptedPayload,
      nonce,
      isBurn: false,
    }),
  });
}

export async function ackDelivered(conversationId: string, maxMessageIndex: number): Promise<void> {
  await request('/message/ack/delivered', {
    method: 'POST',
    body: JSON.stringify({ conversationId, maxMessageIndex }),
  });
}

export async function ackRead(conversationId: string, maxMessageIndex: number): Promise<void> {
  await request('/message/ack/read', {
    method: 'POST',
    body: JSON.stringify({ conversationId, maxMessageIndex }),
  });
}

export async function searchUsers(keyword: string, limit = 20): Promise<FriendSearchItem[]> {
  return request<FriendSearchItem[]>(
    `/friend/search?keyword=${encodeURIComponent(keyword)}&limit=${Math.max(1, Math.min(limit, 100))}`,
  );
}

export async function requestFriend(targetUserId: string): Promise<void> {
  await request('/friend/request', {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  });
}

export async function getIncomingRequests(): Promise<PendingFriendItem[]> {
  return request<PendingFriendItem[]>('/friend/pending/incoming');
}

export async function respondFriend(requesterUserId: string, accept: boolean): Promise<void> {
  await request('/friend/respond', {
    method: 'POST',
    body: JSON.stringify({ requesterUserId, accept }),
  });
}

export async function getFriends(): Promise<FriendListItem[]> {
  return request<FriendListItem[]>('/friend/list');
}

export async function blockUser(targetUserId: string): Promise<void> {
  await request('/friend/block', {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  });
}

export async function getBlockedUsers(): Promise<BlockedFriendItem[]> {
  return request<BlockedFriendItem[]>('/friend/blocked');
}

export async function unblockUser(targetUserId: string): Promise<void> {
  await request('/friend/unblock', {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  });
}

export function decodePayload(payload: string): string {
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(payload)));
    }
    return payload;
  } catch {
    return payload;
  }
}
