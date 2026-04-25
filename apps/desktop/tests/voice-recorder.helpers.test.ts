import assert from 'node:assert/strict';
import {
  buildVoiceMessageMetadata,
  canSendComposerMessage,
  consumeCanceledRecorderStop,
  formatVoiceDuration,
  releaseActiveRecordingResources,
  releaseVoiceRecorderResources,
  selectVoiceRecorderMimeType,
  validateVoiceRecordingDuration,
} from '../src/features/chat/voice-recorder';

assert.equal(
  selectVoiceRecorderMimeType({
    isTypeSupported: (mimeType) => mimeType === 'audio/webm',
  }),
  'audio/webm',
);

assert.equal(
  selectVoiceRecorderMimeType({
    isTypeSupported: (mimeType) => mimeType === 'audio/mp4',
  }),
  'audio/mp4',
);

assert.equal(selectVoiceRecorderMimeType({ isTypeSupported: () => false }), null);

assert.deepEqual(validateVoiceRecordingDuration(999), { ok: false, reason: 'too-short' });
assert.deepEqual(validateVoiceRecordingDuration(1_000), { ok: true });
assert.equal(formatVoiceDuration(65_432), '1:05');

const voice = buildVoiceMessageMetadata(2_345, 'audio/webm;codecs=opus', [1, 8.2, 40, -3]);
assert.deepEqual(voice, {
  durationMs: 2_345,
  waveform: [1, 8, 31, 0],
  waveformVersion: 1,
  codec: 'opus',
});

assert.equal(
  canSendComposerMessage({
    hasActiveConversation: true,
    sendingMessage: false,
    mediaUploading: false,
    messageText: '',
    messageType: 3,
    mediaUrl: 'voice-message.webm',
  }),
  true,
);

assert.equal(
  canSendComposerMessage({
    hasActiveConversation: true,
    sendingMessage: false,
    mediaUploading: false,
    messageText: '',
    messageType: 1,
    mediaUrl: '',
  }),
  false,
);

let revokedUrl = '';
const originalRevokeObjectURL = URL.revokeObjectURL;
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: (value: string) => {
    revokedUrl = value;
  },
});

let trackStopped = false;
let recorderStopped = false;
let audioContextClosed = false;
releaseVoiceRecorderResources({
  recorder: {
    state: 'recording',
    stop: () => {
      recorderStopped = true;
    },
  },
  mediaStream: {
    getTracks: () => [
      {
        stop: () => {
          trackStopped = true;
        },
      },
    ],
  } as unknown as MediaStream,
  previewUrl: 'blob:test-voice-url',
  audioContext: {
    close: async () => {
      audioContextClosed = true;
    },
  },
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: originalRevokeObjectURL,
});

assert.equal(recorderStopped, true);
assert.equal(trackStopped, true);
assert.equal(audioContextClosed, true);
assert.equal(revokedUrl, 'blob:test-voice-url');

let activeTrackStopped = false;
let activeAudioContextClosed = false;
releaseActiveRecordingResources({
  mediaStream: {
    getTracks: () => [
      {
        stop: () => {
          activeTrackStopped = true;
        },
      },
    ],
  } as unknown as MediaStream,
  audioContext: {
    close: async () => {
      activeAudioContextClosed = true;
    },
  },
});

assert.equal(activeTrackStopped, true);
assert.equal(activeAudioContextClosed, true);

const cancelRef = { current: true };
assert.equal(consumeCanceledRecorderStop(cancelRef), true);
assert.equal(cancelRef.current, false);
assert.equal(consumeCanceledRecorderStop(cancelRef), false);

console.log('voice recorder helpers ok');
