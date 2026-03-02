import * as FileSystem from 'expo-file-system';

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
  defaultBurnEnabled: boolean;
  defaultBurnDuration: number | null;
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
  mediaAssetId: string | null;
  messageIndex: string;
  isBurn: boolean;
  burnDuration: number | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

type SendMessageInput = {
  conversationId: string;
  messageType: 1 | 2 | 3 | 4;
  text: string;
  mediaUrl?: string;
  fileName?: string;
  mediaAssetId?: string;
  isBurn: boolean;
  burnDuration?: number;
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

export async function getConversationBurnDefault(
  conversationId: string,
): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
  return request<{ conversationId: string; enabled: boolean; burnDuration: number | null }>(
    `/conversation/${encodeURIComponent(conversationId)}/burn-default`,
  );
}

export async function updateConversationBurnDefault(
  conversationId: string,
  enabled: boolean,
  burnDuration: number,
): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
  return request<{ conversationId: string; enabled: boolean; burnDuration: number | null }>(
    `/conversation/${encodeURIComponent(conversationId)}/burn-default`,
    {
      method: 'POST',
      body: JSON.stringify({
        enabled,
        burnDuration: enabled ? burnDuration : undefined,
      }),
    },
  );
}

export async function getMessages(
  conversationId: string,
  afterIndex = 0,
  limit = 50,
  beforeIndex?: number,
): Promise<MessageItem[]> {
  const beforePart = beforeIndex && beforeIndex > 0 ? `&beforeIndex=${beforeIndex}` : '';
  return request<MessageItem[]>(
    `/message/list?conversationId=${encodeURIComponent(conversationId)}&afterIndex=${afterIndex}&limit=${limit}${beforePart}`,
  );
}

export async function sendMessage(input: SendMessageInput): Promise<{ messageId: string; messageIndex: string }> {
  const payload: { v: 1; type: number; text?: string; mediaUrl?: string; fileName?: string } = {
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

  const encryptedPayload = JSON.stringify(payload);
  const nonce = `${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
  return request<{ messageId: string; messageIndex: string }>('/message/send', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: input.conversationId,
      messageType: input.messageType,
      encryptedPayload,
      nonce,
      mediaAssetId: input.mediaAssetId,
      isBurn: input.isBurn,
      burnDuration: input.isBurn ? input.burnDuration : undefined,
    }),
  });
}

export async function uploadMedia(input: {
  uri: string;
  name: string;
  type?: string;
  mediaKind: 2 | 3 | 4;
}): Promise<{ mediaAssetId: string; mediaKind: number; mimeType: string; fileSize: number; sha256: string; createdAt: string }> {
  const form = new FormData();
  form.append('mediaKind', String(input.mediaKind));
  form.append(
    'file',
    {
      uri: input.uri,
      name: input.name,
      type: input.type ?? 'application/octet-stream',
    } as unknown as Blob,
  );

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = (await res.json()) as ApiEnvelope<{
    mediaAssetId: string;
    mediaKind: number;
    mimeType: string;
    fileSize: number;
    sha256: string;
    createdAt: string;
  }>;
  return json.data;
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

export async function ackReadOne(messageId: string): Promise<void> {
  await request('/message/ack/read-one', {
    method: 'POST',
    body: JSON.stringify({ messageId }),
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

export async function triggerBurn(messageId: string): Promise<void> {
  await request('/burn/trigger', {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  });
}

export async function downloadMediaToCache(mediaAssetId: string, preferredName?: string): Promise<string> {
  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) {
    throw new Error('No writable directory');
  }
  const name = (preferredName?.trim() || `media-${mediaAssetId}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetUri = `${root}${Date.now()}-${name}`;
  const res = await FileSystem.downloadAsync(`${API_BASE}/media/${encodeURIComponent(mediaAssetId)}/download`, targetUri, {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
  });
  return res.uri;
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
