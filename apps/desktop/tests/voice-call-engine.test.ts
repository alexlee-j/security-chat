import assert from 'node:assert/strict';
import {
  addAudioTracksToPeerConnection,
  buildCallHistoryPreview,
  createInitialVoiceCallState,
  describeWebRtcCompatibilityFailure,
  detectWebRtcCompatibility,
  isTerminalVoiceCallStatus,
  reduceVoiceCallState,
  releaseVoiceCallResources,
  normalizeCallHistoryEntry,
} from '../src/core/voice-call-engine';

const compatibility = detectWebRtcCompatibility({
  navigator: {
    mediaDevices: {
      getUserMedia: async () => undefined,
    },
  } as never,
  RTCPeerConnection: function MockPeerConnection() {} as never,
  HTMLAudioElement: function MockAudioElement() {} as never,
});

assert.deepEqual(compatibility, {
  getUserMedia: true,
  rtcpPeerConnection: true,
  audioOutput: true,
  cleanup: true,
});
assert.equal(describeWebRtcCompatibilityFailure(compatibility), '当前桌面环境支持 WebRTC 语音通话');
assert.match(describeWebRtcCompatibilityFailure({
  getUserMedia: true,
  rtcpPeerConnection: false,
  audioOutput: true,
  cleanup: true,
}), /WebRTC 连接 API/);

const initial = createInitialVoiceCallState();
const requesting = reduceVoiceCallState(initial, {
  type: 'requesting-permission',
  conversationId: 'conversation-1',
  peerUserId: 'peer-1',
  direction: 'outgoing',
});
assert.equal(requesting.status, 'requesting-permission');
assert.equal(requesting.direction, 'outgoing');

const muted = reduceVoiceCallState(
  reduceVoiceCallState(requesting, {
    type: 'outgoing-started',
    callId: 'call-1',
    conversationId: 'conversation-1',
    peerUserId: 'peer-1',
  }),
  { type: 'muted', muted: true },
);
assert.equal(muted.status, 'outgoing');
assert.equal(muted.isMuted, true);

const connected = reduceVoiceCallState(muted, {
  type: 'connected',
  callId: 'call-1',
  conversationId: 'conversation-1',
});
assert.equal(connected.status, 'muted');
assert.equal(connected.localStreamActive, true);

const unmuted = reduceVoiceCallState(connected, { type: 'muted', muted: false });
assert.equal(unmuted.status, 'connected');
assert.equal(unmuted.isMuted, false);

const permissionDenied = reduceVoiceCallState(requesting, { type: 'failed', error: 'Permission denied' });
assert.equal(permissionDenied.status, 'failed');
assert.equal(permissionDenied.error, 'Permission denied');

const answeredElsewhere = reduceVoiceCallState(initial, {
  type: 'answered-elsewhere',
  callId: 'call-2',
  conversationId: 'conversation-2',
});
assert.equal(answeredElsewhere.status, 'answered-elsewhere');
assert.equal(isTerminalVoiceCallStatus(answeredElsewhere.status), true);

const historyEntry = normalizeCallHistoryEntry({
  id: 'record-1',
  conversationId: 'conversation-1',
  callerUserId: 'user-a',
  calleeUserId: 'user-b',
  callerDeviceId: null,
  acceptedDeviceId: null,
  outcome: 'completed',
  startedAt: '2026-04-22T08:00:00.000Z',
  acceptedAt: '2026-04-22T08:00:05.000Z',
  endedAt: '2026-04-22T08:00:35.000Z',
  durationSeconds: 30,
  createdByUserId: 'user-a',
  createdAt: '2026-04-22T08:00:35.000Z',
}, 'user-a');

assert.equal(historyEntry.kind, 'call');
assert.match(historyEntry.preview, /我发起的/);
assert.match(buildCallHistoryPreview({
  outcome: 'answered_elsewhere',
  callerUserId: 'user-a',
  calleeUserId: 'user-b',
  durationSeconds: 0,
}, 'user-b'), /已由其他设备接听/);

let trackStopped = false;
let pcClosed = false;
let audioPaused = false;
let audioLoaded = false;
let revoked = '';
const originalRevokeObjectURL = URL.revokeObjectURL;
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: (value: string) => {
    revoked = value;
  },
});

releaseVoiceCallResources({
  localStream: {
    getTracks: () => [
      {
        stop: () => {
          trackStopped = true;
        },
      },
    ],
  } as never,
  peerConnection: {
    close: () => {
      pcClosed = true;
    },
  } as never,
  remoteAudio: {
    pause: () => {
      audioPaused = true;
    },
    removeAttribute: () => undefined,
    load: () => {
      audioLoaded = true;
    },
  } as never,
  remoteObjectUrl: 'blob:voice-call-test',
  clearTimers: [],
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: originalRevokeObjectURL,
});

assert.equal(trackStopped, true);
assert.equal(pcClosed, true);
assert.equal(audioPaused, true);
assert.equal(audioLoaded, true);
assert.equal(revoked, 'blob:voice-call-test');

const audioTrack = { kind: 'audio' };
const duplicateAudioTrack = { kind: 'audio' };
const addedTracks: unknown[] = [];
addAudioTracksToPeerConnection({
  getSenders: () => [{ track: duplicateAudioTrack }],
  addTrack: (track: unknown) => {
    addedTracks.push(track);
    return {} as RTCRtpSender;
  },
} as unknown as RTCPeerConnection, {
  getAudioTracks: () => [duplicateAudioTrack, audioTrack],
} as unknown as MediaStream);

assert.deepEqual(addedTracks, [audioTrack]);

console.log('voice call engine ok');
