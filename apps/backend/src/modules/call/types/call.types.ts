export type CallOutcome =
  | 'completed'
  | 'rejected'
  | 'missed'
  | 'canceled'
  | 'failed'
  | 'offline'
  | 'timeout';

export type ActiveCallStatus = 'ringing' | 'connecting' | 'connected';

export type CallParticipant = {
  userId: string;
  deviceId?: string;
};

export type ActiveCallSession = {
  callId: string;
  conversationId: string;
  callerUserId: string;
  callerDeviceId: string;
  calleeUserId: string;
  calleeDeviceIds: string[];
  acceptedDeviceId?: string;
  status: ActiveCallStatus;
  createdAt: string;
  acceptedAt?: string;
  connectedAt?: string;
};

export type CallInviteResult = {
  ok: boolean;
  reason?: 'callee_offline';
  session?: ActiveCallSession;
  calleeDeviceIds?: string[];
};

export type CallAcceptResult = {
  ok: boolean;
  reason?: 'answered_elsewhere' | 'not_found' | 'forbidden';
  session?: ActiveCallSession;
};

export type RelayTarget = {
  targetUserId: string;
  targetDeviceId: string;
  session: ActiveCallSession;
};

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: string;
};
