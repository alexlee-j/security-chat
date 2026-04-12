import { MigrationPackage } from './migration-package';

/**
 * 迁移进度
 */
export interface MigrationProgress {
  stage: 'idle' | 'preparing' | 'transferring' | 'verifying' | 'importing' | 'complete' | 'failed';
  totalBytes: number;
  transferredBytes: number;
  currentItem: string;
  errors: string[];
}

/**
 * 迁移传输通道
 * 支持两种模式：
 * 1. 扫码授权：旧设备生成二维码，新设备扫码建立连接
 * 2. 文件导出：导出加密文件，通过其他方式传输到新设备
 */
export class MigrationTransport {
  private wsConnection: WebSocket | null = null;
  private progress: MigrationProgress;

  constructor() {
    this.progress = {
      stage: 'idle',
      totalBytes: 0,
      transferredBytes: 0,
      currentItem: '',
      errors: [],
    };
  }

  /**
   * 生成迁移授权二维码（旧设备端）
   */
  async generateMigrationQR(
    authCode: string,
    sourceDeviceId: string,
    challenge: string
  ): Promise<string> {
    // 二维码内容包含授权信息和挑战
    const qrData = `sc:migrate:${authCode}:${sourceDeviceId}:${challenge}`;
    return this.generateQRCodeImage(qrData);
  }

  /**
   * 解析二维码内容
   */
  parseQRCode(qrData: string): { authCode: string; sourceDeviceId: string; challenge: string } | null {
    const parts = qrData.split(':');
    if (parts.length !== 4 || parts[0] !== 'sc' || parts[1] !== 'migrate') {
      return null;
    }
    return {
      authCode: parts[2],
      sourceDeviceId: parts[3],
      challenge: '', // 兼容旧格式
    };
  }

  /**
   * 建立 WebSocket 传输通道
   */
  async establishConnection(
    authCode: string,
    sourceDeviceId: string,
    targetDeviceId: string
  ): Promise<void> {
    try {
      this.updateProgress({ stage: 'preparing', currentItem: '建立连接...' });

      // 1. 客户端认证
      const response = await fetch('/api/v1/migration/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authCode, sourceDeviceId, targetDeviceId }),
      });

      if (!response.ok) {
        throw new Error('Connection establishment failed');
      }

      const { wsToken } = await response.json();

      // 2. 建立 WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.wsConnection = new WebSocket(
        `${protocol}//${window.location.host}/ws/migration`
      );

      return new Promise((resolve, reject) => {
        if (!this.wsConnection) {
          reject(new Error('WebSocket not initialized'));
          return;
        }

        this.wsConnection.onopen = () => {
          this.updateProgress({ stage: 'transferring', currentItem: '连接已建立' });
          // 认证
          this.wsConnection?.send(JSON.stringify({ token: wsToken }));
          resolve();
        };

        this.wsConnection.onerror = (error) => {
          this.updateProgress({ stage: 'failed', errors: ['WebSocket error'] });
          reject(error);
        };

        this.wsConnection.onmessage = (event) => {
          this.handleIncomingData(event.data);
        };
      });
    } catch (error) {
      this.updateProgress({ stage: 'failed', errors: [String(error)] });
      throw error;
    }
  }

  /**
   * 通过文件导出迁移数据
   */
  async exportToFile(pkg: MigrationPackage): Promise<{ blob: Blob; filename: string }> {
    const json = JSON.stringify(pkg, null, 2);
    const bytes = new TextEncoder().encode(json);
    const blob = new Blob([bytes], { type: 'application/json' });
    const filename = `security-chat-migration-${Date.now()}.json`;
    return { blob, filename };
  }

  /**
   * 下载文件
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 传输数据包
   */
  async sendPackage(pkg: MigrationPackage): Promise<void> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.updateProgress({
      stage: 'transferring',
      currentItem: '传输数据包...',
      totalBytes: JSON.stringify(pkg).length,
    });

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        type: 'migration_package',
        data: pkg,
      });

      this.wsConnection!.send(data);

      this.wsConnection!.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.type === 'transfer_complete') {
          this.updateProgress({ stage: 'complete', transferredBytes: this.progress.totalBytes });
          resolve();
        } else if (response.type === 'error') {
          this.updateProgress({ stage: 'failed', errors: [response.message] });
          reject(new Error(response.message));
        }
      };
    });
  }

  /**
   * 接收数据包
   */
  private handleIncomingData(data: string): void {
    try {
      const message = JSON.parse(data);
      if (message.type === 'migration_package') {
        this.updateProgress({
          stage: 'verifying',
          currentItem: '验证数据包...',
          transferredBytes: JSON.stringify(message.data).length,
        });
        this.onPackageReceived?.(message.data as MigrationPackage);
      } else if (message.type === 'progress') {
        this.updateProgress({
          transferredBytes: message.transferredBytes,
          currentItem: message.currentItem,
        });
      }
    } catch (e) {
      console.error('[Migration] Failed to handle incoming data:', e);
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.updateProgress({ stage: 'idle' });
  }

  /**
   * 获取当前进度
   */
  getProgress(): MigrationProgress {
    return { ...this.progress };
  }

  /**
   * 更新进度
   */
  private updateProgress(updates: Partial<MigrationProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.onProgressUpdate?.(this.progress);
  }

  private async generateQRCodeImage(data: string): Promise<string> {
    // 使用 qrcode.js 生成二维码
    // 返回 Data URL
    try {
      // 动态导入 qrcode 库
      const QRCode = await import('qrcode');
      return QRCode.toDataURL(data, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (e) {
      console.warn('[Migration] QRCode library not available, returning raw data');
      return data;
    }
  }

  // 事件回调
  onPackageReceived?: (pkg: MigrationPackage) => void;
  onProgressUpdate?: (progress: MigrationProgress) => void;
}

/**
 * 迁移进度追踪器
 */
export class MigrationProgressTracker {
  private progress: MigrationProgress;

  constructor() {
    this.progress = {
      stage: 'idle',
      totalBytes: 0,
      transferredBytes: 0,
      currentItem: '',
      errors: [],
    };
  }

  update(updates: Partial<MigrationProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.onProgressUpdate?.(this.progress);
  }

  getProgress(): MigrationProgress {
    return { ...this.progress };
  }

  onProgressUpdate?: (progress: MigrationProgress) => void;
}
