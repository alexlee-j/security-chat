import type { CallRecordItem, CallOutcome, ConversationListItem } from './types';

export type VoiceCallStatus =
  | 'idle'
  | 'requesting-permission'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'muted'
  | 'ended'
  | 'failed'
  | 'timeout'
  | 'answered-elsewhere';

export type VoiceCallDirection = 'incoming' | 'outgoing';

export type VoiceCallCompatibility = {
  getUserMedia: boolean;
  rtcpPeerConnection: boolean;
  audioOutput: boolean;
  cleanup: boolean;
};

export type VoiceCallIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: string;
};

export type VoiceCallState = {
  status: VoiceCallStatus;
  callId: string | null;
  conversationId: string | null;
  direction: VoiceCallDirection | null;
  peerUserId: string | null;
  peerDeviceId: string | null;
  isMuted: boolean;
  error: string | null;
  startedAt: string | null;
  acceptedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  elapsedSeconds: number;
  compatibility: VoiceCallCompatibility;
  iceServers: VoiceCallIceServer[];
  autoplayBlocked: boolean;
  localStreamActive: boolean;
  remoteStreamActive: boolean;
  incomingFromUserId: string | null;
  incomingFromDeviceId: string | null;
};

export type VoiceCallHistoryEntry = CallRecordItem & {
  kind: 'call';
  preview: string;
  timeLabel: string;
};

export type VoiceCallCleanupResources = {
  localStream?: MediaStream | null;
  peerConnection?: RTCPeerConnection | null;
  remoteAudio?: HTMLAudioElement | null;
  remoteObjectUrl?: string | null;
  clearTimers?: Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>;
};

export type VoiceCallStateEvent =
  | { type: 'reset' }
  | { type: 'compatibility'; compatibility: VoiceCallCompatibility }
  | { type: 'ice-config'; iceServers: VoiceCallIceServer[] }
  | { type: 'requesting-permission'; conversationId: string; peerUserId: string | null; direction: VoiceCallDirection }
  | { type: 'outgoing-started'; callId: string; conversationId: string; peerUserId: string | null }
  | { type: 'incoming'; callId: string; conversationId: string; fromUserId: string; fromDeviceId?: string | null }
  | { type: 'accepted'; callId: string; conversationId: string }
  | { type: 'connecting'; callId: string; conversationId: string; direction?: VoiceCallDirection }
  | { type: 'connected'; callId: string; conversationId: string }
  | { type: 'muted'; muted: boolean }
  | { type: 'local-stream'; active: boolean }
  | { type: 'remote-stream'; active: boolean }
  | { type: 'autoplay-blocked'; blocked: boolean }
  | { type: 'elapsed'; seconds: number }
  | { type: 'failed'; error: string }
  | { type: 'ended'; reason: VoiceCallStatus; callId?: string | null; conversationId?: string | null }
  | { type: 'answered-elsewhere'; callId: string; conversationId: string }
  | { type: 'timeout'; callId: string; conversationId: string }
  | { type: 'history-loaded'; items: VoiceCallHistoryEntry[] };

const DEFAULT_COMPATIBILITY: VoiceCallCompatibility = {
  getUserMedia: false,
  rtcpPeerConnection: false,
  audioOutput: false,
  cleanup: false,
};

export function detectWebRtcCompatibility(env: {
  navigator?: Pick<Navigator, 'mediaDevices'>;
  RTCPeerConnection?: typeof RTCPeerConnection;
  HTMLAudioElement?: typeof HTMLAudioElement;
} = globalThis): VoiceCallCompatibility {
  const getUserMedia = Boolean(env.navigator?.mediaDevices?.getUserMedia);
  const rtcpPeerConnection = typeof env.RTCPeerConnection === 'function';
  const audioOutput = typeof env.HTMLAudioElement === 'function';
  return {
    getUserMedia,
    rtcpPeerConnection,
    audioOutput,
    cleanup: getUserMedia || rtcpPeerConnection || audioOutput,
  };
}

export function describeWebRtcCompatibilityFailure(compatibility: VoiceCallCompatibility): string {
  const missing: string[] = [];
  if (!compatibility.getUserMedia) {
    missing.push('麦克风访问 API');
  }
  if (!compatibility.rtcpPeerConnection) {
    missing.push('WebRTC 连接 API');
  }
  if (!compatibility.audioOutput) {
    missing.push('音频播放能力');
  }
  if (missing.length === 0) {
    return '当前桌面环境支持 WebRTC 语音通话';
  }
  return `当前桌面环境缺少${missing.join('、')}，无法发起 WebRTC 语音通话`;
}

