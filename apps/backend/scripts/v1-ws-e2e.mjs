import { io } from 'socket.io-client';

const HTTP_BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const WS_BASE = process.env.WS_BASE ?? 'http://127.0.0.1:3000/ws';
const PASSWORD = process.env.WS_E2E_PASSWORD ?? 'Password123';
const SUFFIX = `${Date.now()}`;
const WAIT_MS = Number(process.env.WS_E2E_WAIT_MS ?? '8000');

function assert(condition, message, detail) {
  if (!condition) {
    const err = new Error(message);
    err.detail = detail;
    throw err;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${HTTP_BASE}${path}`, options);
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    return { response, json };
  }
  const text = await response.text();
  return { response, text };
}

async function requestJson(path, options = {}) {
  const { response, json, text } = await request(path, options);
  assert(response.ok, `http ${response.status} on ${path}`, json ?? text);
  assert(json?.success === true, `api success=false on ${path}`, json);
  return json.data;
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

function directEnvelopes(sender, recipient, encryptedPayload) {
  return [
    {
      targetUserId: recipient.userId,
      targetDeviceId: recipient.deviceId,
      encryptedPayload,
    },
    {
      targetUserId: sender.userId,
      targetDeviceId: sender.deviceId,
      encryptedPayload,
    },
  ];
}

async function register(label, phonePrefix) {
  const username = `ws_${label}_${SUFFIX}`;
  return requestJson('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      phone: `+${phonePrefix}${SUFFIX.slice(-6)}`,
      password: PASSWORD,
      deviceName: `ws-${label}`,
      deviceType: 'mac',
      identityPublicKey: `pk-${label}`,
      signedPreKey: `spk-${label}`,
      signedPreKeySignature: `sig-${label}`,
    }),
  });
}

function waitForSocketEvent(socket, eventName, predicate = () => true, timeoutMs = WAIT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`timeout waiting for socket event: ${eventName}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      resolve(payload);
    };

    socket.on(eventName, onEvent);
  });
}

async function waitUntil(predicate, timeoutMs = WAIT_MS, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('timeout waiting for condition');
}

async function connectSocket(token) {
  const socket = io(WS_BASE, {
    transports: ['websocket'],
    auth: { token },
    timeout: WAIT_MS,
  });
  await waitForSocketEvent(socket, 'system.connected');
  return socket;
}

function createEncryptedPayload(type, text) {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      type,
      text,
    }),
  ).toString('base64');
}

