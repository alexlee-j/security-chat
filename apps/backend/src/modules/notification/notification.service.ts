import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  getStatus(): { module: string; status: string } {
    return {
      module: 'notification',
      status: 'ready',
    };
  }
}
