import { useEffect, useRef, useState } from 'react';
import type { VoiceMessageMetadata } from '../../core/media-message';

export const VOICE_RECORDER_MAX_DURATION_MS = 60_000;
export const VOICE_RECORDER_MIN_DURATION_MS = 1_000;

const PREFERRED_VOICE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] as const;

export type VoiceRecorderStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'recorded-preview'
  | 'failed'
  | 'cleanup';

export type VoiceRecorderErrorKind =
  | 'permission-denied'
  | 'unavailable-microphone'
  | 'unsupported-recorder'
  | 'too-short'
  | 'recording-failed'
  | 'unknown';

export type VoiceRecorderDraft = {
  file: File;
  previewUrl: string;
  voice: VoiceMessageMetadata;
  durationMs: number;
  mimeType: string;
};

export type VoiceRecorderState = {
  status: VoiceRecorderStatus;
  error: string | null;
  errorKind: VoiceRecorderErrorKind | null;
  durationMs: number;
  selectedMimeType: string | null;
  draft: VoiceRecorderDraft | null;
  liveWaveform: number[];
};

export type VoiceRecorderResources = {
  recorder?: Pick<MediaRecorder, 'state' | 'stop'> | null;
  mediaStream?: MediaStream | null;
  timerId?: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | number | null;
  previewUrl?: string | null;
  audioContext?: Pick<AudioContext, 'close'> | null;
};

export type VoiceRecorderStartResult = {
  draft: VoiceRecorderDraft;
};

export type VoiceRecorderOptions = {
  maxDurationMs?: number;
  minDurationMs?: number;
  onDraftReady?: (draft: VoiceRecorderDraft) => void;
};

type GetUserMediaFn = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

export type VoiceRecorderPermission = {
  getUserMedia?: GetUserMediaFn;
  isTypeSupported?: (mimeType: string) => boolean;
};

export type ComposerSendState = {
  hasActiveConversation: boolean;
  sendingMessage: boolean;
  mediaUploading: boolean;
  messageText: string;
  messageType: 1 | 2 | 3 | 4;
  mediaUrl: string;
};

type RecorderConstraintError = {
  name?: string;
  message?: string;
};

function normalizeRecorderError(error: unknown): VoiceRecorderErrorKind {
  const value = error as RecorderConstraintError | null;
  const name = value?.name?.toLowerCase() ?? '';
  const message = value?.message?.toLowerCase() ?? '';
  if (name.includes('notallowed') || message.includes('permission')) {
    return 'permission-denied';
  }
  if (name.includes('notfound') || name.includes('overconstrained') || message.includes('microphone')) {
    return 'unavailable-microphone';
  }
  if (name.includes('notsupported') || message.includes('not supported')) {
    return 'unsupported-recorder';
  }
  return 'unknown';
}

function resolveRecorderMimeType(isTypeSupported?: (mimeType: string) => boolean): string | null {
  const supportCheck = isTypeSupported ?? ((mimeType: string) => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return false;
    }
    return MediaRecorder.isTypeSupported(mimeType);
  });
  for (const mimeType of PREFERRED_VOICE_MIME_TYPES) {
    if (supportCheck(mimeType)) {
      return mimeType;
    }
  }
  return null;
}

function deriveVoiceCodec(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('opus')) {
    return 'opus';
  }
  if (normalized.includes('mp4')) {
    return 'aac';
  }
  if (normalized.includes('webm')) {
    return 'webm';
  }
  return 'unknown';
}

function inferVoiceFileExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('mp4')) {
    return 'm4a';
  }
  if (normalized.includes('webm')) {
    return 'webm';
  }
  return 'dat';
}

export function selectVoiceRecorderMimeType(permission?: VoiceRecorderPermission): string | null {
  return resolveRecorderMimeType(permission?.isTypeSupported);
}