export function createInitialVoiceCallState(): VoiceCallState {
  return {
    status: 'idle',
    callId: null,
    conversationId: null,
    direction: null,
    peerUserId: null,
    peerDeviceId: null,
    isMuted: false,
    error: null,
    startedAt: null,
    acceptedAt: null,
    connectedAt: null,
    endedAt: null,
    elapsedSeconds: 0,
    compatibility: DEFAULT_COMPATIBILITY,
    iceServers: [],
    autoplayBlocked: false,
    localStreamActive: false,
    remoteStreamActive: false,
    incomingFromUserId: null,
    incomingFromDeviceId: null,
  };
}

export function reduceVoiceCallState(state: VoiceCallState, event: VoiceCallStateEvent): VoiceCallState {
  switch (event.type) {
    case 'reset':
      return createInitialVoiceCallState();
    case 'compatibility':
      return {
        ...state,
        compatibility: event.compatibility,
      };
    case 'ice-config':
      return {
        ...state,
        iceServers: event.iceServers,
      };
    case 'requesting-permission':
      return {
        ...state,
        status: 'requesting-permission',
        conversationId: event.conversationId,
        direction: event.direction,
        peerUserId: event.peerUserId,
        error: null,
        autoplayBlocked: false,
      };
    case 'outgoing-started':
      return {
        ...state,
        status: 'outgoing',
        callId: event.callId,
        conversationId: event.conversationId,
        direction: 'outgoing',
        peerUserId: event.peerUserId,
        startedAt: state.startedAt ?? new Date().toISOString(),
        error: null,
      };
    case 'incoming':
      return {
        ...state,
        status: 'incoming',
        callId: event.callId,
        conversationId: event.conversationId,
        direction: 'incoming',
        incomingFromUserId: event.fromUserId,
        incomingFromDeviceId: event.fromDeviceId ?? null,
        error: null,
      };
    case 'accepted':
      return {
        ...state,
        status: 'connecting',
        callId: event.callId,
        conversationId: event.conversationId,
        acceptedAt: state.acceptedAt ?? new Date().toISOString(),
        error: null,
        localStreamActive: true,
      };
    case 'connecting':
      return {
        ...state,
        status: state.isMuted ? 'muted' : 'connecting',
        callId: event.callId,
        conversationId: event.conversationId,
        direction: event.direction ?? state.direction,
        error: null,
      };
    case 'connected':
      return {
        ...state,
        status: state.isMuted ? 'muted' : 'connected',
        callId: event.callId,
        conversationId: event.conversationId,
        connectedAt: state.connectedAt ?? new Date().toISOString(),
        error: null,
        localStreamActive: true,
      };
    case 'muted':
      return {
        ...state,
        isMuted: event.muted,
        status: event.muted
          ? (state.status === 'connected' || state.status === 'connecting' ? 'muted' : state.status)
          : state.status === 'muted'
            ? 'connected'
            : state.status,
      };
    case 'local-stream':
      return {
        ...state,
        localStreamActive: event.active,
      };
    case 'remote-stream':
      return {
        ...state,
        remoteStreamActive: event.active,
      };
    case 'autoplay-blocked':
      return {
        ...state,
        autoplayBlocked: event.blocked,
      };
    case 'elapsed':
      return {
        ...state,
        elapsedSeconds: Math.max(0, Math.floor(event.seconds)),
      };
    case 'failed':
      return {
        ...state,
        status: 'failed',
        error: event.error,
        endedAt: state.endedAt ?? new Date().toISOString(),
        localStreamActive: false,
        remoteStreamActive: false,
      };
    case 'ended':
      return {
        ...state,
        status: event.reason,
        callId: event.callId ?? state.callId,
        conversationId: event.conversationId ?? state.conversationId,
        endedAt: state.endedAt ?? new Date().toISOString(),
        localStreamActive: false,
        remoteStreamActive: false,
      };
    case 'answered-elsewhere':
      return {
        ...state,
        status: 'answered-elsewhere',
        callId: event.callId,
        conversationId: event.conversationId,
        endedAt: state.endedAt ?? new Date().toISOString(),
        localStreamActive: false,
        remoteStreamActive: false,
      };
    case 'timeout':
      return {
        ...state,
        status: 'timeout',
        callId: event.callId,
        conversationId: event.conversationId,
        endedAt: state.endedAt ?? new Date().toISOString(),
        localStreamActive: false,
        remoteStreamActive: false,
      };
    case 'history-loaded':
      return state;
    default:
      return state;
  }
}

