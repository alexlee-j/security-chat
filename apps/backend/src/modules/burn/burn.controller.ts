import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BurnService } from './burn.service';
import { TriggerBurnDto } from './dto/trigger-burn.dto';

@Controller('burn')
@UseGuards(JwtAuthGuard)
export class BurnController {
  constructor(private readonly burnService: BurnService) {}

  @Post('trigger')
  trigger(
    @CurrentUser() user: RequestUser,
    @Body() dto: TriggerBurnDto,
  ): Promise<{ burned: boolean; messageId: string; triggeredAt: string }> {
    return this.burnService.triggerBurn(user.userId, dto.messageId);
  }
}
