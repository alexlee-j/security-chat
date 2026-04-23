import assert from 'node:assert/strict';
import type { ConversationListItem } from '../src/core/types';
import type { VoiceCallHistoryEntry } from '../src/core/voice-call-engine';
import {
  conversationPreviewFromLatestActivity,
  latestCallForConversation,
} from '../src/core/voice-call-engine';

const conversation: ConversationListItem = {
  conversationId: 'conversation-1',
  type: 1,
  defaultBurnEnabled: false,
  defaultBurnDuration: null,
  unreadCount: 0,
  peerUser: { userId: 'user-b', username: 'Bob', avatarUrl: null },
  groupInfo: null,
  lastMessage: {
    messageId: 'message-1',
    messageIndex: '1',
    senderId: 'user-a',
    messageType: 1,
    encryptedPayload: 'ciphertext',
    isBurn: false,
    deliveredAt: null,
    readAt: null,
    createdAt: '2026-04-22T08:00:00.000Z',
  },
};

const newerCall: VoiceCallHistoryEntry = {
  id: 'call-record-1',
  kind: 'call',
  conversationId: 'conversation-1',
  callerUserId: 'user-a',
  calleeUserId: 'user-b',
  callerDeviceId: null,
  acceptedDeviceId: null,
  outcome: 'missed',
  startedAt: '2026-04-22T08:01:00.000Z',
  acceptedAt: null,
  endedAt: '2026-04-22T08:01:30.000Z',
  durationSeconds: null,
  createdByUserId: 'user-a',
  createdAt: '2026-04-22T08:01:30.000Z',
  preview: '我发起的 · 未接听',
  timeLabel: '16:01',
};

const latestCall = latestCallForConversation([newerCall], 'conversation-1');
assert.equal(latestCall?.id, 'call-record-1');

const callPreview = conversationPreviewFromLatestActivity(conversation, [newerCall], () => '[文本]');
assert.equal(callPreview.preview, '我发起的 · 未接听');
assert.equal(callPreview.createdAt, '2026-04-22T08:01:30.000Z');
assert.equal(callPreview.isCall, true);

const newerMessagePreview = conversationPreviewFromLatestActivity({
  ...conversation,
  lastMessage: {
    ...conversation.lastMessage!,
    createdAt: '2026-04-22T08:02:00.000Z',
  },
}, [newerCall], () => '[文本]');

assert.equal(newerMessagePreview.preview, '[文本]');
assert.equal(newerMessagePreview.createdAt, '2026-04-22T08:02:00.000Z');
assert.equal(newerMessagePreview.isCall, false);

console.log('voice call preview ok');
