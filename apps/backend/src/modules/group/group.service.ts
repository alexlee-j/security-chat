import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { SenderKey } from './entities/sender-key.entity';
import { User } from '../user/entities/user.entity';
import { FriendService } from '../friend/friend.service';
import { NotificationService } from '../notification/notification.service';
import { CreateGroupDto, AddGroupMembersDto, UpdateGroupProfileDto } from './dto/create-group.dto';

/**
 * 群组成员角色
 */
export enum GroupRole {
  Admin = 1,
  Member = 2,
}

/**
 * 群组类型
 */
export enum GroupType {
  Private = 1, // 私密群：仅好友可加入
  Public = 2, // 公开群：任何人可加入
}

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly memberRepository: Repository<GroupMember>,
    @InjectRepository(SenderKey)
    private readonly senderKeyRepository: Repository<SenderKey>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly friendService: FriendService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 创建群组
   */
  async create(userId: string, dto: CreateGroupDto): Promise<Group> {
    // 创建群组
    const group = this.groupRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type || GroupType.Private,
      creatorId: userId,
    });
    await this.groupRepository.save(group);

    // 创建者自动成为管理员
    const member = this.memberRepository.create({
      groupId: group.id,
      userId: userId,
      role: GroupRole.Admin,
    });
    await this.memberRepository.save(member);

    // 如果有初始成员，添加他们
    if (dto.memberUserIds && dto.memberUserIds.length > 0) {
      await this.addMembersInternal(group.id, userId, dto.memberUserIds);
    }

    return group;
  }

  /**
   * 获取群组信息
   */
  async findById(groupId: string): Promise<Group | null> {
    return this.groupRepository.findOne({ where: { id: groupId } });
  }

  /**
   * 获取群组详情
   */
  async getGroupInfo(groupId: string, userId: string): Promise<{
    id: string;
    name: string;
    avatarUrl: string | null;
    description: string | null;
    type: number;
    creatorId: string;
    memberCount: number;
    isMember: boolean;
    role: number | null;
    createdAt: Date;
  }> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // 检查用户是否是成员
    const membership = await this.memberRepository.findOne({
      where: { groupId, userId },
    });

    // 私密群只能成员查看
    if (group.type === GroupType.Private && !membership) {
      throw new ForbiddenException('Only group members can view this group');
    }

    // 获取成员数量
    const memberCount = await this.memberRepository.count({ where: { groupId } });

    return {
      id: group.id,
      name: group.name,
      avatarUrl: group.avatarUrl,
      description: group.description,
      type: group.type,
      creatorId: group.creatorId,
      memberCount,
      isMember: !!membership,
      role: membership?.role || null,
      createdAt: group.createdAt,
    };
  }

  /**
   * 更新群资料（管理员可操作）
   */
  async updateGroupProfile(
    groupId: string,
    requesterId: string,
    dto: UpdateGroupProfileDto,
  ): Promise<{
    id: string;
    name: string;
    avatarUrl: string | null;
    description: string | null;
    updatedAt: Date;
  }> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.assertAdmin(groupId, requesterId);

    if (dto.name !== undefined) {
      group.name = dto.name.trim();
    }
    if (dto.avatarUrl !== undefined) {
      group.avatarUrl = dto.avatarUrl || null;
    }
    if (dto.description !== undefined) {
      group.description = dto.description || null;
    }

    const saved = await this.groupRepository.save(group);
    return {
      id: saved.id,
      name: saved.name,
      avatarUrl: saved.avatarUrl,
      description: saved.description,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * 获取群组成员列表
   */
  async listMembers(groupId: string, userId: string): Promise<
    Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      role: number;
      joinedAt: Date;
    }>
  > {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // 检查用户是否是成员
    const membership = await this.memberRepository.findOne({
      where: { groupId, userId },
    });

    if (group.type === GroupType.Private && !membership) {
      throw new ForbiddenException('Only group members can view this group');
    }

    const members = await this.memberRepository.find({
      where: { groupId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });

    return members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * 添加群组成员（仅管理员）
   */
  async addMembers(
    groupId: string,
    requesterId: string,
    dto: AddGroupMembersDto,
  ): Promise<{ addedCount: number }> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // 检查权限
    await this.assertAdmin(groupId, requesterId);

    // 私密群只能添加好友
    if (group.type === GroupType.Private) {
      for (const userId of dto.userIds) {
        const isFriend = await this.friendService.areFriends(requesterId, userId);
        if (!isFriend) {
          throw new ForbiddenException('Can only add friends to private groups');
        }
      }
    }

    return this.addMembersInternal(groupId, requesterId, dto.userIds);
  }

  /**
   * 内部方法：添加成员
   */
  private async addMembersInternal(
    groupId: string,
    _requesterId: string,
    userIds: string[],
  ): Promise<{ addedCount: number }> {
    const existingMembers = await this.memberRepository.find({
      where: userIds.map((userId) => ({ groupId, userId } as any),
      ),
    });

    const existingUserIds = new Set(existingMembers.map((m) => m.userId));
    const newUserIds = userIds.filter((id) => !existingUserIds.has(id));

    if (newUserIds.length === 0) {
      return { addedCount: 0 };
    }

    const members = newUserIds.map((userId) =>
      this.memberRepository.create({
        groupId,
        userId,
        role: GroupRole.Member,
      }),
    );

    await this.memberRepository.save(members);
    await this.rotateGroupSenderKeys(groupId);
    await this.emitGroupLifecycleNotifications(newUserIds, groupId, '成员加入群聊', '您已被加入群聊。', {
      action: 'member_added',
      groupId,
    });
    return { addedCount: members.length };
  }

  /**
   * 移除群组成员（仅管理员）
   */
  async removeMember(
    groupId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // 检查权限：管理员可以移除，成员可以移除自己
    const membership = await this.memberRepository.findOne({
      where: { groupId, userId: requesterId },
    });

    if (!membership || (membership.role !== GroupRole.Admin && requesterId !== targetUserId)) {
      throw new ForbiddenException('No permission to remove this member');
    }

    // 不能移除群主
    if (group.creatorId === targetUserId) {
      throw new BadRequestException('Cannot remove the group creator');
    }

    const result = await this.memberRepository.delete({ groupId, userId: targetUserId });
    if (result.affected === 0) {
      throw new NotFoundException('Member not found');
    }

    await this.rotateGroupSenderKeys(groupId);
    const remainingMemberIds = await this.getGroupMemberUserIds(groupId);
    await this.emitGroupLifecycleNotifications(
      [targetUserId, ...remainingMemberIds],
      groupId,
      '群成员发生变更',
      requesterId === targetUserId ? '您已退出群聊。' : '群成员已被移除，请留意成员变更。',
      { action: requesterId === targetUserId ? 'member_left' : 'member_removed', groupId, targetUserId },
    );
  }

  /**
   * 离开群组
   */
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // 不能离开自己创建的群
    if (group.creatorId === userId) {
      throw new BadRequestException('Group creator cannot leave the group');
    }

    const result = await this.memberRepository.delete({ groupId, userId });
    if (result.affected === 0) {
      throw new NotFoundException('You are not a member of this group');
    }

    await this.rotateGroupSenderKeys(groupId);
    const remainingMemberIds = await this.getGroupMemberUserIds(groupId);
    await this.emitGroupLifecycleNotifications(
      [userId, ...remainingMemberIds],
      groupId,
      '群成员发生变更',
      '有成员退出了群聊。',
      { action: 'member_left', groupId, targetUserId: userId },
    );
  }

  /**
   * 分发 Sender Key
   */
  async distributeSenderKey(
    groupId: string,
    userId: string,
    senderKey: string,
  ): Promise<void> {
    // 验证用户是群组成员
    const membership = await this.memberRepository.findOne({
      where: { groupId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('Only group members can distribute sender keys');
    }

    // 保存或更新 sender key
    const existing = await this.senderKeyRepository.findOne({
      where: { groupId, userId },
    });

    if (existing) {
      existing.senderKey = senderKey;
      await this.senderKeyRepository.save(existing);
    } else {
      const key = this.senderKeyRepository.create({
        groupId,
        userId,
        senderKey,
      });
      await this.senderKeyRepository.save(key);
    }
  }

  /**
   * 获取用户的 Sender Key
   */
  async getSenderKey(groupId: string, targetUserId: string): Promise<string | null> {
    const key = await this.senderKeyRepository.findOne({
      where: { groupId, userId: targetUserId },
    });

    return key?.senderKey || null;
  }

  private async rotateGroupSenderKeys(groupId: string): Promise<void> {
    await this.senderKeyRepository.delete({ groupId });
  }

  /**
   * 验证用户是否是群组成员
   */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findOne({
      where: { groupId, userId },
    });
    return !!member;
  }

  /**
   * 断言用户是管理员
   */
  private async assertAdmin(groupId: string, userId: string): Promise<void> {
    const membership = await this.memberRepository.findOne({
      where: { groupId, userId },
    });

    if (!membership || membership.role !== GroupRole.Admin) {
      throw new ForbiddenException('Only group admins can perform this action');
    }
  }

  /**
   * 获取用户所在的群组列表
   */
  async getUserGroups(userId: string): Promise<
    Array<{
      groupId: string;
      name: string;
      avatarUrl: string | null;
      type: number;
      role: number;
      joinedAt: Date;
    }>
  > {
    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['group'],
      order: { joinedAt: 'DESC' },
    });

    return memberships.map((m) => ({
      groupId: m.group.id,
      name: m.group.name,
      avatarUrl: m.group.avatarUrl,
      type: m.group.type,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  private async getGroupMemberUserIds(groupId: string): Promise<string[]> {
    const members = await this.memberRepository.find({
      where: { groupId },
      select: ['userId'],
    });
    return members.map((m) => m.userId);
  }

  private async emitGroupLifecycleNotifications(
    userIds: string[],
    groupId: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const uniqUserIds = [...new Set(userIds)];
    const dtos: Array<{
      userId: string;
      type: 'group_lifecycle';
      title: string;
      body: string;
      data: Record<string, unknown>;
    }> = [];
    for (const uid of uniqUserIds) {
      const enabled = await this.notificationService.isNotificationEnabled(uid, 'group_lifecycle');
      if (!enabled) {
        continue;
      }
      dtos.push({
        userId: uid,
        type: 'group_lifecycle',
        title,
        body,
        data: { ...data, groupId },
      });
    }
    if (dtos.length > 0) {
      await this.notificationService.createBatchNotifications(dtos);
    }
  }
}