export function formatVoiceDuration(durationMs: number): string {
  const safeDuration = Math.max(0, Math.floor(durationMs));
  const totalSeconds = Math.floor(safeDuration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function validateVoiceRecordingDuration(durationMs: number, minDurationMs = VOICE_RECORDER_MIN_DURATION_MS): {
  ok: boolean;
  reason?: VoiceRecorderErrorKind;
} {
  if (durationMs < minDurationMs) {
    return { ok: false, reason: 'too-short' };
  }
  return { ok: true };
}

export function buildVoiceMessageMetadata(durationMs: number, mimeType: string, waveform: number[] = []): VoiceMessageMetadata {
  return {
    durationMs: Math.round(durationMs),
    waveform: waveform.slice(0, 128).map((value) => {
      const normalized = Number.isFinite(value) ? Math.round(value) : 0;
      return Math.max(0, Math.min(31, normalized));
    }),
    waveformVersion: 1,
    codec: deriveVoiceCodec(mimeType),
  };
}

export function releaseVoiceRecorderResources(resources: VoiceRecorderResources): void {
  if (resources.timerId !== null && resources.timerId !== undefined) {
    clearTimeout(resources.timerId as ReturnType<typeof setTimeout>);
    clearInterval(resources.timerId as ReturnType<typeof setInterval>);
  }
  if (resources.recorder && resources.recorder.state !== 'inactive') {
    try {
      resources.recorder.stop();
    } catch {
      // ignore stop errors during cleanup
    }
  }
  if (resources.mediaStream) {
    for (const track of resources.mediaStream.getTracks()) {
      try {
        track.stop();
      } catch {
        // ignore track cleanup errors
      }
    }
  }
  if (resources.audioContext) {
    try {
      void resources.audioContext.close();
    } catch {
      // ignore audio context cleanup errors
    }
  }
  if (resources.previewUrl && resources.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(resources.previewUrl);
  }
}

export function releaseActiveRecordingResources(
  resources: Pick<VoiceRecorderResources, 'mediaStream' | 'audioContext'>,
): void {
  if (resources.mediaStream) {
    for (const track of resources.mediaStream.getTracks()) {
      try {
        track.stop();
      } catch {
        // ignore track cleanup errors
      }
    }
  }
  if (resources.audioContext) {
    try {
      void resources.audioContext.close();
    } catch {
      // ignore audio context cleanup errors
    }
  }
}

export function normalizeWaveformValue(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(31, Math.round(numeric)));
}

export function generateStableWaveformPeaks(audioBuffer: AudioBuffer, peakCount = 48): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerPeak = Math.floor(channelData.length / peakCount);
  if (samplesPerPeak <= 0) {
    return Array(peakCount).fill(0);
  }
  const peaks: number[] = [];
  for (let i = 0; i < peakCount; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channelData.length);
    let maxAbs = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > maxAbs) maxAbs = abs;
    }
    peaks.push(normalizeWaveformValue(maxAbs * 31));
  }
  return peaks;
}

export async function decodeAudioBlobToPeaks(blob: Blob, peakCount = 48): Promise<number[]> {
  const audioContext = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return generateStableWaveformPeaks(audioBuffer, peakCount);
  } finally {
    await audioContext.close();
  }
}

export function createAudioAnalyser(stream: MediaStream): { analyser: AnalyserNode; audioContext: AudioContext; getWaveformData: () => number[] } {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  return {
    analyser,
    audioContext,
    getWaveformData: () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.ceil(bufferLength / 32);
      const peaks: number[] = [];
      for (let i = 0; i < 32; i++) {
        const idx = Math.min(i * step, bufferLength - 1);
        peaks.push(normalizeWaveformValue((dataArray[idx] / 255) * 31));
      }
      return peaks;
    },
  };
}

export function canSendComposerMessage(state: ComposerSendState): boolean {
  if (!state.hasActiveConversation || state.sendingMessage || state.mediaUploading) {
    return false;
  }

  const text = state.messageText.trim();
  if (state.messageType === 1) {
    return text.length > 0;
  }

  return state.mediaUrl.trim().length > 0;
}

export function resolveVoiceRecorderErrorMessage(kind: VoiceRecorderErrorKind | null): string {
  switch (kind) {
    case 'permission-denied':
      return '麦克风权限被拒绝，请在系统设置中允许访问麦克风。';
    case 'unavailable-microphone':
      return '未检测到可用麦克风，请检查设备连接。';
    case 'unsupported-recorder':
      return '当前环境不支持语音录制，请切换到兼容的桌面 WebView。';
    case 'too-short':
      return '录音至少需要 1 秒，请重新录制。';
    case 'recording-failed':
      return '语音录制失败，请重试。';
    default:
      return '语音录制失败，请重试。';
  }
}