async function main() {
  const alice = await register('alice', '12220');
  const bob = await register('bob', '13330');

  const direct = await requestJson('/conversation/direct', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ peerUserId: bob.userId }),
  });

  const aliceSocket = await connectSocket(alice.accessToken);
  const bobSocket = await connectSocket(bob.accessToken);
  const conversationUpdatedEvents = [];

  try {
    bobSocket.on('conversation.updated', (payload) => {
      conversationUpdatedEvents.push(payload);
    });

    const aliceJoinAckPromise = waitForSocketEvent(
      aliceSocket,
      'conversation.joined',
      (p) => p?.ok === true && p?.conversationId === direct.conversationId,
    );
    aliceSocket.emit('conversation.join', { conversationId: direct.conversationId });
    await aliceJoinAckPromise;

    const bobJoinAckPromise = waitForSocketEvent(
      bobSocket,
      'conversation.joined',
      (p) => p?.ok === true && p?.conversationId === direct.conversationId,
    );
    bobSocket.emit('conversation.join', { conversationId: direct.conversationId });
    await bobJoinAckPromise;

    const typingPromise = waitForSocketEvent(
      bobSocket,
      'conversation.typing',
      (p) => p?.conversationId === direct.conversationId && p?.userId === alice.userId && p?.isTyping === true,
    );
    const typingAckPromise = waitForSocketEvent(
      aliceSocket,
      'conversation.typing.ack',
      (p) => p?.ok === true && p?.conversationId === direct.conversationId && p?.isTyping === true,
    );
    aliceSocket.emit('conversation.typing.start', { conversationId: direct.conversationId });
    await Promise.all([typingPromise, typingAckPromise]);

    const messageSentPromise = waitForSocketEvent(
      bobSocket,
      'message.sent',
      (p) => p?.conversationId === direct.conversationId && p?.senderId === alice.userId,
    );

    const normalPayload = createEncryptedPayload(1, 'ws-normal');
    const normalSend = await requestJson('/message/send-v2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
      body: JSON.stringify({
        conversationId: direct.conversationId,
        messageType: 1,
        nonce: `ws_nonce_normal_${SUFFIX}`,
        envelopes: directEnvelopes(alice, bob, normalPayload),
        isBurn: false,
      }),
    });

    const messageSentPayload = await messageSentPromise;
    assert(messageSentPayload.messageId === normalSend.messageId, 'message.sent payload messageId mismatch', {
      expected: normalSend.messageId,
      actual: messageSentPayload.messageId,
    });

    const deliveredPromise = waitForSocketEvent(
      aliceSocket,
      'message.delivered',
      (p) => p?.conversationId === direct.conversationId,
    );
    const readPromise = waitForSocketEvent(
      aliceSocket,
      'message.read',
      (p) => p?.conversationId === direct.conversationId,
    );

    await requestJson('/message/ack/delivered', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader(bob.accessToken) },
      body: JSON.stringify({
        conversationId: direct.conversationId,
        maxMessageIndex: Number(normalSend.messageIndex),
      }),
    });

    await requestJson('/message/ack/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader(bob.accessToken) },
      body: JSON.stringify({
        conversationId: direct.conversationId,
        maxMessageIndex: Number(normalSend.messageIndex),
      }),
    });

    await deliveredPromise;
    await readPromise;

    const burnSentPromise = waitForSocketEvent(
      bobSocket,
      'message.sent',
      (p) => p?.conversationId === direct.conversationId && p?.senderId === alice.userId,
    );
    const burnPayload = createEncryptedPayload(1, 'ws-burn');
    const burnSend = await requestJson('/message/send-v2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
      body: JSON.stringify({
        conversationId: direct.conversationId,
        messageType: 1,
        nonce: `ws_nonce_burn_${SUFFIX}`,
        envelopes: directEnvelopes(alice, bob, burnPayload),
        isBurn: true,
        burnDuration: 30,
      }),
    });
    await burnSentPromise;

    const burnTriggeredPromiseAlice = waitForSocketEvent(
      aliceSocket,
      'burn.triggered',
      (p) => p?.conversationId === direct.conversationId && p?.messageId === burnSend.messageId,
    );
    const burnTriggeredPromiseBob = waitForSocketEvent(
      bobSocket,
      'burn.triggered',
      (p) => p?.conversationId === direct.conversationId && p?.messageId === burnSend.messageId,
    );

    await requestJson('/burn/trigger', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader(bob.accessToken) },
      body: JSON.stringify({ messageId: burnSend.messageId }),
    });

    await Promise.all([
      burnTriggeredPromiseAlice,
      burnTriggeredPromiseBob,
    ]);

    try {
      await waitUntil(() =>
        conversationUpdatedEvents.some(
          (p) => p?.conversationId === direct.conversationId && p?.reason === 'burn.triggered',
        ),
      );
    } catch (error) {
      const err = new Error('conversation.updated missing burn.triggered');
      err.detail = {
        conversationId: direct.conversationId,
        conversationUpdatedEvents,
      };
      throw err;
    }

    console.log('=== V1 backend ws e2e summary ===');
    console.log(`http_base=${HTTP_BASE}`);
    console.log(`ws_base=${WS_BASE}`);
    console.log(`conversation_id=${direct.conversationId}`);
    console.log(`normal_message_id=${normalSend.messageId}`);
    console.log(`burn_message_id=${burnSend.messageId}`);
    console.log(`conversation_updated_events=${conversationUpdatedEvents.length}`);
    console.log('events=typing,message.sent,message.delivered,message.read,burn.triggered,conversation.updated');
    console.log('done');
  } finally {
    aliceSocket.disconnect();
    bobSocket.disconnect();
  }
}

main().catch((error) => {
  console.error('v1 ws e2e failed');
  console.error(error.message);
  if (error.detail) {
    console.error(JSON.stringify(error.detail, null, 2));
  }
  process.exit(1);
});
