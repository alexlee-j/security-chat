import { Body, Controller, Get, Query, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { AckDeliveredDto } from './dto/ack-delivered.dto';
import { AckReadDto } from './dto/ack-read.dto';
import { Message } from './entities/message.entity';

@Controller('message')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('send')
  send(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendMessageDto,
  ): Promise<{ messageId: string; messageIndex: string }> {
    return this.messageService.sendMessage(user.userId, dto);
  }

  @Get('list')
  list(@CurrentUser() user: RequestUser, @Query() query: QueryMessagesDto): Promise<Message[]> {
    return this.messageService.queryMessages(user.userId, query);
  }

  @Post('ack/delivered')
  ackDelivered(
    @CurrentUser() user: RequestUser,
    @Body() dto: AckDeliveredDto,
  ): Promise<{ deliveredCount: number }> {
    return this.messageService.ackDelivered(user.userId, dto);
  }

  @Post('ack/read')
  ackRead(
    @CurrentUser() user: RequestUser,
    @Body() dto: AckReadDto,
  ): Promise<{ readCount: number }> {
    return this.messageService.ackRead(user.userId, dto);
  }
}
