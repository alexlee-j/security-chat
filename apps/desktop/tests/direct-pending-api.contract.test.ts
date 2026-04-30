import assert from 'node:assert/strict';
import {
  buildAckPersistedDirectEnvelopeBody,
  buildPendingDirectEnvelopeParams,
} from '../src/core/api';

assert.deepEqual(
  buildPendingDirectEnvelopeParams('conversation-1', 7, 25),
  {
    conversationId: 'conversation-1',
    afterIndex: 7,
    limit: 25,
  },
);

assert.deepEqual(
  buildPendingDirectEnvelopeParams('conversation-1', 0, 100),
  {
    conversationId: 'conversation-1',
    afterIndex: 0,
    limit: 100,
  },
);

assert.deepEqual(
  buildAckPersistedDirectEnvelopeBody('conversation-1', ['message-1', 'message-2'], 9),
  {
    conversationId: 'conversation-1',
    messageIds: ['message-1', 'message-2'],
    maxMessageIndex: 9,
  },
);

assert.deepEqual(
  buildAckPersistedDirectEnvelopeBody('conversation-1', ['message-1']),
  {
    conversationId: 'conversation-1',
    messageIds: ['message-1'],
    maxMessageIndex: undefined,
  },
);

console.log('direct pending api contract ok');