export function normalizeCallHistoryEntry(
  entry: CallRecordItem,
  currentUserId?: string | null,
): VoiceCallHistoryEntry {
  return {
    ...entry,
    kind: 'call',
    preview: buildCallHistoryPreview(entry, currentUserId),
    timeLabel: formatCallHistoryTime(entry.createdAt ?? entry.endedAt ?? entry.startedAt),
  };
}

export function latestCallForConversation(
  callHistory: VoiceCallHistoryEntry[] | undefined,
  conversationId: string,
): VoiceCallHistoryEntry | null {
  const rows = callHistory?.filter((row) => row.conversationId === conversationId) ?? [];
  if (rows.length === 0) {
    return null;
  }
  return rows.reduce((latest, row) => {
    const latestTime = Date.parse(latest.createdAt ?? latest.endedAt ?? latest.startedAt ?? '');
    const rowTime = Date.parse(row.createdAt ?? row.endedAt ?? row.startedAt ?? '');
    return (Number.isFinite(rowTime) ? rowTime : 0) > (Number.isFinite(latestTime) ? latestTime : 0)
      ? row
      : latest;
  });
}

export function conversationPreviewFromLatestActivity(
  row: ConversationListItem,
  callHistory: VoiceCallHistoryEntry[] | undefined,
  messagePreview: (row: ConversationListItem) => string,
): { preview: string; createdAt: string | null; isCall: boolean } {
  const latestCall = latestCallForConversation(callHistory, row.conversationId);
  const messageTime = row.lastMessage?.createdAt ? Date.parse(row.lastMessage.createdAt) : 0;
  const callTime = latestCall ? Date.parse(latestCall.createdAt ?? latestCall.endedAt ?? latestCall.startedAt ?? '') : 0;
  if (latestCall && (Number.isFinite(callTime) ? callTime : 0) > (Number.isFinite(messageTime) ? messageTime : 0)) {
    return {
      preview: latestCall.preview,
      createdAt: latestCall.createdAt ?? latestCall.endedAt ?? latestCall.startedAt ?? null,
      isCall: true,
    };
  }
  return {
    preview: row.lastMessage ? messagePreview(row) : '暂无消息',
    createdAt: row.lastMessage?.createdAt ?? null,
    isCall: false,
  };
}

export function buildCallHistoryPreview(entry: Pick<CallRecordItem, 'outcome' | 'callerUserId' | 'calleeUserId' | 'durationSeconds'>, currentUserId?: string | null): string {
  const side = currentUserId && currentUserId === entry.callerUserId ? '我发起的' : currentUserId && currentUserId === entry.calleeUserId ? '我接听的' : '通话';
  const outcomeMap: Record<CallOutcome, string> = {
    completed: '通话已完成',
    rejected: '已拒绝',
    missed: '未接听',
    canceled: '已取消',
    failed: '通话失败',
    offline: '对方离线',
    timeout: '超时未接听',
    answered_elsewhere: '已由其他设备接听',
  };
  const duration = typeof entry.durationSeconds === 'number' && entry.durationSeconds > 0
    ? ` · ${formatDuration(entry.durationSeconds)}`
    : '';
  return `${side} · ${outcomeMap[entry.outcome]}${duration}`;
}

export function releaseVoiceCallResources(resources: VoiceCallCleanupResources): void {
  for (const timer of resources.clearTimers ?? []) {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
    clearInterval(timer as ReturnType<typeof setInterval>);
  }

  try {
    resources.localStream?.getTracks().forEach((track) => track.stop());
  } catch {
    // Best-effort cleanup only.
  }

  try {
    resources.peerConnection?.close();
  } catch {
    // Best-effort cleanup only.
  }

  try {
    if (resources.remoteAudio) {
      resources.remoteAudio.pause();
      if ('srcObject' in resources.remoteAudio) {
        (resources.remoteAudio as HTMLAudioElement & { srcObject: MediaStream | null }).srcObject = null;
      }
      resources.remoteAudio.removeAttribute('src');
      resources.remoteAudio.load();
    }
  } catch {
    // Best-effort cleanup only.
  }

  if (resources.remoteObjectUrl) {
    try {
      URL.revokeObjectURL(resources.remoteObjectUrl);
    } catch {
      // Best-effort cleanup only.
    }
  }
}

export function formatCallHistoryTime(value?: string | null): string {
  if (!value) {
    return '--:--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function canStartDirectVoiceCall(conversation: ConversationListItem | null | undefined): boolean {
  return Boolean(conversation && conversation.type === 1 && conversation.peerUser?.userId);
}

export function isTerminalVoiceCallStatus(status: VoiceCallStatus): boolean {
  return ['ended', 'failed', 'timeout', 'answered-elsewhere'].includes(status);
}
