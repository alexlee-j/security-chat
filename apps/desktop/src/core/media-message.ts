import type { EncryptedMediaPayload } from './media-crypto';

export type MediaMessagePayload = {
  text?: string;
  media?: EncryptedMediaPayload;
  mediaUrl?: string;
  fileName?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };
};

const VIDEO_FILE_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'm4v',
  'webm',
  'mkv',
  'avi',
  'wmv',
  'flv',
  'mpeg',
  'mpg',
]);

export function resolveLegacyMediaUrl(payload: Pick<MediaMessagePayload, 'mediaUrl'> | null | undefined): string | null {
  const value = payload?.mediaUrl?.trim();
  return value ? value : null;
}

export function resolveMediaFileName(
  payload: Pick<MediaMessagePayload, 'media' | 'fileName'> | null | undefined,
  fallback = 'download',
): string {
  const encryptedName = payload?.media?.fileName?.trim();
  if (encryptedName) {
    return encryptedName;
  }
  const legacyName = payload?.fileName?.trim();
  if (legacyName) {
    return legacyName;
  }
  return fallback;
}

export function resolveMediaMimeType(
  payload: Pick<MediaMessagePayload, 'media'> | null | undefined,
  fallback = 'application/octet-stream',
): string {
  const mimeType = payload?.media?.mimeType?.trim();
  return mimeType || fallback;
}

export function resolveMediaSize(
  payload: Pick<MediaMessagePayload, 'media'> | null | undefined,
): number | null {
  const size = payload?.media?.plainSize;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : null;
}

export function formatMediaSize(size: number | null | undefined): string | undefined {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return undefined;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  for (const unit of units) {
    if (value < 1024 || unit === units[units.length - 1]) {
      return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
    }
    value /= 1024;
  }
  return undefined;
}

export function isVideoMediaPayload(
  payload: Pick<MediaMessagePayload, 'media' | 'fileName'> | null | undefined,
): boolean {
  const mimeType = payload?.media?.mimeType?.trim().toLowerCase();
  if (mimeType?.startsWith('video/')) {
    return true;
  }
  const fileName = resolveMediaFileName(payload, '').toLowerCase();
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  return Boolean(extension && VIDEO_FILE_EXTENSIONS.has(extension));
}

export function resolveMediaBubbleContent(
  messageType: 1 | 2 | 3 | 4,
  payload: MediaMessagePayload,
  resolvedSource?: string | null,
): string {
  if (messageType === 1) {
    return payload.text?.trim() ?? '';
  }
  if (messageType === 2 || messageType === 3) {
    return resolvedSource?.trim() || resolveLegacyMediaUrl(payload) || '';
  }
  return resolveLegacyMediaUrl(payload) || resolveMediaFileName(payload, 'file');
}

export function buildLegacyMediaFields(
  messageType: 1 | 2 | 3 | 4,
  payload: Pick<MediaMessagePayload, 'media' | 'mediaUrl' | 'fileName'>,
): { mediaUrl?: string; fileName?: string } {
  if (payload.media) {
    return {};
  }

  const mediaUrl = resolveLegacyMediaUrl(payload);
  return {
    mediaUrl: messageType === 1 ? undefined : mediaUrl ?? undefined,
    fileName: messageType === 4 ? resolveMediaFileName(payload, 'file') : undefined,
  };
}
