import type { LocalMessage } from './use-local-db';
import type { ConversationListItem, MessageItem, PendingDirectEnvelopeItem } from './types';

function encodeLocalPayload(content: string): string {
  return btoa(unescape(encodeURIComponent(content)));
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export type DirectEnvelopeTargetInput = {
  recipientUserId: string;
  currentUserId?: string | null;
  deviceInfoList: Array<{
    userId: string;
    devices: Array<{ deviceId: string }>;
  }>;
};

export type DirectEnvelopeTarget = {
  targetUserId: string;
  targetDeviceId: string;
};

export function buildDirectEnvelopeTargets(input: DirectEnvelopeTargetInput): DirectEnvelopeTarget[] {
  const targets: DirectEnvelopeTarget[] = [];
  const recipientDeviceInfo = input.deviceInfoList.find((info) => info.userId === input.recipientUserId);
  for (const recipientDevice of recipientDeviceInfo?.devices ?? []) {
    targets.push({
      targetUserId: input.recipientUserId,
      targetDeviceId: recipientDevice.deviceId,
    });
  }

  if (input.currentUserId) {
    const selfDeviceInfo = input.deviceInfoList.find((info) => info.userId === input.currentUserId);
    for (const selfDevice of selfDeviceInfo?.devices ?? []) {
      targets.push({
        targetUserId: input.currentUserId,
        targetDeviceId: selfDevice.deviceId,
      });
    }
  }

  return targets;
}

export function localMessageToMessageItem(row: LocalMessage): MessageItem {
  const payload = row.content ?? '';
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    messageType: row.messageType,
    encryptedPayload: payload ? encodeLocalPayload(payload) : '',
    nonce: row.nonce,
    mediaAssetId: null,
    messageIndex: String(row.serverTimestamp ?? row.localTimestamp),
    isBurn: row.isBurn,
    burnDuration: row.burnDuration,
    deliveredAt: row.isRead ? toIso(row.createdAt) : null,
    readAt: row.isRead ? toIso(row.createdAt) : null,
    createdAt: toIso(row.createdAt),
    localDeliveryState: 'replayed',
  };
}

export function pendingEnvelopeToMessageItem(row: PendingDirectEnvelopeItem): MessageItem {
  return {
    id: row.messageId,
    conversationId: row.conversationId,
    senderId: row.senderId,
    sourceDeviceId: row.sourceDeviceId ?? undefined,
    messageType: row.messageType,
    encryptedPayload: row.encryptedPayload,
    nonce: row.nonce,
    mediaAssetId: row.mediaAssetId,
    messageIndex: row.messageIndex,
    isBurn: row.isBurn,
    burnDuration: row.burnDuration,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt,
    createdAt: row.createdAt,
    localDeliveryState: 'replayed',
  };
}

export type CreateSentDirectMessageItemInput = {
  messageId: string;
  conversationId: string;
  senderId: string;
  messageType: number;
  serializedMessage: string;
  nonce: string;
  mediaAssetId: string | null;
  messageIndex: string;
  isBurn: boolean;
  burnDuration: number | null;
  createdAt: string;
};

export function createSentDirectMessageItem(input: CreateSentDirectMessageItemInput): MessageItem {
  return {
    id: input.messageId,
    conversationId: input.conversationId,
    senderId: input.senderId,
    messageType: input.messageType,
    encryptedPayload: encodeLocalPayload(input.serializedMessage),
    nonce: input.nonce,
    mediaAssetId: input.mediaAssetId,
    messageIndex: input.messageIndex,
    isBurn: input.isBurn,
    burnDuration: input.burnDuration,
    deliveredAt: new Date().toISOString(),
    readAt: null,
    createdAt: input.createdAt,
    localDeliveryState: 'sent',
  };
}

export function localMessageToConversationLastMessage(row: LocalMessage): ConversationListItem['lastMessage'] {
  return {
    messageId: row.id,
    messageIndex: String(row.serverTimestamp ?? row.localTimestamp),
    senderId: row.senderId,
    messageType: row.messageType,
    encryptedPayload: encodeLocalPayload(row.content ?? ''),
    isBurn: row.isBurn,
    deliveredAt: row.isRead ? toIso(row.createdAt) : null,
    readAt: row.isRead ? toIso(row.createdAt) : null,
    createdAt: toIso(row.createdAt),
  };
}

export function applyLocalDirectConversationPreview(
  conversation: ConversationListItem,
  latestLocalMessage: LocalMessage | null,
): ConversationListItem {
  if (conversation.type !== 1 || !latestLocalMessage) {
    return conversation;
  }
  return {
    ...conversation,
    lastMessage: localMessageToConversationLastMessage(latestLocalMessage),
  };
}

