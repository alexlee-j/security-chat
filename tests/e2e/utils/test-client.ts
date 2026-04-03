import { io, Socket } from 'socket.io-client';

export class TestClient {
  private socket: Socket;
  private userId: string;
  private token: string;

  constructor(userId: string, token: string, serverUrl: string = 'http://localhost:3000') {
    this.userId = userId;
    this.token = token;
    this.socket = io(`${serverUrl}/ws`, {
      auth: { token },
      transports: ['websocket'],
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async sendMessage(recipientId: string, encryptedMessage: { messageType: number; body: string }): Promise<void> {
    return new Promise((resolve) => {
      this.socket.emit('message.send', { recipientId, encryptedMessage });
      resolve();
    });
  }

  async waitForMessage(timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);

      this.socket.once('message.received', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  async waitForEvent(event: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);

      this.socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}
