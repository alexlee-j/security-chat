import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'Password123';
const USER_PREFIX = process.env.SMOKE_USER_PREFIX ?? 'smoke';
const KEEP_ARTIFACTS = process.env.SMOKE_KEEP_ARTIFACTS === '1';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? '10000');
const MESSAGE_LIMIT = Number(process.env.SMOKE_MESSAGE_LIMIT ?? '20');
const MEDIA_KIND = Number(process.env.SMOKE_MEDIA_KIND ?? '4');
const MESSAGE_TYPE = Number(process.env.SMOKE_MESSAGE_TYPE ?? String(MEDIA_KIND));
const BURN_DURATION = Number(process.env.SMOKE_BURN_DURATION ?? '30');
const SUFFIX = `${Date.now()}`;

function assert(condition, message, detail) {
  if (!condition) {
    const err = new Error(message);
    err.detail = detail;
    throw err;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(`request failed: ${path} (${error.message})`);
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    return { response, json };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer };
}

async function requestJson(path, options = {}) {
  const { response, json } = await request(path, options);
  assert(response.ok, `http ${response.status} on ${path}`, json);
  assert(json && json.success === true, `api response not success on ${path}`, json);
  return json.data;
}

async function requestJsonExpectStatus(path, status, options = {}) {
  const { response, json, buffer } = await request(path, options);
  assert(response.status === status, `expected http ${status} on ${path}, got ${response.status}`, json ?? buffer?.toString?.());
  return json ?? buffer;
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

function sanitize(prefix) {
  return prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20) || 'smoke';
}

async function registerUser(prefix, phonePrefix) {
  const safePrefix = sanitize(prefix);
  const username = `${safePrefix}_${SUFFIX}`;
  const email = `${username}@example.com`;
  const phone = `+${phonePrefix}${SUFFIX.slice(-6)}`;

  const data = await requestJson('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      phone,
      password: PASSWORD,
      deviceName: `smoke-${safePrefix}`,
      deviceType: 'mac',
      identityPublicKey: `pk-${safePrefix}`,
      signedPreKey: `spk-${safePrefix}`,
      signedPreKeySignature: `sig-${safePrefix}`,
    }),
  });

  return { username, ...data };
}

