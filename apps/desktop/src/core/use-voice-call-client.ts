import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getCallHistory, getCallIceConfig } from './api';
import type { ConversationListItem } from './types';
import {
  canStartDirectVoiceCall,
  createInitialVoiceCallState,
  detectWebRtcCompatibility,
  describeWebRtcCompatibilityFailure,
  normalizeCallHistoryEntry,
  reduceVoiceCallState,
  releaseVoiceCallResources,
  type VoiceCallHistoryEntry,
  type VoiceCallIceServer,
  type VoiceCallState,
} from './voice-call-engine';

type CallSessionPayload = {
  callId: string;
  conversationId: string;
  callerUserId: string;
  callerDeviceId: string;
  calleeUserId: string;
  calleeDeviceIds?: string[];
  acceptedDeviceId?: string | null;
  status?: string;
  createdAt?: string;
  acceptedAt?: string;
  connectedAt?: string;
};

type CallInviteAckPayload = {
  callId: string;
  conversationId: string;
  calleeDeviceIds?: string[];
};

type CallRelayPayload = {
  callId: string;
  conversationId: string;
  fromUserId?: string;
  fromDeviceId?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  code?: string;
  message?: string;
};

type UseVoiceCallClientInput = {
  socket: Socket | null;
  currentUserId: string | null;
  activeConversationId: string;
  conversations: ConversationListItem[];
};

type UseVoiceCallClientResult = {
  state: VoiceCallState;
  history: VoiceCallHistoryEntry[];
  historyLoading: boolean;
  historyError: string | null;
  actions: {
    startVoiceCall: (conversationId: string) => Promise<void>;
    acceptIncomingCall: () => Promise<void>;
    rejectIncomingCall: () => Promise<void>;
    cancelVoiceCall: () => Promise<void>;
    hangupVoiceCall: () => Promise<void>;
    toggleMute: () => void;
    clearError: () => void;
    refreshHistory: (conversationId?: string) => Promise<void>;
    canStartCall: (conversationId: string) => boolean;
  };
};

function isTerminalStatus(status: VoiceCallState['status']): boolean {
  return ['ended', 'failed', 'timeout', 'answered-elsewhere'].includes(status);
}

function getConversationPeer(conversations: ConversationListItem[], conversationId: string): ConversationListItem | null {
  return conversations.find((row) => row.conversationId === conversationId) ?? null;
}

function createAudioElement(): HTMLAudioElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.preload = 'auto';
  audio.style.display = 'none';
  audio.setAttribute('aria-hidden', 'true');
  document.body.appendChild(audio);
  return audio;
}

function parseIceServers(rows: unknown): VoiceCallIceServer[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const servers: VoiceCallIceServer[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const record = row as Record<string, unknown>;
    const urls = record.urls;
    if (typeof urls !== 'string' && !Array.isArray(urls)) {
      continue;
    }
    servers.push({
      urls: urls as string | string[],
      username: typeof record.username === 'string' ? record.username : undefined,
      credential: typeof record.credential === 'string' ? record.credential : undefined,
      credentialType: typeof record.credentialType === 'string' ? record.credentialType : undefined,
    });
  }
  return servers;
}

function makeRtcSessionDescription(type: RTCSessionDescriptionInit['type'], sdp?: string): RTCSessionDescriptionInit {
  return { type, sdp };
}

function normalizeRelayCandidate(candidate: RTCIceCandidateInit | undefined): RTCIceCandidateInit | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  return candidate;
}

function normalizeCallFailureMessage(payload: Pick<CallRelayPayload, 'message' | 'reason' | 'code'>): string {
  if (payload.message) {
    return payload.message;
  }
  switch (payload.reason ?? payload.code) {
    case 'callee_offline':
      return '对方当前离线，无法接听语音通话';
    case 'answered_elsewhere':
      return '已由其他设备接听';
    case 'forbidden':
      return '无权访问该通话';
    case 'not_found':
      return '通话已结束或不存在';
    case 'INVALID_REQUEST':
      return '通话请求无效';
    default:
      return '通话失败';
  }
}

