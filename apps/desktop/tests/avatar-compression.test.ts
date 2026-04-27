import assert from 'node:assert/strict';
import { compressAvatarImage, isSupportedAvatarMimeType } from '../src/core/avatar';

async function main(): Promise<void> {
  const inputFile = new File([new Uint8Array(4096)], 'avatar.png', { type: 'image/png' });

  let drawCalled = false;
  const outputBlob = new Blob([new Uint8Array(128)], { type: 'image/webp' });

  const compressed = await compressAvatarImage(inputFile, {
    maxDimension: 512,
    maxBytes: 1024,
    outputType: 'image/webp',
    quality: 0.82,
  }, {
    createImageBitmap: async () => ({ width: 2000, height: 1000, close: () => undefined }),
    createCanvas: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) => {
          drawCalled = true;
          assert.equal(width, 512);
          assert.equal(height, 256);
        },
      }),
      toBlob: (callback: (blob: Blob | null) => void) => callback(outputBlob),
    }),
  });

  assert.equal(drawCalled, true, 'compression should draw a resized image to canvas');
  assert.equal(compressed.name, 'avatar.webp');
  assert.equal(compressed.type, 'image/webp');
  assert.equal(compressed.size, 128);

  const retrySizes = [2048, 1536, 900, 300];
  const retryWidths: number[] = [];
  const retried = await compressAvatarImage(inputFile, {
    maxDimension: 512,
    maxBytes: 512,
    outputType: 'image/webp',
    quality: 0.82,
  }, {
    createImageBitmap: async () => ({ width: 1600, height: 1600, close: () => undefined }),
    createCanvas: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (_image: unknown, _x: number, _y: number, width: number) => {
          retryWidths.push(width);
        },
      }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        const size = retrySizes.shift() ?? 300;
        callback(new Blob([new Uint8Array(size)], { type: 'image/webp' }));
      },
    }),
  });

  assert.equal(retried.size, 300, 'compression should retry until the avatar fits the byte limit');
  assert.deepEqual(retryWidths, [512, 384, 256, 192]);

  await assert.rejects(
    () => compressAvatarImage(new File(['gif'], 'avatar.gif', { type: 'image/gif' })),
    /Unsupported avatar image type/,
  );

  await assert.rejects(
    () => compressAvatarImage(inputFile, undefined, {
      createImageBitmap: async () => {
        throw new Error('decode failed');
      },
    }),
    /decode failed/,
  );

  assert.equal(isSupportedAvatarMimeType('image/png'), true);
  assert.equal(isSupportedAvatarMimeType('image/jpeg'), true);
  assert.equal(isSupportedAvatarMimeType('image/webp'), true);
  assert.equal(isSupportedAvatarMimeType('image/gif'), false);

  console.log('avatar compression ok');
}

void main();