async function run() {
  assert([2, 3, 4].includes(MEDIA_KIND), 'SMOKE_MEDIA_KIND must be one of [2,3,4]');
  assert([2, 3, 4].includes(MESSAGE_TYPE), 'SMOKE_MESSAGE_TYPE must be one of [2,3,4]');
  assert([5, 10, 30, 60, 300].includes(BURN_DURATION), 'SMOKE_BURN_DURATION must be one of [5,10,30,60,300]');

  const alice = await registerUser(`${USER_PREFIX}_alice`, '15550');
  const bob = await registerUser(`${USER_PREFIX}_bob`, '16660');

  const conversation = await requestJson('/conversation/direct', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ peerUserId: bob.userId }),
  });

  const burnDefaultUpdated = await requestJson(`/conversation/${conversation.conversationId}/burn-default`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ enabled: true, burnDuration: BURN_DURATION }),
  });

  const burnDefault = await requestJson(`/conversation/${conversation.conversationId}/burn-default`, {
    method: 'GET',
    headers: { ...authHeader(alice.accessToken) },
  });

  const workDir = await mkdtemp(join(tmpdir(), 'security-chat-smoke-'));
  const mediaPath = join(workDir, 'smoke.txt');
  const mediaText = `v1 smoke media ${SUFFIX}`;
  await writeFile(mediaPath, mediaText);

  const mimeType = MEDIA_KIND === 2 ? 'image/png' : MEDIA_KIND === 3 ? 'audio/mpeg' : 'text/plain';
  const form = new FormData();
  form.append('mediaKind', String(MEDIA_KIND));
  form.append('file', new Blob([mediaText], { type: mimeType }), MEDIA_KIND === 2 ? 'smoke.png' : MEDIA_KIND === 3 ? 'smoke.mp3' : 'smoke.txt');

  const upload = await requestJson('/media/upload', {
    method: 'POST',
    headers: { ...authHeader(alice.accessToken) },
    body: form,
  });

  const attach = await requestJson(`/media/${upload.mediaAssetId}/attach`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ conversationId: conversation.conversationId }),
  });

  const sendPayload = 'eyJ0eXBlIjoiZmlsZSIsIm5hbWUiOiJzbW9rZSJ9';
  const send = await requestJson('/message/send-v2', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: conversation.conversationId,
      messageType: MESSAGE_TYPE,
      nonce: `nonce_${SUFFIX}`,
      envelopes: directEnvelopes(alice, bob, sendPayload),
      mediaAssetId: upload.mediaAssetId,
      isBurn: false,
    }),
  });

  const burnPayload = 'eyJ0eXBlIjoiYnVybiIsIm5hbWUiOiJzbW9rZS1idXJuIn0=';
  const burnSend = await requestJson('/message/send-v2', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: conversation.conversationId,
      messageType: 1,
      nonce: `nonce_burn_${SUFFIX}`,
      envelopes: directEnvelopes(alice, bob, burnPayload),
      isBurn: true,
      burnDuration: BURN_DURATION,
    }),
  });

  const invalidBurnPayload = 'eyJ0eXBlIjoiYnVybi1maWxlIn0=';
  await requestJsonExpectStatus('/message/send-v2', 400, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: conversation.conversationId,
      messageType: 4,
      nonce: `nonce_burn_invalid_${SUFFIX}`,
      envelopes: directEnvelopes(alice, bob, invalidBurnPayload),
      isBurn: true,
      burnDuration: BURN_DURATION,
      mediaAssetId: upload.mediaAssetId,
    }),
  });

  const list = await requestJson(`/message/direct/pending?conversationId=${conversation.conversationId}&afterIndex=0&limit=${MESSAGE_LIMIT}`, {
    method: 'GET',
    headers: { ...authHeader(bob.accessToken) },
  });

  const summary = await requestJson('/notification/unread-summary', {
    method: 'GET',
    headers: { ...authHeader(bob.accessToken) },
  });

  const meta = await requestJson(`/media/${upload.mediaAssetId}/meta`, {
    method: 'GET',
    headers: { ...authHeader(bob.accessToken) },
  });

  const download = await request(`/media/${upload.mediaAssetId}/download`, {
    method: 'GET',
    headers: { ...authHeader(bob.accessToken) },
  });
  assert(download.response.ok, `download failed: ${download.response.status}`);

  assert(attach.attached === true, 'attach not successful', attach);
  assert(burnDefaultUpdated.enabled === true, 'burn-default update failed', burnDefaultUpdated);
  assert(Number(burnDefaultUpdated.burnDuration) === BURN_DURATION, 'burn-default update duration mismatch', burnDefaultUpdated);
  assert(burnDefault.enabled === true, 'burn-default get failed', burnDefault);
  assert(Number(burnDefault.burnDuration) === BURN_DURATION, 'burn-default get duration mismatch', burnDefault);
  assert(Boolean(send.messageId), 'send message failed', send);
  assert(Boolean(burnSend.messageId), 'burn send message failed', burnSend);
  assert(Array.isArray(list) && list.length > 0, 'message list should not be empty', list);
  assert(summary.totalUnread >= 1, 'summary totalUnread should be >= 1', summary);
  assert(meta.mediaAssetId === upload.mediaAssetId, 'meta mediaAssetId mismatch', meta);
  assert(Number(meta.mediaKind) === MEDIA_KIND, 'meta mediaKind mismatch', meta);
  assert(download.buffer.length > 0, 'download file empty');

  console.log('=== V1 backend smoke summary ===');
  console.log(`base_url=${BASE_URL}`);
  console.log(`user_prefix=${USER_PREFIX}`);
  console.log(`timeout_ms=${TIMEOUT_MS}`);
  console.log(`alice_id=${alice.userId}`);
  console.log(`bob_id=${bob.userId}`);
  console.log(`conversation_id=${conversation.conversationId}`);
  console.log(`media_asset_id=${upload.mediaAssetId}`);
  console.log(`media_kind=${MEDIA_KIND}`);
  console.log(`message_type=${MESSAGE_TYPE}`);
  console.log(`message_id=${send.messageId}`);
  console.log(`burn_message_id=${burnSend.messageId}`);
  console.log(`burn_default_enabled=${burnDefault.enabled}`);
  console.log(`burn_default_duration=${burnDefault.burnDuration}`);
  console.log(`bob_message_count=${list.length}`);
  console.log(`bob_total_unread=${summary.totalUnread}`);
  console.log(`media_sha256=${meta.sha256}`);
  console.log(`download_bytes=${download.buffer.length}`);
  console.log(`artifact_dir=${workDir}`);
  console.log('done');

  if (!KEEP_ARTIFACTS) {
    await rm(workDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error('v1 smoke failed');
  console.error(error.message);
  if (error.detail) {
    console.error(JSON.stringify(error.detail, null, 2));
  }
  process.exit(1);
});
