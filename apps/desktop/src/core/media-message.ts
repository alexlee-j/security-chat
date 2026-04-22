import type { EncryptedMediaPayload } from './media-crypto';

export type MediaMessagePayload = {
  text?: string;
  media?: EncryptedMediaPayload;
  mediaUrl?: string;
  fileName?: string;
  voice?: VoiceMessageMetadata;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };
};

export type VoiceMessageMetadata = {
  durationMs: number;
  waveform: number[];
  waveformVersion: 1;
  codec: string;
};

export type BuildMediaMessagePayloadInput = Pick<
  MediaMessagePayload,
  'text' | 'media' | 'mediaUrl' | 'fileName' | 'voice' | 'replyTo'
>;

export type SendV2TransportPayloadInput = {
  conversationId: string;
  messageType: 1 | 2 | 3 | 4;
  nonce: string;
  envelopes: Array<{
    targetUserId: string;
    targetDeviceId: string;
    encryptedPayload: string;
  }>;
  mediaAssetId?: string;
  isBurn: boolean;
  burnDuration?: number;
  voice?: VoiceMessageMetadata;
};

export type SendV2TransportPayload = Omit<SendV2TransportPayloadInput, 'voice'>;

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

function normalizeWaveformValue(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(31, Math.round(numeric)));
}

export function normalizeVoiceMessageMetadata(value: unknown): VoiceMessageMetadata | undefined {
  const candidate = value as Partial<VoiceMessageMetadata> | null;
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }
  if (candidate.waveformVersion !== 1) {
    return undefined;
  }
  if (typeof candidate.durationMs !== 'number' || !Number.isFinite(candidate.durationMs) || candidate.durationMs <= 0) {
    return undefined;
  }
  if (!Array.isArray(candidate.waveform)) {
    return undefined;
  }
  const codec = typeof candidate.codec === 'string' && candidate.codec.trim()
    ? candidate.codec.trim().slice(0, 32)
    : 'unknown';
  return {
    durationMs: Math.round(candidate.durationMs),
    waveform: candidate.waveform.slice(0, 128).map(normalizeWaveformValue),
    waveformVersion: 1,
    codec,
  };
}

export function isVoiceMessageMetadata(value: unknown): value is VoiceMessageMetadata {
  return normalizeVoiceMessageMetadata(value) !== undefined;
}

export function buildMediaMessagePayload(
  messageType: 1 | 2 | 3 | 4,
  input: BuildMediaMessagePayloadInput,
): MediaMessagePayload & { type: 1 | 2 | 3 | 4 } {
  const legacyMediaFields = buildLegacyMediaFields(messageType, input);
  const voice = messageType === 3 ? normalizeVoiceMessageMetadata(input.voice) : undefined;
  const payload: MediaMessagePayload & { type: 1 | 2 | 3 | 4 } = {
    type: messageType,
    text: input.text?.trim() || undefined,
    media: input.media,
    mediaUrl: legacyMediaFields.mediaUrl,
    fileName: legacyMediaFields.fileName,
    replyTo: input.replyTo,
  };
  if (voice) {
    payload.voice = voice;
  }
  return payload;
}

export function buildSendV2TransportPayload(input: SendV2TransportPayloadInput): SendV2TransportPayload {
  return {
    conversationId: input.conversationId,
    messageType: input.messageType,
    nonce: input.nonce,
    envelopes: input.envelopes,
    mediaAssetId: input.mediaAssetId,
    isBurn: input.isBurn,
    burnDuration: input.isBurn ? input.burnDuration : undefined,
  };
}
