import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ConversationService } from './conversation.service';

@Controller('conversation')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('direct')
  createDirect(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDirectConversationDto,
  ): Promise<{ conversationId: string }> {
    return this.conversationService.createDirectConversation(user.userId, dto.peerUserId);
  }

  @Get('list')
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListConversationsDto,
  ): Promise<
    Array<{
      conversationId: string;
      type: number;
      unreadCount: number;
      peerUser: { userId: string; username: string; avatarUrl: string | null } | null;
      lastMessage: {
        messageId: string;
        messageIndex: string;
        senderId: string;
        messageType: number;
        isBurn: boolean;
        deliveredAt: string | null;
        readAt: string | null;
        createdAt: string;
      } | null;
    }>
  > {
    return this.conversationService.listConversations(user.userId, query);
  }
}
