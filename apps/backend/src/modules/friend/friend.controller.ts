import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlockUserDto } from './dto/block-user.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { RemoveFriendDto } from './dto/remove-friend.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { UnblockUserDto } from './dto/unblock-user.dto';
import { FriendService } from './friend.service';

@Controller('friend')
@UseGuards(JwtAuthGuard)
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Post('request')
  request(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendFriendRequestDto,
  ): Promise<{ requested: true; targetUserId: string }> {
    return this.friendService.sendRequest(user.userId, dto);
  }

  @Post('respond')
  respond(
    @CurrentUser() user: RequestUser,
    @Body() dto: RespondFriendRequestDto,
  ): Promise<{ accepted: boolean; requesterUserId: string }> {
    return this.friendService.respondRequest(user.userId, dto);
  }

  @Post('remove')
  remove(
    @CurrentUser() user: RequestUser,
    @Body() dto: RemoveFriendDto,
  ): Promise<{ removed: true; targetUserId: string }> {
    return this.friendService.removeFriend(user.userId, dto);
  }

  @Get('list')
  list(
    @CurrentUser() user: RequestUser,
  ): Promise<Array<{ userId: string; username: string; avatarUrl: string | null; online: boolean; remark: string | null }>> {
    return this.friendService.listFriends(user.userId);
  }

  @Get('pending/incoming')
  pendingIncoming(
    @CurrentUser() user: RequestUser,
  ): Promise<Array<{ requesterUserId: string; username: string; avatarUrl: string | null; remark: string | null }>> {
    return this.friendService.listIncomingPending(user.userId);
  }

  @Get('search')
  search(
    @CurrentUser() user: RequestUser,
    @Query() query: SearchUsersDto,
  ): Promise<Array<{ userId: string; username: string; avatarUrl: string | null; relation: string }>> {
    return this.friendService.searchUsers(user.userId, query);
  }

  @Post('block')
  block(
    @CurrentUser() user: RequestUser,
    @Body() dto: BlockUserDto,
  ): Promise<{ blocked: true; targetUserId: string }> {
    return this.friendService.blockUser(user.userId, dto);
  }

  @Post('unblock')
  unblock(
    @CurrentUser() user: RequestUser,
    @Body() dto: UnblockUserDto,
  ): Promise<{ unblocked: true; targetUserId: string }> {
    return this.friendService.unblockUser(user.userId, dto);
  }

  @Get('blocked')
  blocked(
    @CurrentUser() user: RequestUser,
  ): Promise<Array<{ userId: string; username: string; avatarUrl: string | null }>> {
    return this.friendService.listBlockedUsers(user.userId);
  }
}
