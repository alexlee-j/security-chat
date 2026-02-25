import { Injectable } from '@nestjs/common';

@Injectable()
export class SecurityService {
  getStatus(): { module: string; status: string } {
    return {
      module: 'security',
      status: 'ready',
    };
  }
}
