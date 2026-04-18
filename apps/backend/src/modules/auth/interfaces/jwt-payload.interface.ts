export interface JwtPayload {
  sub: string;
  jti: string;
  type: 'access' | 'refresh';
  // Optional only for rollout compatibility with legacy tokens minted
  // before device-bound JWT payloads were introduced.
  deviceId?: string;
  iat: number;
  exp: number;
}
