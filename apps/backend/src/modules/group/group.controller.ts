import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupService } from './group.service';
import {
  CreateGroupDto,
  AddGroupMembersDto,
  RemoveGroupMemberDto,
  DistributeSenderKeyDto,
} from './dto/create-group.dto';

@Controller('group')
@UseGuards(JwtAuthGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  /**
   * 创建群组
   * POST /group/create
   */
  @Post('create')
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateGroupDto,
  ): Promise<{ groupId: string }> {
    const group = await this.groupService.create(user.userId, dto);
    return { groupId: group.id };
  }

  /**
   * 获取群组信息
   * GET /group/:id
   */
  @Get(':id')
  async getGroupInfo(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) groupId: string,
  ): Promise<{
    id: string;
    name: string;
    avatarUrl: string | null;
    type: number;
    creatorId: string;
    memberCount: number;
    isMember: boolean;
    role: number | null;
    createdAt: Date;
  }> {
    return this.groupService.getGroupInfo(groupId, user.userId);
  }

  /**
   * 获取成员列表
   * GET /group/:id/members
   */
  @Get(':id/members')
  async listMembers(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) groupId: string,
  ): Promise<
    Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      role: number;
      joinedAt: Date;
    }>
  > {
    return this.groupService.listMembers(groupId, user.userId);
  }

  /**
   * 添加群组成员
   * POST /group/:id/members
   */
  @Post(':id/members')
  async addMembers(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) groupId: string,
    @Body() dto: AddGroupMembersDto,
  ): Promise<{ addedCount: number }> {
    return this.groupService.addMembers(groupId, user.userId, dto);
  }

  /**
   * 移除群组成员
   * DELETE /group/:id/members/:userId
   */
  @Delete(':id/members/:userId')
  async removeMember(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) groupId: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<void> {
    await this.groupService.removeMember(groupId, user.userId, targetUserId);
  }

  /**
   * 离开群组
   * POST /group/:id/leave
   */
  @Post(':id/leave')
  async leaveGroup(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) groupId: string,
  ): Promise<void> {
    await this.groupService.leaveGroup(groupId, user.userId);
  }

  /**
   * 分发 Sender Key
   * POST /group/:id/sender-keys
   */
  @Post(':id/sender-keys')
  async distributeSenderKey(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) groupId: string,
    @Body() dto: DistributeSenderKeyDto,
  ): Promise<void> {
    await this.groupService.distributeSenderKey(groupId, user.userId, dto.senderKey);
  }

  /**
   * 获取用户所在的群组列表
   * GET /group/list
   */
  @Get('list')
  async getUserGroups(
    @CurrentUser() user: RequestUser,
  ): Promise<
    Array<{
      groupId: string;
      name: string;
      avatarUrl: string | null;
      type: number;
      role: number;
      joinedAt: Date;
    }>
  > {
    return this.groupService.getUserGroups(user.userId);
  }
}