export function useVoiceCallClient(input: UseVoiceCallClientInput): UseVoiceCallClientResult {
  const [state, dispatch] = useReducer(reduceVoiceCallState, undefined, createInitialVoiceCallState);
  const [history, setHistory] = useState<VoiceCallHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const socketRef = useRef<Socket | null>(null);
  const currentConversationIdRef = useRef(input.activeConversationId);
  const currentCallIdRef = useRef<string | null>(null);
  const currentConversationRef = useRef<string | null>(null);
  const permissionRequestTokenRef = useRef(0);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteObjectUrlRef = useRef<string | null>(null);
  const connectedNotifiedRef = useRef(false);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inviteAckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupTimersRef = useRef<Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>>([]);

  stateRef.current = state;
  socketRef.current = input.socket;
  currentConversationIdRef.current = input.activeConversationId;

  const cleanupCallRuntime = (): void => {
    releaseVoiceCallResources({
      localStream: localStreamRef.current,
      peerConnection: peerConnectionRef.current,
      remoteAudio: remoteAudioRef.current,
      remoteObjectUrl: remoteObjectUrlRef.current,
      clearTimers: [...cleanupTimersRef.current],
    });
    cleanupTimersRef.current = [];
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    localStreamRef.current = null;
    peerConnectionRef.current = null;
    connectedNotifiedRef.current = false;
    dispatch({ type: 'local-stream', active: false });
    dispatch({ type: 'remote-stream', active: false });
    dispatch({ type: 'autoplay-blocked', blocked: false });
    if (remoteAudioRef.current?.parentElement) {
      remoteAudioRef.current.parentElement.removeChild(remoteAudioRef.current);
    }
    remoteAudioRef.current = null;
    remoteObjectUrlRef.current = null;
  };

  const clearInviteAckTimer = (): void => {
    if (inviteAckTimerRef.current) {
      clearTimeout(inviteAckTimerRef.current);
      inviteAckTimerRef.current = null;
    }
  };

  const startInviteAckWatchdog = (conversationId: string): void => {
    clearInviteAckTimer();
    inviteAckTimerRef.current = setTimeout(() => {
      inviteAckTimerRef.current = null;
      const currentState = stateRef.current;
      if (currentState.status !== 'requesting-permission' || currentState.conversationId !== conversationId) {
        return;
      }
      dispatch({ type: 'failed', error: '通话请求未收到服务端确认，请稍后重试' });
      cleanupCallRuntime();
    }, 12_000);
    cleanupTimersRef.current.push(inviteAckTimerRef.current);
  };

  const abortPendingLocalCall = (): void => {
    permissionRequestTokenRef.current += 1;
    clearInviteAckTimer();
    cleanupCallRuntime();
    currentCallIdRef.current = null;
    currentConversationRef.current = null;
    dispatch({ type: 'reset' });
  };

  const compatibility = useMemo(
    () =>
      detectWebRtcCompatibility({
        navigator: typeof window !== 'undefined' ? window.navigator : undefined,
        RTCPeerConnection: typeof window !== 'undefined' ? window.RTCPeerConnection : undefined,
        HTMLAudioElement: typeof window !== 'undefined' ? window.HTMLAudioElement : undefined,
      }),
    [],
  );

  useEffect(() => {
    dispatch({ type: 'compatibility', compatibility });
  }, [compatibility]);

  useEffect(() => {
    if (!input.socket || !input.currentUserId) {
      return;
    }
    let canceled = false;
    void getCallIceConfig()
      .then((config) => {
        if (canceled) {
          return;
        }
        dispatch({ type: 'ice-config', iceServers: parseIceServers(config.iceServers) });
      })
      .catch((error) => {
        if (canceled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'ICE 配置加载失败';
        dispatch({ type: 'failed', error: message });
        setHistoryError(message);
      });
    return () => {
      canceled = true;
    };
  }, [input.currentUserId, input.socket]);

  useEffect(() => {
    if (!input.currentUserId || !input.activeConversationId) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    let canceled = false;
    setHistoryLoading(true);
    void getCallHistory(input.activeConversationId)
      .then((rows) => {
        if (canceled) {
          return;
        }
        setHistory(rows.map((row) => normalizeCallHistoryEntry(row, input.currentUserId)));
        setHistoryError(null);
      })
      .catch((error) => {
        if (canceled) {
          return;
        }
        const message = error instanceof Error ? error.message : '通话历史加载失败';
        setHistoryError(message);
        setHistory([]);
      })
      .finally(() => {
        if (!canceled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [input.activeConversationId, input.currentUserId]);

  useEffect(() => {
    const socket = input.socket;
    if (!socket) {
      return;
    }

    const ensureAudio = (): HTMLAudioElement | null => {
      if (remoteAudioRef.current) {
        return remoteAudioRef.current;
      }
      remoteAudioRef.current = createAudioElement();
      return remoteAudioRef.current;
    };

    const attachRemoteStream = async (stream: MediaStream): Promise<void> => {
      const audio = ensureAudio();
      if (!audio) {
        dispatch({ type: 'autoplay-blocked', blocked: true });
        return;
      }
      if ('srcObject' in audio) {
        (audio as HTMLAudioElement & { srcObject: MediaStream | null }).srcObject = stream;
      }
      remoteObjectUrlRef.current = null;
      dispatch({ type: 'remote-stream', active: true });
      try {
        await audio.play();
        dispatch({ type: 'autoplay-blocked', blocked: false });
      } catch {
        dispatch({ type: 'autoplay-blocked', blocked: true });
      }
    };

    const ensurePeerConnection = (): RTCPeerConnection => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }
      const pc = new RTCPeerConnection({
        iceServers: stateRef.current.iceServers,
      });
      pc.onicecandidate = (event) => {
        const callId = currentCallIdRef.current;
        const conversationId = currentConversationRef.current;
        if (!callId || !conversationId || !event.candidate) {
          return;
        }
        socketRef.current?.emit('call.ice-candidate', {
          callId,
          conversationId,
          candidate: event.candidate.toJSON(),
        });
      };
      pc.ontrack = (event) => {
        void attachRemoteStream(event.streams[0] ?? new MediaStream([event.track]));
      };
      pc.onconnectionstatechange = () => {
        const callId = currentCallIdRef.current;
        const conversationId = currentConversationRef.current;
        if (!callId || !conversationId) {
          return;
        }
        if (pc.connectionState === 'connected') {
          if (!connectedNotifiedRef.current) {
            connectedNotifiedRef.current = true;
            socketRef.current?.emit('call.connected', { callId, conversationId });
          }
          dispatch({ type: 'connected', callId, conversationId });
          dispatch({ type: 'remote-stream', active: true });
        }
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          dispatch({ type: 'failed', error: 'WebRTC 连接失败' });
          cleanupCallRuntime();
        }
      };
      peerConnectionRef.current = pc;
      return pc;
    };

    const startElapsedTimer = (): void => {
      if (elapsedTimerRef.current) {
        return;
      }
      elapsedTimerRef.current = setInterval(() => {
        if (stateRef.current.startedAt) {
          const startedAtMs = Date.parse(stateRef.current.connectedAt ?? stateRef.current.startedAt ?? '');
          if (Number.isFinite(startedAtMs)) {
            dispatch({ type: 'elapsed', seconds: (Date.now() - startedAtMs) / 1000 });
          }
        }
      }, 1000);
      cleanupTimersRef.current.push(elapsedTimerRef.current);
    };

    const getLocalStream = async (): Promise<MediaStream> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前环境不支持麦克风访问');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      dispatch({ type: 'local-stream', active: true });
      return stream;
    };

    const attachTracks = (pc: RTCPeerConnection, stream: MediaStream): void => {
      for (const track of stream.getAudioTracks()) {
        pc.addTrack(track, stream);
      }
    };

    const startOutgoingOffer = async (session: CallSessionPayload): Promise<void> => {
      currentCallIdRef.current = session.callId;
      currentConversationRef.current = session.conversationId;
      dispatch({ type: 'outgoing-started', callId: session.callId, conversationId: session.conversationId, peerUserId: session.calleeUserId });
      startElapsedTimer();
      const stream = localStreamRef.current ?? await getLocalStream();
      const pc = ensurePeerConnection();
      attachTracks(pc, stream);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('call.offer', {
        callId: session.callId,
        conversationId: session.conversationId,
        sdp: offer.sdp,
      });
      dispatch({ type: 'connecting', callId: session.callId, conversationId: session.conversationId, direction: 'outgoing' });
    };

    const handleInvite = (session: CallSessionPayload): void => {
      if (session.calleeUserId !== input.currentUserId) {
        return;
      }
      currentCallIdRef.current = session.callId;
      currentConversationRef.current = session.conversationId;
      dispatch({
        type: 'incoming',
        callId: session.callId,
        conversationId: session.conversationId,
        fromUserId: session.callerUserId,
        fromDeviceId: session.callerDeviceId,
      });
      void loadHistoryForConversation(session.conversationId);
    };

    const handleInviteAck = (session: CallInviteAckPayload): void => {
      if (
        stateRef.current.direction !== 'outgoing' ||
        currentConversationRef.current !== session.conversationId
      ) {
        return;
      }
      clearInviteAckTimer();
      currentCallIdRef.current = session.callId;
      currentConversationRef.current = session.conversationId;
      dispatch({
        type: 'outgoing-started',
        callId: session.callId,
        conversationId: session.conversationId,
        peerUserId: stateRef.current.peerUserId,
      });
    };

    const handleAccepted = (session: CallSessionPayload): void => {
      if (session.callerUserId !== input.currentUserId) {
        return;
      }
      currentCallIdRef.current = session.callId;
      currentConversationRef.current = session.conversationId;
      void startOutgoingOffer(session);
    };

    const handleOffer = async (payload: CallRelayPayload): Promise<void> => {
      if (payload.callId !== currentCallIdRef.current) {
        return;
      }
      const pc = ensurePeerConnection();
      await pc.setRemoteDescription(makeRtcSessionDescription('offer', payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('call.answer', {
        callId: payload.callId,
        conversationId: payload.conversationId,
        sdp: answer.sdp,
      });
      dispatch({ type: 'connecting', callId: payload.callId, conversationId: payload.conversationId, direction: 'incoming' });
    };

    const handleAnswer = async (payload: CallRelayPayload): Promise<void> => {
      if (payload.callId !== currentCallIdRef.current) {
        return;
      }
      const pc = ensurePeerConnection();
      await pc.setRemoteDescription(makeRtcSessionDescription('answer', payload.sdp));
      dispatch({ type: 'connected', callId: payload.callId, conversationId: payload.conversationId });
      startElapsedTimer();
    };

    const handleIceCandidate = async (payload: CallRelayPayload): Promise<void> => {
      if (payload.callId !== currentCallIdRef.current) {
        return;
      }
      const candidate = normalizeRelayCandidate(payload.candidate);
      if (!candidate) {
        return;
      }
      const pc = ensurePeerConnection();
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore transient candidate failures.
      }
    };

    const handleEnded = (payload: CallRelayPayload): void => {
      if (payload.callId !== currentCallIdRef.current) {
        return;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      dispatch({ type: 'ended', reason: 'ended', callId: payload.callId, conversationId: payload.conversationId });
      cleanupCallRuntime();
      void loadHistoryForConversation(payload.conversationId);
    };

    const handleTimeout = (payload: CallRelayPayload): void => {
      if (payload.callId !== currentCallIdRef.current) {
        return;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      dispatch({ type: 'timeout', callId: payload.callId, conversationId: payload.conversationId });
      cleanupCallRuntime();
      void loadHistoryForConversation(payload.conversationId);
    };

    const handleError = (payload: CallRelayPayload): void => {
      clearInviteAckTimer();
      dispatch({ type: 'failed', error: normalizeCallFailureMessage(payload) });
      cleanupCallRuntime();
    };

    const handleConnected = (session: CallSessionPayload): void => {
      if (session.callId !== currentCallIdRef.current) {
        return;
      }
      dispatch({ type: 'connected', callId: session.callId, conversationId: session.conversationId });
      startElapsedTimer();
    };

    const loadHistoryForConversation = async (conversationId: string): Promise<void> => {
      if (!conversationId) {
        return;
      }
      try {
        const rows = await getCallHistory(conversationId);
        if (conversationId !== currentConversationIdRef.current) {
          return;
        }
        setHistory(rows.map((row) => normalizeCallHistoryEntry(row, input.currentUserId)));
        setHistoryError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : '通话历史加载失败';
        setHistoryError(message);
      }
    };

    const handleAnsweredElsewhere = (payload: CallRelayPayload): void => {
      if (payload.callId !== currentCallIdRef.current) {
        return;
      }
      dispatch({ type: 'answered-elsewhere', callId: payload.callId, conversationId: payload.conversationId });
      cleanupCallRuntime();
      void loadHistoryForConversation(payload.conversationId);
    };

    const handleSocketDisconnect = (): void => {
      if (isTerminalStatus(stateRef.current.status) || stateRef.current.status === 'idle') {
        return;
      }
      dispatch({ type: 'failed', error: '网络连接已断开' });
      cleanupCallRuntime();
    };

    socket.on('call.invited', handleInvite);
    socket.on('call.invite.ack', handleInviteAck);
    socket.on('call.accepted', handleAccepted);
    socket.on('call.offer', handleOffer);
    socket.on('call.answer', handleAnswer);
    socket.on('call.ice-candidate', handleIceCandidate);
    socket.on('call.ended', handleEnded);
    socket.on('call.timeout', handleTimeout);
    socket.on('call.failed', handleError);
    socket.on('call.error', handleError);
    socket.on('call.answered_elsewhere', handleAnsweredElsewhere);
    socket.on('call.connected', handleConnected);
    socket.on('disconnect', handleSocketDisconnect);

    return () => {
      socket.off('call.invited', handleInvite);
      socket.off('call.invite.ack', handleInviteAck);
      socket.off('call.accepted', handleAccepted);
      socket.off('call.offer', handleOffer);
      socket.off('call.answer', handleAnswer);
      socket.off('call.ice-candidate', handleIceCandidate);
      socket.off('call.ended', handleEnded);
      socket.off('call.timeout', handleTimeout);
      socket.off('call.failed', handleError);
      socket.off('call.error', handleError);
      socket.off('call.answered_elsewhere', handleAnsweredElsewhere);
      socket.off('call.connected', handleConnected);
      socket.off('disconnect', handleSocketDisconnect);
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      cleanupCallRuntime();
    };
  }, [input.socket, input.currentUserId]);

  useEffect(() => {
    if (!state.startedAt) {
      dispatch({ type: 'elapsed', seconds: 0 });
      return;
    }
    const startedAtMs = Date.parse(state.connectedAt ?? state.startedAt);
    if (!Number.isFinite(startedAtMs)) {
      return;
    }
    dispatch({ type: 'elapsed', seconds: (Date.now() - startedAtMs) / 1000 });
  }, [state.connectedAt, state.startedAt]);

  useEffect(() => {
    if (
      state.status === 'requesting-permission' &&
      state.conversationId &&
      input.activeConversationId &&
      state.conversationId !== input.activeConversationId
    ) {
      abortPendingLocalCall();
    }
  }, [input.activeConversationId, state.conversationId, state.status]);

  async function startVoiceCall(conversationId: string): Promise<void> {
    const conversation = getConversationPeer(input.conversations, conversationId);
    if (!canStartDirectVoiceCall(conversation)) {
      dispatch({ type: 'failed', error: '仅支持私聊语音通话' });
      return;
    }
    if (!input.socket) {
      dispatch({ type: 'failed', error: '通话服务未连接' });
      return;
    }
    if (!input.currentUserId || conversation?.peerUser?.userId == null) {
      dispatch({ type: 'failed', error: '无法识别通话对象' });
      return;
    }
    if (!state.compatibility.getUserMedia || !state.compatibility.rtcpPeerConnection || !state.compatibility.audioOutput) {
      dispatch({ type: 'failed', error: describeWebRtcCompatibilityFailure(state.compatibility) });
      return;
    }
    if (!state.iceServers.length) {
      dispatch({ type: 'failed', error: '通话配置缺失，请检查网络设置后重试' });
      return;
    }

    dispatch({
      type: 'requesting-permission',
      conversationId,
      peerUserId: conversation.peerUser.userId,
      direction: 'outgoing',
    });
    const permissionRequestToken = permissionRequestTokenRef.current + 1;
    permissionRequestTokenRef.current = permissionRequestToken;
    currentConversationRef.current = conversationId;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前环境不支持麦克风访问');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (
        permissionRequestToken !== permissionRequestTokenRef.current ||
        stateRef.current.status !== 'requesting-permission' ||
        currentConversationRef.current !== conversationId
      ) {
        releaseVoiceCallResources({ localStream: stream });
        return;
      }
      localStreamRef.current = stream;
      dispatch({ type: 'local-stream', active: true });
      input.socket.emit('call.invite', { conversationId });
      startInviteAckWatchdog(conversationId);
    } catch (error) {
      if (permissionRequestToken !== permissionRequestTokenRef.current) {
        return;
      }
      const message = error instanceof Error ? error.message : '麦克风权限被拒绝';
      dispatch({ type: 'failed', error: message });
      cleanupCallRuntime();
    }
  }

  async function acceptIncomingCall(): Promise<void> {
    if (state.status !== 'incoming' || !state.callId || !state.conversationId) {
      return;
    }
    if (!input.socket) {
      dispatch({ type: 'failed', error: '通话服务未连接' });
      return;
    }
    dispatch({
      type: 'requesting-permission',
      conversationId: state.conversationId,
      peerUserId: state.incomingFromUserId,
      direction: 'incoming',
    });
    const permissionRequestToken = permissionRequestTokenRef.current + 1;
    permissionRequestTokenRef.current = permissionRequestToken;
    currentConversationRef.current = state.conversationId;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前环境不支持麦克风访问');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (
        permissionRequestToken !== permissionRequestTokenRef.current ||
        stateRef.current.status !== 'requesting-permission' ||
        currentConversationRef.current !== state.conversationId
      ) {
        releaseVoiceCallResources({ localStream: stream });
        return;
      }
      localStreamRef.current = stream;
      dispatch({ type: 'local-stream', active: true });
      dispatch({ type: 'accepted', callId: state.callId, conversationId: state.conversationId });
      input.socket.emit('call.accept', { callId: state.callId });
    } catch (error) {
      if (permissionRequestToken !== permissionRequestTokenRef.current) {
        return;
      }
      const message = error instanceof Error ? error.message : '麦克风权限被拒绝';
      dispatch({ type: 'failed', error: message });
      if (state.callId) {
        input.socket.emit('call.reject', { callId: state.callId });
      }
      cleanupCallRuntime();
    }
  }

  async function rejectIncomingCall(): Promise<void> {
    if (!state.callId) {
      return;
    }
    input.socket?.emit('call.reject', { callId: state.callId });
    dispatch({ type: 'ended', reason: 'ended', callId: state.callId, conversationId: state.conversationId });
    cleanupCallRuntime();
  }

  async function cancelVoiceCall(): Promise<void> {
    const callId = state.callId ?? currentCallIdRef.current;
    if (callId) {
      input.socket?.emit('call.cancel', { callId });
    }
    if (!callId) {
      abortPendingLocalCall();
      return;
    }
    permissionRequestTokenRef.current += 1;
    clearInviteAckTimer();
    cleanupCallRuntime();
    currentCallIdRef.current = null;
    currentConversationRef.current = null;
    dispatch({ type: 'ended', reason: 'ended', callId, conversationId: state.conversationId });
  }

  async function hangupVoiceCall(): Promise<void> {
    if (!state.callId) {
      return;
    }
    input.socket?.emit('call.hangup', { callId: state.callId });
    dispatch({ type: 'ended', reason: 'ended', callId: state.callId, conversationId: state.conversationId });
    cleanupCallRuntime();
  }

  function toggleMute(): void {
    if (!localStreamRef.current) {
      return;
    }
    const nextMuted = !state.isMuted;
    for (const track of localStreamRef.current.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    dispatch({ type: 'muted', muted: nextMuted });
  }

  function clearError(): void {
    if (isTerminalStatus(state.status) || state.status === 'failed') {
      dispatch({ type: 'reset' });
      return;
    }
    dispatch({ type: 'autoplay-blocked', blocked: false });
  }

  async function refreshHistory(conversationId = input.activeConversationId): Promise<void> {
    if (!conversationId) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const rows = await getCallHistory(conversationId);
      setHistory(rows.map((row) => normalizeCallHistoryEntry(row, input.currentUserId)));
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '通话历史加载失败');
    } finally {
      setHistoryLoading(false);
    }
  }

  function canStartCall(conversationId: string): boolean {
    return canStartDirectVoiceCall(getConversationPeer(input.conversations, conversationId));
  }

  return {
    state,
    history,
    historyLoading,
    historyError,
    actions: {
      startVoiceCall,
      acceptIncomingCall,
      rejectIncomingCall,
      cancelVoiceCall,
      hangupVoiceCall,
      toggleMute,
      clearError,
      refreshHistory,
      canStartCall,
    },
  };
}
