import { Controller, Get } from '@nestjs/common';
import { SecurityService } from './security.service';

@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('status')
  status(): { module: string; status: string } {
    return this.securityService.getStatus();
  }
}
