import assert from 'node:assert/strict';
import { buildMediaCacheKey } from '../src/core/native-file';

const keyA = buildMediaCacheKey({
  mediaAssetId: 'asset-a',
  plainDigest: 'digest-aaaaaaaaaaaaaaaaaaaaaaaa',
});
const keyB = buildMediaCacheKey({
  mediaAssetId: 'asset-a',
  plainDigest: 'digest-bbbbbbbbbbbbbbbbbbbbbbbb',
});
const keyNoDigest = buildMediaCacheKey({
  mediaAssetId: 'asset-a',
});

assert.notEqual(
  keyA,
  keyB,
  'same asset id with different digests should not collide',
);
assert.equal(
  keyNoDigest,
  'asset-a',
  'legacy media without digest should fall back to asset id',
);
assert.equal(
  buildMediaCacheKey({
    mediaAssetId: ' asset-a ',
    plainDigest: '  digest-cccccccccccccccccccccccc ',
  }),
  'asset-a-digest-ccccccccc',
);

console.log('native file cache key ok');
