import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'node:https';
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
  private readonly logger = new Logger(CallConfigService.name);
  private cachedIceServers: IceServerConfig[] | null = null;
  private cacheExpiry: number = 0;
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {}

  async getIceConfig(): Promise<CallIceConfigResponse> {
    const iceServers = await this.getIceServers();
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
    const iceServers = this.getIceServersSync();
    const hasTurn = iceServers.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'));
    });
    if (!hasTurn) {
      throw new BadRequestException('TURN server configuration is required for production voice calls');
    }
  }

  private getIceServersSync(): IceServerConfig[] {
    if (this.cachedIceServers && Date.now() < this.cacheExpiry) {
      return this.cachedIceServers;
    }

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

  private async getIceServers(): Promise<IceServerConfig[]> {
    const turnApiUrl = this.configService.get<string>('CALL_TURN_API_URL', '').trim();
    const turnApiKey = this.configService.get<string>('CALL_TURN_API_KEY', '').trim();

    if (turnApiUrl && turnApiKey) {
      if (this.cachedIceServers && Date.now() < this.cacheExpiry) {
        return this.cachedIceServers;
      }

      try {
        const iceServers = await this.fetchWithInsecureHttps<IceServerConfig[]>(
          `${turnApiUrl}?apiKey=${turnApiKey}`,
        );
        if (iceServers && Array.isArray(iceServers) && iceServers.length > 0) {
          this.cachedIceServers = iceServers.map(normalizeIceServer).filter(Boolean) as IceServerConfig[];
          this.cacheExpiry = Date.now() + CallConfigService.CACHE_TTL_MS;
          this.logger.log('Fetched TURN credentials from Metered API');
          return this.cachedIceServers;
        }
        this.logger.warn('Empty or invalid TURN credentials response');
      } catch (error) {
        this.logger.error('Error fetching TURN credentials:', error);
      }
    }

    return this.getIceServersSync();
  }

  private fetchWithInsecureHttps<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const agent = new https.Agent({ rejectUnauthorized: false });
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Security-Chat/1.0',
        },
        agent,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
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
