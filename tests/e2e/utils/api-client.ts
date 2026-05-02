import axios, { AxiosInstance } from 'axios';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export interface RegisterResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  deviceId: string;
}

export class ApiClient {
  public client: AxiosInstance;
  private accessToken: string = '';
  private userId: string = '';

  constructor(private serverUrl: string = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL: `${serverUrl}/api/v1`,
      timeout: 10000,
    });
  }

  async register(
    username: string,
    email: string,
    password: string,
    deviceName: string = 'TestDevice'
  ): Promise<RegisterResult> {
    const response = await this.client.post('/auth/register', {
      username,
      email,
      phone: '',
      password,
      deviceName,
      deviceType: 'mac',
      identityPublicKey: 'test-public-key-' + Date.now(),
      signedPreKey: JSON.stringify({
        keyId: 1,
        publicKey: 'test-signed-prekey-' + Date.now(),
        signature: 'test-signature',
      }),
      signedPreKeySignature: 'test-signed-prekey-signature',
    });
    return response.data.data;
  }

  async login(account: string, password: string): Promise<LoginResult> {
    const response = await this.client.post('/auth/login', { account, password });
    const data = response.data.data;
    this.accessToken = data.accessToken;
    this.userId = data.userId;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    return data;
  }

  async sendLoginCode(account: string): Promise<void> {
    await this.client.post('/auth/login-code/send', { account });
  }

  async loginWithCode(account: string, code: string): Promise<LoginResult> {
    const response = await this.client.post('/auth/login-code', { account, code });
    const data = response.data.data;
    this.accessToken = data.accessToken;
    this.userId = data.userId;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    return data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
    this.accessToken = '';
    this.userId = '';
    delete this.client.defaults.headers.common['Authorization'];
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await this.client.post('/auth/refresh', { refreshToken });
    return response.data.data;
  }

  getAccessToken(): string {
    return this.accessToken;
  }

  getUserId(): string {
    return this.userId;
  }

  getAuthHeader(): string {
    return `Bearer ${this.accessToken}`;
  }
}
