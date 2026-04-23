import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IceServerConfig } from './types/call.types';

export type CallIceConfigResponse = {
  iceServers: IceServerConfig[];
  security: {
    mediaEncryption: 'webrtc-dtls-srtp';
    signalIdentityVerification: false;
  };
};

@Injectable()
export class CallConfigService {
  constructor(private readonly configService: ConfigService) {}

  getIceConfig(): CallIceConfigResponse {
    const iceServers = this.getIceServers();
    return {
      iceServers,
      security: {
        mediaEncryption: 'webrtc-dtls-srtp',
        signalIdentityVerification: false,
      },
    };
  }

  validateProductionIceConfig(): void {
    if (this.configService.get<string>('NODE_ENV', 'development') !== 'production') {
      return;
    }
    const hasTurn = this.getIceServers().some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'));
    });
    if (!hasTurn) {
      throw new BadRequestException('TURN server configuration is required for production voice calls');
    }
  }

  private getIceServers(): IceServerConfig[] {
    const raw = this.configService.get<string>('CALL_ICE_SERVERS', '').trim();
    if (raw) {
      const parsed = JSON.parse(raw) as IceServerConfig[];
      return parsed.map(normalizeIceServer).filter(Boolean) as IceServerConfig[];
    }

    const stunUrls = this.configService
      .get<string>('CALL_STUN_URLS', 'stun:stun.l.google.com:19302')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    const turnUrl = this.configService.get<string>('CALL_TURN_URL', '').trim();
    const turnUsername = this.configService.get<string>('CALL_TURN_USERNAME', '').trim();
    const turnCredential = this.configService.get<string>('CALL_TURN_CREDENTIAL', '').trim();
    const iceServers: IceServerConfig[] = stunUrls.length > 0 ? [{ urls: stunUrls }] : [];

    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername || undefined,
        credential: turnCredential || undefined,
      });
    }

    return iceServers;
  }
}

function normalizeIceServer(server: IceServerConfig): IceServerConfig | null {
  if (!server || !server.urls) {
    return null;
  }
  return {
    urls: server.urls,
    username: server.username,
    credential: server.credential,
    credentialType: server.credentialType,
  };
}