export function useDesktopVoiceRecorder(options: VoiceRecorderOptions = {}) {
  const { maxDurationMs = VOICE_RECORDER_MAX_DURATION_MS, minDurationMs = VOICE_RECORDER_MIN_DURATION_MS, onDraftReady } = options;
  const [state, setState] = useState<VoiceRecorderState>({
    status: 'idle',
    error: null,
    errorKind: null,
    durationMs: 0,
    selectedMimeType: null,
    draft: null,
    liveWaveform: [],
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const previewUrlRef = useRef<string | null>(null);
  const selectedMimeTypeRef = useRef<string | null>(null);
  const analyserRef = useRef<{ analyser: AnalyserNode; audioContext: AudioContext; getWaveformData: () => number[] } | null>(null);
  const liveWaveformRef = useRef<number[]>([]);

  function clearTimers(): void {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function resetDraft(): void {
    if (previewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
    setState({
      status: 'idle',
      error: null,
      errorKind: null,
      durationMs: 0,
      selectedMimeType: null,
      draft: null,
      liveWaveform: [],
    });
  }

  function cleanupRecorder(): void {
    setState((current) => ({ ...current, status: 'cleanup' }));
    clearTimers();
    if (analyserRef.current) {
      try {
        analyserRef.current.audioContext.close();
      } catch { /* ignore */ }
      analyserRef.current = null;
    }
    liveWaveformRef.current = [];
    releaseVoiceRecorderResources({
      recorder: recorderRef.current,
      mediaStream: streamRef.current,
      previewUrl: previewUrlRef.current,
    });
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    selectedMimeTypeRef.current = null;
    resetDraft();
  }

  function failRecording(errorKind: VoiceRecorderErrorKind, fallbackMessage?: string): void {
    clearTimers();
    releaseVoiceRecorderResources({
      recorder: recorderRef.current,
      mediaStream: streamRef.current,
      previewUrl: previewUrlRef.current,
    });
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    selectedMimeTypeRef.current = null;
    setState({
      status: 'failed',
      error: fallbackMessage ?? resolveVoiceRecorderErrorMessage(errorKind),
      errorKind,
      durationMs: 0,
      selectedMimeType: null,
      draft: null,
      liveWaveform: [],
    });
  }

  async function startRecording(permission?: VoiceRecorderPermission): Promise<boolean> {
    if (state.status === 'recording' || state.status === 'requesting-permission') {
      return false;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      failRecording('unavailable-microphone');
      return false;
    }

    const mimeType = selectVoiceRecorderMimeType(permission);
    if (!mimeType) {
      failRecording('unsupported-recorder');
      return false;
    }

    setState({
      status: 'requesting-permission',
      error: null,
      errorKind: null,
      durationMs: 0,
      selectedMimeType: mimeType,
      draft: null,
      liveWaveform: [],
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!stream.getAudioTracks().length) {
        throw Object.assign(new Error('No audio tracks available'), { name: 'NotFoundError' });
      }
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];
      selectedMimeTypeRef.current = mimeType;
      startedAtRef.current = Date.now();
      setState((current) => ({
        ...current,
        status: 'recording',
        error: null,
        errorKind: null,
        durationMs: 0,
        selectedMimeType: mimeType,
      }));

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const durationMs = Date.now() - startedAtRef.current;
        clearTimers();
        releaseActiveRecordingResources({
          mediaStream: streamRef.current,
          audioContext: analyserRef.current?.audioContext ?? null,
        });
        streamRef.current = null;
        analyserRef.current = null;
        liveWaveformRef.current = [];
        const durationValidation = validateVoiceRecordingDuration(durationMs, minDurationMs);
        if (!durationValidation.ok) {
          failRecording(durationValidation.reason ?? 'too-short');
          return;
        }
        const blobType = recorder.mimeType || selectedMimeTypeRef.current || mimeType;
        const blob = new Blob(chunksRef.current, { type: blobType });
        let waveformPeaks: number[] = [];
        try {
          waveformPeaks = await decodeAudioBlobToPeaks(blob, 48);
        } catch {
          // waveform extraction failed, leave empty
        }
        const previewUrl = URL.createObjectURL(blob);
        const fileName = `voice-message.${inferVoiceFileExtension(blobType)}`;
        const file = new File([blob], fileName, { type: blobType });
        const draft: VoiceRecorderDraft = {
          file,
          previewUrl,
          voice: buildVoiceMessageMetadata(durationMs, blobType, waveformPeaks),
          durationMs,
          mimeType: blobType,
        };
        if (previewUrlRef.current?.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = previewUrl;
        setState({
          status: 'recorded-preview',
          error: null,
          errorKind: null,
          durationMs,
          selectedMimeType: blobType,
          draft,
          liveWaveform: [],
        });
        recorderRef.current = null;
        chunksRef.current = [];
        startedAtRef.current = 0;
        selectedMimeTypeRef.current = null;
        onDraftReady?.(draft);
      };

      recorder.onerror = () => {
        failRecording('recording-failed');
      };

      recorder.start();
      const { analyser, audioContext, getWaveformData } = createAudioAnalyser(stream);
      analyserRef.current = { analyser, audioContext, getWaveformData };
      liveWaveformRef.current = [];
      timerRef.current = setInterval(() => {
        const nextDuration = Date.now() - startedAtRef.current;
        const waveformData = getWaveformData();
        liveWaveformRef.current = waveformData;
        setState((current) => ({
          ...current,
          durationMs: nextDuration,
          liveWaveform: waveformData,
        }));
        if (nextDuration >= maxDurationMs) {
          stopRecording();
        }
      }, 150);
      stopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, maxDurationMs);
      return true;
    } catch (error) {
      releaseVoiceRecorderResources({
        recorder: recorderRef.current,
        mediaStream: streamRef.current,
        previewUrl: previewUrlRef.current,
      });
      recorderRef.current = null;
      streamRef.current = null;
      chunksRef.current = [];
      startedAtRef.current = 0;
      selectedMimeTypeRef.current = null;
      const errorKind = normalizeRecorderError(error);
      failRecording(errorKind, resolveVoiceRecorderErrorMessage(errorKind));
      return false;
    }
  }

  function stopRecording(): void {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }
    clearTimers();
    try {
      recorderRef.current.stop();
    } catch (error) {
      failRecording('recording-failed', error instanceof Error ? error.message : undefined);
    }
  }

  function cancelRecording(): void {
    clearTimers();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore stop errors during cancel
      }
    }
    cleanupRecorder();
  }

  function reset(): void {
    cleanupRecorder();
  }

  useEffect(() => {
    return () => {
      clearTimers();
      releaseVoiceRecorderResources({
        recorder: recorderRef.current,
        mediaStream: streamRef.current,
        previewUrl: previewUrlRef.current,
      });
    };
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    canRetry: state.status === 'failed',
  };
}
