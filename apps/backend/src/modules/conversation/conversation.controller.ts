import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import { AddGroupMembersDto, RemoveGroupMemberDto } from './dto/manage-group-members.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { UpdateBurnDefaultDto } from './dto/update-burn-default.dto';
import { ConversationService } from './conversation.service';

@Controller('conversation')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('list')
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListConversationsDto,
  ): Promise<
    Array<{
      conversationId: string;
      type: number;
      name: string | null;
      defaultBurnEnabled: boolean;
      defaultBurnDuration: number | null;
      unreadCount: number;
      peerUser: { userId: string; username: string; avatarUrl: string | null } | null;
      groupInfo: { name: string; memberCount: number } | null;
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

  @Get(':conversationId')
  getConversation(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
  ): Promise<{
    conversationId: string;
    type: number;
    name: string | null;
    defaultBurnEnabled: boolean;
    defaultBurnDuration: number | null;
    peerUser: { userId: string; username: string; avatarUrl: string | null } | null;
    groupInfo: { name: string; memberCount: number } | null;
  }> {
    return this.conversationService.getConversation(user.userId, conversationId);
  }

  @Post('direct')
  createDirect(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDirectConversationDto,
  ): Promise<{ conversationId: string }> {
    return this.conversationService.createDirectConversation(user.userId, dto.peerUserId);
  }

  @Post('group')
  createGroup(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateGroupConversationDto,
  ): Promise<{ conversationId: string }> {
    return this.conversationService.createGroupConversation(user.userId, dto.name, dto.memberUserIds);
  }

  @Post(':conversationId/members/add')
  addGroupMembers(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: AddGroupMembersDto,
  ): Promise<{ addedCount: number }> {
    return this.conversationService.addGroupMembers(user.userId, conversationId, dto.userIds);
  }

  @Post(':conversationId/members/remove')
  removeGroupMember(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: RemoveGroupMemberDto,
  ): Promise<void> {
    return this.conversationService.removeGroupMember(user.userId, conversationId, dto.userId);
  }

  @Get(':conversationId/members')
  listGroupMembers(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
  ): Promise<
    Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      role: number;
      joinedAt: string;
    }>
  > {
    return this.conversationService.listGroupMembers(user.userId, conversationId);
  }

  @Get(':conversationId/burn-default')
  getBurnDefault(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
  ): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
    return this.conversationService.getBurnDefault(user.userId, conversationId);
  }

  @Post(':conversationId/burn-default')
  updateBurnDefault(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: UpdateBurnDefaultDto,
  ): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
    return this.conversationService.updateBurnDefault(user.userId, conversationId, dto);
  }
}
