import { ConfigService } from '@nestjs/config';
import { CallConfigService } from '../../src/modules/call/call-config.service';

describe('CallConfigService', () => {
  it('returns public ICE server fields without exposing unrelated secrets', () => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          CALL_ICE_SERVERS: JSON.stringify([
            { urls: ['stun:stun.example.test:3478'] },
            { urls: ['turn:turn.example.test:3478'], username: 'turn-user', credential: 'turn-pass' },
          ]),
          JWT_SECRET: 'must-not-leak',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    const service = new CallConfigService(config);
    const result = service.getIceConfig();

    expect(result).toEqual({
      iceServers: [
        { urls: ['stun:stun.example.test:3478'] },
        { urls: ['turn:turn.example.test:3478'], username: 'turn-user', credential: 'turn-pass' },
      ],
      security: {
        mediaEncryption: 'webrtc-dtls-srtp',
        signalIdentityVerification: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('fails production validation when no TURN server is configured', () => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          NODE_ENV: 'production',
          CALL_ICE_SERVERS: JSON.stringify([{ urls: ['stun:stun.example.test:3478'] }]),
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    const service = new CallConfigService(config);

    expect(() => service.validateProductionIceConfig()).toThrow('TURN');
  });
});
