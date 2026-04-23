import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CallConfigService, CallIceConfigResponse } from './call-config.service';
import { CallHistoryService } from './call-history.service';
import { CallRecord } from './entities/call-record.entity';

@Controller('call')
@UseGuards(JwtAuthGuard)
export class CallController {
  constructor(
    private readonly callConfigService: CallConfigService,
    private readonly callHistoryService: CallHistoryService,
  ) {}

  @Get('ice-config')
  getIceConfig(): CallIceConfigResponse {
    this.callConfigService.validateProductionIceConfig();
    return this.callConfigService.getIceConfig();
  }

  @Get('history/:conversationId')
  listHistory(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
  ): Promise<CallRecord[]> {
    return this.callHistoryService.listForConversation(user.userId, conversationId);
  }
}
