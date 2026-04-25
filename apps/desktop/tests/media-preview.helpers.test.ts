import assert from 'node:assert/strict';
import {
  parseMediaMessagePayload,
  resolveEncryptedMediaPayloadFromDecoded,
  resolveLegacyMediaUrl,
  resolvePreviewMediaBlob,
  shouldPersistMediaCache,
} from '../src/core/media-message';

const cipherBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });
const plainBlob = new Blob([new Uint8Array([9, 9, 9])], { type: 'application/octet-stream' });

const encryptedDecodedPayload = JSON.stringify({
  media: {
    version: 1,
    assetId: 'asset-1',
    algorithm: 'aes-256-gcm',
    key: 'key',
    nonce: 'nonce',
    ciphertextDigest: 'ciphertextDigest',
    ciphertextSize: 3,
    plainDigest: 'plainDigest',
    plainSize: 3,
    fileName: 'file.bin',
    mimeType: 'application/octet-stream',
  },
  mediaUrl: 'https://legacy.example/file.bin',
});

const parsedPayload = parseMediaMessagePayload(encryptedDecodedPayload);
assert.equal(parsedPayload.mediaUrl, 'https://legacy.example/file.bin');
assert.ok(resolveEncryptedMediaPayloadFromDecoded(encryptedDecodedPayload), 'should parse encrypted media payload');

async function run(): Promise<void> {
  let decryptCalled = false;
  const decrypted = await resolvePreviewMediaBlob({
    downloadedBlob: cipherBlob,
    decodedPayload: encryptedDecodedPayload,
    decryptMediaBlob: async () => {
      decryptCalled = true;
      return plainBlob;
    },
  });
  assert.equal(decryptCalled, true, 'encrypted payload should trigger decrypt callback');
  assert.equal(await decrypted.arrayBuffer().then((buf) => buf.byteLength), 3);

  const invalidDecodedPayload = '{"media":"invalid"}';
  let invalidDecryptCalled = false;
  const passthrough = await resolvePreviewMediaBlob({
    downloadedBlob: cipherBlob,
    decodedPayload: invalidDecodedPayload,
    decryptMediaBlob: async () => {
      invalidDecryptCalled = true;
      return plainBlob;
    },
  });
  assert.equal(invalidDecryptCalled, false, 'invalid media metadata should keep downloaded blob');
  assert.equal(
    await passthrough.arrayBuffer().then((buf) => buf.byteLength),
    await cipherBlob.arrayBuffer().then((buf) => buf.byteLength),
  );

  assert.equal(
    resolveLegacyMediaUrl({ mediaUrl: '  https://legacy.example/fallback  ' }),
    'https://legacy.example/fallback',
  );
  assert.equal(resolveLegacyMediaUrl({ mediaUrl: '' }), null);

  assert.equal(
    shouldPersistMediaCache({ messageType: 4, isBurn: false, isVideo: false }),
    true,
    'generic non-burn files should use persistent cache',
  );
  assert.equal(
    shouldPersistMediaCache({ messageType: 4, isBurn: true, isVideo: false }),
    false,
    'burn files must not use persistent cache',
  );
  assert.equal(
    shouldPersistMediaCache({ messageType: 4, isBurn: false, isVideo: true }),
    false,
    'video preview should not use generic file cache path',
  );

  console.log('media preview helpers ok');
}

void run();
