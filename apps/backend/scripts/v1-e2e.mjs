const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Password123';
const SUFFIX = `${Date.now()}`;

function assert(condition, message, detail) {
  if (!condition) {
    const err = new Error(message);
    err.detail = detail;
    throw err;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
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

async function requestExpect(path, expectedStatus, options = {}) {
  const { response, json, text } = await request(path, options);
  assert(response.status === expectedStatus, `expected ${expectedStatus}, got ${response.status} on ${path}`, json ?? text);
  return json ?? text;
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

async function register(label, phonePrefix) {
  const username = `e2e_${label}_${SUFFIX}`;
  return requestJson('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      phone: `+${phonePrefix}${SUFFIX.slice(-6)}`,
      password: PASSWORD,
      deviceName: `e2e-${label}`,
      deviceType: 'mac',
      identityPublicKey: `pk-${label}`,
      signedPreKey: `spk-${label}`,
      signedPreKeySignature: `sig-${label}`,
    }),
  });
}

async function login(account, password) {
  return requestJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, password }),
  });
}

async function main() {
  const alice = await register('alice', '17770');
  const bob = await register('bob', '18880');
  const charlie = await register('charlie', '19990');

  const aliceName = `e2e_alice_${SUFFIX}`;
  await requestExpect('/auth/login', 401, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account: aliceName, password: 'WrongPass123' }),
  });
  const aliceLogin = await login(aliceName, PASSWORD);
  assert(Boolean(aliceLogin.accessToken), 'login should return accessToken');

  const direct = await requestJson('/conversation/direct', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ peerUserId: bob.userId }),
  });
  assert(Boolean(direct.conversationId), 'direct conversation should be created');

  const burnUpdated = await requestJson(`/conversation/${direct.conversationId}/burn-default`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ enabled: true, burnDuration: 30 }),
  });
  assert(burnUpdated.enabled === true && Number(burnUpdated.burnDuration) === 30, 'burn default update mismatch', burnUpdated);

  await requestExpect(`/conversation/${direct.conversationId}/burn-default`, 400, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ enabled: true, burnDuration: 11 }),
  });

  const form = new FormData();
  form.append('mediaKind', '4');
  form.append('file', new Blob([`e2e-file-${SUFFIX}`], { type: 'text/plain' }), 'e2e.txt');
  const uploaded = await requestJson('/media/upload', {
    method: 'POST',
    headers: { ...authHeader(alice.accessToken) },
    body: form,
  });
  assert(Boolean(uploaded.mediaAssetId), 'upload should return mediaAssetId');

  await requestJson(`/media/${uploaded.mediaAssetId}/attach`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({ conversationId: direct.conversationId }),
  });

  await requestExpect(`/media/${uploaded.mediaAssetId}/meta`, 403, {
    method: 'GET',
    headers: { ...authHeader(charlie.accessToken) },
  });

  const fileMessage = await requestJson('/message/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: direct.conversationId,
      messageType: 4,
      encryptedPayload: 'eyJ0eXBlIjoiZmlsZSJ9',
      nonce: `nonce_file_${SUFFIX}`,
      mediaAssetId: uploaded.mediaAssetId,
      isBurn: false,
    }),
  });
  assert(Boolean(fileMessage.messageId), 'file message send failed');

  const burnText = await requestJson('/message/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: direct.conversationId,
      messageType: 1,
      encryptedPayload: 'eyJ0eXBlIjoiYnVybi10ZXh0In0=',
      nonce: `nonce_burn_${SUFFIX}`,
      isBurn: true,
      burnDuration: 30,
    }),
  });
  assert(Boolean(burnText.messageId), 'burn text send failed');

  const inheritedBurnText = await requestJson('/message/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: direct.conversationId,
      messageType: 1,
      encryptedPayload: 'eyJ0eXBlIjoiYnVybi1pbmhlcml0ZWQifQ==',
      nonce: `nonce_burn_inherited_${SUFFIX}`,
    }),
  });
  assert(Boolean(inheritedBurnText.messageId), 'inherited burn text send failed');

  await requestExpect('/message/send', 400, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: direct.conversationId,
      messageType: 4,
      encryptedPayload: 'eyJ0eXBlIjoiYnVybi1maWxlIn0=',
      nonce: `nonce_burn_file_${SUFFIX}`,
      mediaAssetId: uploaded.mediaAssetId,
      isBurn: true,
      burnDuration: 30,
    }),
  });

  await requestExpect('/message/send', 400, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader(alice.accessToken) },
    body: JSON.stringify({
      conversationId: direct.conversationId,
      messageType: 1,
      encryptedPayload: 'eyJ0eXBlIjoidGV4dCJ9',
      nonce: `nonce_invalid_duration_${SUFFIX}`,
      isBurn: false,
      burnDuration: 30,
    }),
  });

  const bobList = await requestJson(`/message/list?conversationId=${direct.conversationId}&afterIndex=0&limit=20`, {
    method: 'GET',
    headers: { ...authHeader(bob.accessToken) },
  });
  assert(Array.isArray(bobList) && bobList.length >= 3, 'bob should see at least 3 messages', bobList);

  const inheritedRow = bobList.find((row) => row.id === inheritedBurnText.messageId);
  assert(Boolean(inheritedRow), 'inherited burn message should be present in message list', bobList);
  assert(inheritedRow.isBurn === true, 'inherited burn message should have isBurn=true', inheritedRow);
  assert(Number(inheritedRow.burnDuration) === 30, 'inherited burn message should inherit burnDuration=30', inheritedRow);

  const bobSummary = await requestJson('/notification/unread-summary', {
    method: 'GET',
    headers: { ...authHeader(bob.accessToken) },
  });
  assert(Number(bobSummary.totalUnread) >= 2, 'bob unread summary should reflect sent messages', bobSummary);

  console.log('=== V1 backend e2e summary ===');
  console.log(`base_url=${BASE_URL}`);
  console.log(`conversation_id=${direct.conversationId}`);
  console.log(`media_asset_id=${uploaded.mediaAssetId}`);
  console.log(`file_message_id=${fileMessage.messageId}`);
  console.log(`burn_message_id=${burnText.messageId}`);
  console.log(`inherited_burn_message_id=${inheritedBurnText.messageId}`);
  console.log(`bob_message_count=${bobList.length}`);
  console.log(`bob_total_unread=${bobSummary.totalUnread}`);
  console.log('done');
}

main().catch((error) => {
  console.error('v1 e2e failed');
  console.error(error.message);
  if (error.detail) {
    console.error(JSON.stringify(error.detail, null, 2));
  }
  process.exit(1);
});
