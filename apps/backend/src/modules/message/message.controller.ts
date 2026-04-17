import { Body, Controller, Delete, Get, Query, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendMessageV2Dto } from './dto/send-message-v2.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { AckDeliveredDto } from './dto/ack-delivered.dto';
import { AckReadDto } from './dto/ack-read.dto';
import { AckReadOneDto } from './dto/ack-read-one.dto';
import { AckRevokeDto } from './dto/ack-revoke.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { SaveDraftDto, GetDraftDto, DeleteDraftDto } from './dto/draft-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { Message } from './entities/message.entity';
import { DraftMessage } from './entities/draft-message.entity';

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

  @Post('send-v2')
  sendV2(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendMessageV2Dto,
  ): Promise<{ messageId: string; messageIndex: string }> {
    return this.messageService.sendMessageV2(user, dto);
  }

  @Get('list')
  list(@CurrentUser() user: RequestUser, @Query() query: QueryMessagesDto): Promise<Message[]> {
    return this.messageService.queryMessages(user.userId, query, user.deviceId);
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

  @Post('ack/read-one')
  ackReadOne(
    @CurrentUser() user: RequestUser,
    @Body() dto: AckReadOneDto,
  ): Promise<{ readCount: number }> {
    return this.messageService.ackReadOne(user.userId, dto);
  }

  @Post('ack/revoke')
  revoke(
    @CurrentUser() user: RequestUser,
    @Body() dto: AckRevokeDto,
  ): Promise<{ revokedCount: number }> {
    return this.messageService.revokeMessage(user.userId, dto);
  }

  @Post('forward')
  forward(
    @CurrentUser() user: RequestUser,
    @Body() dto: ForwardMessageDto,
  ): Promise<{ messageId: string; messageIndex: string }> {
    return this.messageService.forwardMessage(user.userId, dto);
  }

  @Post('draft/save')
  saveDraft(
    @CurrentUser() user: RequestUser,
    @Body() dto: SaveDraftDto,
  ): Promise<{ draftId: string }> {
    return this.messageService.saveDraft(user.userId, dto);
  }

  @Get('draft/get')
  getDraft(
    @CurrentUser() user: RequestUser,
    @Query() dto: GetDraftDto,
  ): Promise<DraftMessage | null> {
    return this.messageService.getDraft(user.userId, dto);
  }

  @Delete('draft/delete')
  deleteDraft(
    @CurrentUser() user: RequestUser,
    @Query() dto: DeleteDraftDto,
  ): Promise<{ deleted: boolean }> {
    return this.messageService.deleteDraft(user.userId, dto);
  }

  @Get('draft/list')
  listDrafts(
    @CurrentUser() user: RequestUser,
  ): Promise<DraftMessage[]> {
    return this.messageService.listDrafts(user.userId);
  }

  @Get('search')
  search(
    @CurrentUser() user: RequestUser,
    @Query() dto: SearchMessagesDto,
  ): Promise<Array<{
    messageId: string;
    conversationId: string;
    senderId: string;
    messageType: number;
    messageIndex: string;
    isBurn: boolean;
    burnDuration: number | null;
    isRevoked: boolean;
    deliveredAt: string | null;
    readAt: string | null;
    createdAt: string;
  }>> {
    return this.messageService.searchMessages(user.userId, dto);
  }
}
