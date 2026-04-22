import assert from 'node:assert/strict';
import {
  buildMediaMessagePayload,
  buildSendV2TransportPayload,
  normalizeVoiceMessageMetadata,
} from '../src/core/media-message';

const voice = normalizeVoiceMessageMetadata({
  durationMs: 8200,
  waveform: [1, 8.2, 16, 40, -2],
  waveformVersion: 1,
  codec: 'opus',
});

assert.deepEqual(voice, {
  durationMs: 8200,
  waveform: [1, 8, 16, 31, 0],
  waveformVersion: 1,
  codec: 'opus',
});

const encryptedMessagePayload = buildMediaMessagePayload(3, {
  media: {
    version: 1,
    assetId: 'asset-1',
    algorithm: 'aes-256-gcm',
    key: 'key',
    nonce: 'nonce',
    ciphertextDigest: 'cipher',
    ciphertextSize: 1234,
    plainDigest: 'plain',
    plainSize: 1000,
    fileName: 'voice.webm',
    mimeType: 'audio/webm',
  },
  voice,
});

assert.equal(encryptedMessagePayload.type, 3);
assert.deepEqual(encryptedMessagePayload.voice, voice);
assert.equal('voice' in buildMediaMessagePayload(2, { voice }), false);

const persistedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(encryptedMessagePayload))));
const restoredPayload = JSON.parse(decodeURIComponent(escape(atob(persistedPayload))));
assert.deepEqual(restoredPayload.voice, voice);

const transportPayload = buildSendV2TransportPayload({
  conversationId: 'conversation-1',
  messageType: 3,
  nonce: 'nonce-1',
  envelopes: [
    {
      targetUserId: 'user-2',
      targetDeviceId: 'device-2',
      encryptedPayload: 'ciphertext',
    },
  ],
  mediaAssetId: 'asset-1',
  isBurn: false,
  voice,
});

assert.equal('voice' in transportPayload, false);
assert.equal('durationMs' in transportPayload, false);
assert.equal('waveform' in transportPayload, false);
assert.deepEqual(transportPayload, {
  conversationId: 'conversation-1',
  messageType: 3,
  nonce: 'nonce-1',
  envelopes: [
    {
      targetUserId: 'user-2',
      targetDeviceId: 'device-2',
      encryptedPayload: 'ciphertext',
    },
  ],
  mediaAssetId: 'asset-1',
  isBurn: false,
  burnDuration: undefined,
});

console.log('voice payload contract ok');