export type LoadDirectLocalFirstInput = {
  getLocalMessages: () => Promise<LocalMessage[]>;
  renderLocalMessages: (rows: MessageItem[]) => void;
  syncPendingEnvelopes: () => Promise<void>;
  setHasMoreHistory?: (value: boolean) => void;
  cacheLocalMessages?: (rows: LocalMessage[]) => void;
  now?: () => number;
};

export async function loadDirectConversationLocalFirst(input: LoadDirectLocalFirstInput): Promise<MessageItem[]> {
  const localRows = await input.getLocalMessages();
  input.cacheLocalMessages?.(localRows);
  const nowMs = input.now?.() ?? Date.now();
  const items = localRows
    .map(localMessageToMessageItem)
    .filter((row) => !isBurnExpiredMessage(row, nowMs));
  input.renderLocalMessages(items);
  input.setHasMoreHistory?.(localRows.length >= 100);
  await input.syncPendingEnvelopes();
  return items;
}

export type RetryTransportKindInput = { kind: 'group_v1' | 'direct_v2' };

export function retryTransportKind(request: RetryTransportKindInput): 'send-v1' | 'send-v2' {
  return request.kind === 'direct_v2' ? 'send-v2' : 'send-v1';
}

export function isBurnExpiredMessage(row: MessageItem, nowMs: number): boolean {
  if (!row.isBurn || !row.readAt || !row.burnDuration) {
    return false;
  }
  const readAtMs = Date.parse(row.readAt);
  if (Number.isNaN(readAtMs)) {
    return false;
  }
  return readAtMs + row.burnDuration * 1000 <= nowMs;
}

type DecodePendingPayload = (
  encryptedPayload: string,
  senderId: string,
  sourceDeviceId: string | undefined,
  conversationId: string,
) => Promise<string | null>;

type SaveLocalMessage = (row: LocalMessage) => Promise<void>;

export type ProcessPendingDirectEnvelopesInput = {
  pendingRows: PendingDirectEnvelopeItem[];
  afterIndex: number;
  decodePayload: DecodePendingPayload;
  ensureLocalConversation: (conversationId: string) => Promise<void>;
  saveMessage: SaveLocalMessage;
  ackPersisted?: (conversationId: string, messageIds: string[], maxMessageIndex: number) => Promise<unknown>;
  onPersisted?: (row: MessageItem, plaintext: string) => void;
  now?: () => number;
};

export type ProcessPendingDirectEnvelopesResult = {
  persistedRows: MessageItem[];
  ackedMessageIds: string[];
  maxIndex: number;
};

export async function processPendingDirectEnvelopes(
  input: ProcessPendingDirectEnvelopesInput,
): Promise<ProcessPendingDirectEnvelopesResult> {
  const persistedRows: MessageItem[] = [];
  const ackedMessageIds: string[] = [];
  let maxIndex = input.afterIndex;

  for (const pending of input.pendingRows) {
    const row = pendingEnvelopeToMessageItem(pending);
    try {
      const decrypted = await input.decodePayload(
        row.encryptedPayload,
        row.senderId,
        row.sourceDeviceId,
        row.conversationId,
      );
      if (!decrypted) {
        continue;
      }

      await input.ensureLocalConversation(row.conversationId);
      await input.saveMessage({
        id: row.id,
        conversationId: row.conversationId,
        senderId: row.senderId,
        messageType: row.messageType,
        content: decrypted,
        nonce: row.nonce,
        isBurn: row.isBurn,
        burnDuration: row.burnDuration,
        isRead: !!row.readAt,
        createdAt: new Date(row.createdAt).getTime(),
        serverTimestamp: Number.isFinite(Number(row.messageIndex)) ? Number(row.messageIndex) : null,
        localTimestamp: input.now?.() ?? Date.now(),
      });

      input.onPersisted?.(row, decrypted);
      persistedRows.push(row);
      ackedMessageIds.push(row.id);
      const rowIndex = Number(row.messageIndex);
      if (Number.isFinite(rowIndex)) {
        maxIndex = Math.max(maxIndex, rowIndex);
      }
    } catch (error) {
      console.error('Direct pending envelope processing failed:', error);
    }
  }

  if (ackedMessageIds.length > 0) {
    await input.ackPersisted?.(persistedRows[0].conversationId, ackedMessageIds, maxIndex);
  }

  return { persistedRows, ackedMessageIds, maxIndex };
}
