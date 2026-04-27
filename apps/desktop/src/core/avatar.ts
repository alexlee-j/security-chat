const SUPPORTED_AVATAR_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type AvatarCompressionOptions = {
  maxDimension: number;
  maxBytes: number;
  outputType: 'image/jpeg' | 'image/png' | 'image/webp';
  quality: number;
};

type BitmapLike = {
  width: number;
  height: number;
  close?: () => void;
};

type CanvasLike = {
  width: number;
  height: number;
  getContext: (contextId: '2d') => { drawImage: (image: unknown, x: number, y: number, width: number, height: number) => void } | null;
  toBlob: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
};

export type AvatarCompressionAdapters = {
  createImageBitmap?: (file: File) => Promise<BitmapLike>;
  createCanvas?: () => CanvasLike;
};

const DEFAULT_COMPRESSION_OPTIONS: AvatarCompressionOptions = {
  maxDimension: 512,
  maxBytes: 256 * 1024,
  outputType: 'image/jpeg',
  quality: 0.82,
};

export function isSupportedAvatarMimeType(mimeType: string): boolean {
  return SUPPORTED_AVATAR_MIME_TYPES.has(mimeType.toLowerCase());
}

export async function compressAvatarImage(
  file: File,
  options: Partial<AvatarCompressionOptions> = {},
  adapters: AvatarCompressionAdapters = {},
): Promise<File> {
  const resolved = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  if (!isSupportedAvatarMimeType(file.type)) {
    throw new Error('Unsupported avatar image type');
  }

  const createBitmap = adapters.createImageBitmap ?? globalThis.createImageBitmap;
  if (!createBitmap) {
    throw new Error('Avatar compression is not supported in this environment');
  }

  const bitmap = await createBitmap(file);
  try {
    const canvas = adapters.createCanvas?.() ?? document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Avatar compression canvas is unavailable');
    }

    const attempts = buildCompressionAttempts(resolved);
    let smallestBlob: Blob | null = null;
    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = width;
      canvas.height = height;
      const drawImage = context.drawImage as unknown as (image: unknown, x: number, y: number, width: number, height: number) => void;
      drawImage.call(context, bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (!nextBlob) {
            reject(new Error('Avatar compression failed'));
            return;
          }
          resolve(nextBlob);
        }, resolved.outputType, attempt.quality);
      });

      if (!smallestBlob || blob.size < smallestBlob.size) {
        smallestBlob = blob;
      }
      if (blob.size <= resolved.maxBytes) {
        return new File([blob], avatarOutputName(file.name, resolved.outputType), { type: resolved.outputType });
      }
    }

    throw new Error(`头像压缩后仍超过 ${formatBytes(resolved.maxBytes)}，请换一张更简单或更小的图片`);
  } finally {
    bitmap.close?.();
  }
}

export function resolveAvatarSrc(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) {
    return undefined;
  }
  if (/^https?:\/\//i.test(avatarUrl) || avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:')) {
    return avatarUrl;
  }
  const apiBase = getApiBaseUrl();
  if (avatarUrl.startsWith('/')) {
    return `${new URL(apiBase).origin}${avatarUrl}`;
  }
  return avatarUrl;
}

function avatarOutputName(inputName: string, mimeType: string): string {
  const baseName = inputName.replace(/\.[^.]+$/, '') || 'avatar';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'webp';
  return `${baseName}.${extension}`;
}

function buildCompressionAttempts(options: AvatarCompressionOptions): Array<{ maxDimension: number; quality: number }> {
  const dimensions = [
    options.maxDimension,
    Math.round(options.maxDimension * 0.75),
    Math.round(options.maxDimension * 0.5),
    Math.round(options.maxDimension * 0.375),
    Math.round(options.maxDimension * 0.25),
  ];
  const qualities = [
    options.quality,
    Math.max(0.72, options.quality - 0.1),
    Math.max(0.62, options.quality - 0.2),
    Math.max(0.52, options.quality - 0.3),
    Math.max(0.42, options.quality - 0.4),
  ];
  return dimensions.map((maxDimension, index) => ({
    maxDimension: Math.max(96, maxDimension),
    quality: qualities[index] ?? 0.52,
  }));
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}

function getApiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env;
  return env?.VITE_API_URL ?? 'http://localhost:3000/api/v1';
}
