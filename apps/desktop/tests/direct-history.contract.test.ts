import assert from 'node:assert/strict';
import {
  applyLocalDirectConversationPreview,
  buildDirectEnvelopeTargets,
  createSentDirectMessageItem,
  isBurnExpiredMessage,
  loadDirectConversationLocalFirst,
  localMessageToMessageItem,
  pendingEnvelopeToMessageItem,
  processPendingDirectEnvelopes,
  retryTransportKind,
} from '../src/core/direct-history';
import type { LocalMessage } from '../src/core/use-local-db';
import type { ConversationListItem, PendingDirectEnvelopeItem } from '../src/core/types';

async function main(): Promise<void> {
  const local: LocalMessage = {
  id: 'message-local',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  messageType: 1,
  content: 'hello from local db',
  nonce: 'nonce-local',
  isBurn: false,
  burnDuration: null,
  isRead: true,
  createdAt: Date.parse('2026-04-28T00:00:00.000Z'),
  serverTimestamp: 12,
  localTimestamp: Date.parse('2026-04-28T00:00:01.000Z'),
  };

  const localItem = localMessageToMessageItem(local);
  assert.equal(localItem.id, 'message-local');
  assert.equal(localItem.conversationId, 'conversation-1');
  assert.equal(localItem.encryptedPayload, btoa(unescape(encodeURIComponent('hello from local db'))));
  assert.equal(localItem.messageIndex, '12');
  assert.equal(localItem.localDeliveryState, 'replayed');
  assert.equal(localItem.readAt, '2026-04-28T00:00:00.000Z');

  const localFirstOps: string[] = [];
  const localFirstRows = await loadDirectConversationLocalFirst({
  getLocalMessages: async () => {
    localFirstOps.push('local:get');
    return [local];
  },
  cacheLocalMessages: () => {
    localFirstOps.push('local:cache');
  },
  renderLocalMessages: (rows) => {
    localFirstOps.push(`render:${rows[0]?.id}`);
  },
  setHasMoreHistory: (value) => {
    localFirstOps.push(`hasMore:${value}`);
  },
  syncPendingEnvelopes: async () => {
    localFirstOps.push('pending:sync');
  },
  });
  assert.deepEqual(localFirstOps, [
  'local:get',
  'local:cache',
  'render:message-local',
  'hasMore:false',
  'pending:sync',
  ]);
  assert.equal(localFirstRows[0]?.id, 'message-local');

  const pending: PendingDirectEnvelopeItem = {
  messageId: 'message-pending',
  conversationId: 'conversation-1',
  senderId: 'user-2',
  sourceDeviceId: 'device-2',
  sourceSignalDeviceId: 11,
  messageType: 1,
  encryptedPayload: 'ciphertext',
  nonce: 'nonce-pending',
  mediaAssetId: null,
  messageIndex: '13',
  isBurn: false,
  burnDuration: null,
  deliveredAt: null,
  readAt: null,
  createdAt: '2026-04-28T00:00:02.000Z',
  };

  const pendingItem = pendingEnvelopeToMessageItem(pending);
  assert.equal(pendingItem.id, 'message-pending');
  assert.equal(pendingItem.sourceDeviceId, 'device-2');
  assert.equal(pendingItem.sourceSignalDeviceId, 11);
  assert.equal(pendingItem.encryptedPayload, 'ciphertext');
  assert.equal(pendingItem.messageIndex, '13');
  assert.equal(pendingItem.localDeliveryState, 'replayed');

  const operations: string[] = [];
  const processed = await processPendingDirectEnvelopes({
  pendingRows: [pending],
  afterIndex: 12,
  decodePayload: async (_payload, _senderId, sourceDeviceId, _conversationId, sourceSignalDeviceId) => {
    operations.push(`decode:${sourceDeviceId}:${sourceSignalDeviceId}`);
    return 'decrypted text';
  },
  ensureLocalConversation: async () => {
    operations.push('ensure');
  },
  saveMessage: async (row) => {
    operations.push(`save:${row.id}:${row.content}`);
  },
  ackPersisted: async (_conversationId, messageIds, maxIndex) => {
    operations.push(`ack:${messageIds.join(',')}:${maxIndex}`);
  },
  now: () => Date.parse('2026-04-28T00:00:03.000Z'),
  });
  assert.deepEqual(operations, [
  'decode:device-2:11',
  'ensure',
  'save:message-pending:decrypted text',
  'ack:message-pending:13',
  ]);
  assert.deepEqual(processed.ackedMessageIds, ['message-pending']);
  assert.equal(processed.maxIndex, 13);

  const failedOperations: string[] = [];
  const failed = await processPendingDirectEnvelopes({
  pendingRows: [pending],
  afterIndex: 12,
  decodePayload: async () => null,
  ensureLocalConversation: async () => {
    failedOperations.push('ensure');
  },
  saveMessage: async () => {
    failedOperations.push('save');
  },
  ackPersisted: async () => {
    failedOperations.push('ack');
  },
  });
  assert.deepEqual(failedOperations, []);
  assert.deepEqual(failed.ackedMessageIds, []);
  assert.equal(failed.maxIndex, 12);

  assert.equal(retryTransportKind({ kind: 'direct_v2' }), 'send-v2');
  assert.equal(retryTransportKind({ kind: 'group_v1' }), 'send-v1');

  const sent = createSentDirectMessageItem({
    messageId: 'message-sent',
    conversationId: 'conversation-1',
    senderId: 'user-1',
    messageType: 1,
    serializedMessage: '{"text":"sent text"}',
    nonce: 'nonce-sent',
    mediaAssetId: null,
    messageIndex: '14',
    isBurn: false,
    burnDuration: null,
    createdAt: '2026-04-28T00:00:04.000Z',
  });
  assert.equal(sent.id, 'message-sent');
  assert.equal(sent.encryptedPayload, btoa(unescape(encodeURIComponent('{"text":"sent text"}'))));
  assert.equal(sent.messageIndex, '14');
  assert.equal(sent.localDeliveryState, 'sent');

  const targets = buildDirectEnvelopeTargets({
    recipientUserId: 'bob',
    currentUserId: 'alice',
    deviceInfoList: [
      {
        userId: 'bob',
        devices: [
          { deviceId: 'bob-phone', signalDeviceId: 2 },
          { deviceId: 'bob-desktop', signalDeviceId: 3 },
        ],
      },
      {
        userId: 'alice',
        devices: [
          { deviceId: 'alice-phone', signalDeviceId: 4 },
          { deviceId: 'alice-desktop', signalDeviceId: 5 },
        ],
      },
    ],
  });
  assert.deepEqual(targets, [
    { targetUserId: 'bob', targetDeviceId: 'bob-phone', targetSignalDeviceId: 2 },
    { targetUserId: 'bob', targetDeviceId: 'bob-desktop', targetSignalDeviceId: 3 },
    { targetUserId: 'alice', targetDeviceId: 'alice-phone', targetSignalDeviceId: 4 },
    { targetUserId: 'alice', targetDeviceId: 'alice-desktop', targetSignalDeviceId: 5 },
  ]);

  const serverDirectConversation: ConversationListItem = {
  conversationId: 'conversation-1',
  type: 1,
  defaultBurnEnabled: false,
  defaultBurnDuration: null,
  unreadCount: 0,
  peerUser: { userId: 'user-2', username: 'Bob', avatarUrl: null },
  groupInfo: null,
  lastMessage: {
    messageId: 'server-old',
    messageIndex: '2',
    senderId: 'user-2',
    messageType: 1,
    encryptedPayload: 'server-ciphertext',
    isBurn: false,
    deliveredAt: null,
    readAt: null,
    createdAt: '2026-04-27T00:00:00.000Z',
  },
  };
  const localPreview = applyLocalDirectConversationPreview(serverDirectConversation, local);
  assert.equal(localPreview.lastMessage?.messageId, 'message-local');
  assert.equal(localPreview.lastMessage?.encryptedPayload, localItem.encryptedPayload);
  assert.equal(localPreview.lastMessage?.createdAt, '2026-04-28T00:00:00.000Z');

  assert.equal(
  isBurnExpiredMessage(
    {
      ...localItem,
      isBurn: true,
      burnDuration: 30,
      readAt: '2026-04-28T00:00:00.000Z',
    },
    Date.parse('2026-04-28T00:00:31.000Z'),
  ),
  true,
  );

  console.log('direct history contract ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
