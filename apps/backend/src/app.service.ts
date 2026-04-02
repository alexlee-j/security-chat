import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health(): { status: string; service: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      service: 'security-chat-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
