import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { In, Repository } from 'typeorm';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { User } from '../user/entities/user.entity';
import { Friendship } from './entities/friendship.entity';
import { BlockUserDto } from './dto/block-user.dto';
import { RemoveFriendDto } from './dto/remove-friend.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { UnblockUserDto } from './dto/unblock-user.dto';

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async sendRequest(
    userId: string,
    dto: SendFriendRequestDto,
  ): Promise<{ requested: true; targetUserId: string }> {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot add yourself as a friend');
    }

    const target = await this.userRepository.findOne({
      where: { id: dto.targetUserId },
      select: ['id'],
    });
    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    const currentRelation = await this.friendshipRepository.findOne({
      where: { userId, friendId: dto.targetUserId },
    });
    const incomingRelation = await this.friendshipRepository.findOne({
      where: { userId: dto.targetUserId, friendId: userId },
    });

    if (incomingRelation?.status === 1) {
      if (!currentRelation) {
        await this.friendshipRepository.save(
          this.friendshipRepository.create({
            userId,
            friendId: dto.targetUserId,
            status: 1,
            remark: dto.remark?.trim() || null,
          }),
        );
      }
      throw new BadRequestException('Already friends');
    }

    if (incomingRelation?.status === 2) {
      throw new BadRequestException('You are blocked by this user');
    }

    if (currentRelation?.status === 2) {
      throw new BadRequestException('Please unblock this user first');
    }

    if (incomingRelation?.status === 0) {
      incomingRelation.status = 1;
      await this.friendshipRepository.save(incomingRelation);

      if (currentRelation) {
        currentRelation.status = 1;
        currentRelation.remark = currentRelation.remark ?? dto.remark?.trim() ?? null;
        await this.friendshipRepository.save(currentRelation);
      } else {
        await this.friendshipRepository.save(
          this.friendshipRepository.create({
            userId,
            friendId: dto.targetUserId,
            status: 1,
            remark: dto.remark?.trim() || null,
          }),
        );
      }

      return { requested: true, targetUserId: dto.targetUserId };
    }

    if (currentRelation?.status === 1) {
      throw new BadRequestException('Already friends');
    }
    if (currentRelation?.status === 0) {
      return { requested: true, targetUserId: dto.targetUserId };
    }

    await this.friendshipRepository.save(
      this.friendshipRepository.create({
        userId,
        friendId: dto.targetUserId,
        status: 0,
        remark: dto.remark?.trim() || null,
      }),
    );

    return { requested: true, targetUserId: dto.targetUserId };
  }

  async respondRequest(
    userId: string,
    dto: RespondFriendRequestDto,
  ): Promise<{ accepted: boolean; requesterUserId: string }> {
    const pending = await this.friendshipRepository.findOne({
      where: { userId: dto.requesterUserId, friendId: userId, status: 0 },
    });

    if (!pending) {
      throw new NotFoundException('Pending friend request not found');
    }

    if (!dto.accept) {
      await this.friendshipRepository.remove(pending);
      return { accepted: false, requesterUserId: dto.requesterUserId };
    }

    pending.status = 1;
    await this.friendshipRepository.save(pending);

    const reverse = await this.friendshipRepository.findOne({
      where: { userId, friendId: dto.requesterUserId },
    });

    if (reverse) {
      reverse.status = 1;
      await this.friendshipRepository.save(reverse);
    } else {
      await this.friendshipRepository.save(
        this.friendshipRepository.create({
          userId,
          friendId: dto.requesterUserId,
          status: 1,
          remark: null,
        }),
      );
    }

    return { accepted: true, requesterUserId: dto.requesterUserId };
  }

  async removeFriend(
    userId: string,
    dto: RemoveFriendDto,
  ): Promise<{ removed: true; targetUserId: string }> {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    const [outgoingRelation, incomingRelation] = await Promise.all([
      this.friendshipRepository.findOne({
        where: { userId, friendId: dto.targetUserId },
      }),
      this.friendshipRepository.findOne({
        where: { userId: dto.targetUserId, friendId: userId },
      }),
    ]);

    const relations = [outgoingRelation, incomingRelation].filter(Boolean) as Friendship[];
    if (!relations.length) {
      throw new NotFoundException('Friend relationship not found');
    }

    if (relations.some((row) => row.status === 2)) {
      throw new BadRequestException('Cannot remove a blocked relationship');
    }

    if (relations.some((row) => row.status === 0)) {
      throw new BadRequestException('Cannot remove a pending friend request');
    }

    const acceptedRelations = relations.filter((row) => row.status === 1);
    if (!acceptedRelations.length) {
      throw new BadRequestException('Friend relationship is not accepted');
    }

    await this.friendshipRepository.remove(acceptedRelations);

    return { removed: true, targetUserId: dto.targetUserId };
  }

  async listFriends(
    userId: string,
  ): Promise<Array<{ userId: string; username: string; avatarUrl: string | null; online: boolean; remark: string | null }>> {
    const relations = await this.friendshipRepository.find({
      where: [
        { userId },
        { friendId: userId },
      ],
      select: ['userId', 'friendId', 'status', 'remark'],
    });

    if (!relations.length) {
      return [];
    }

    const relationStateMap = new Map<
      string,
      {
        outgoingStatus: number | null;
        incomingStatus: number | null;
        outgoingRemark: string | null;
      }
    >();
    for (const row of relations) {
      const otherId = row.userId === userId ? row.friendId : row.userId;
      if (otherId === userId) {
        continue;
      }
      const current = relationStateMap.get(otherId) ?? {
        outgoingStatus: null,
        incomingStatus: null,
        outgoingRemark: null,
      };
      if (row.userId === userId) {
        current.outgoingStatus = row.status;
        current.outgoingRemark = row.remark ?? null;
      } else {
        current.incomingStatus = row.status;
      }
      relationStateMap.set(otherId, current);
    }

    const friendIds = Array.from(relationStateMap.entries())
      .filter(([, state]) => {
        const hasFriendRelation = state.outgoingStatus === 1 || state.incomingStatus === 1;
        const hasBlockedRelation = state.outgoingStatus === 2 || state.incomingStatus === 2;
        return hasFriendRelation && !hasBlockedRelation;
      })
      .map(([otherId]) => otherId);

    if (!friendIds.length) {
      return [];
    }

    const [users, onlineStatuses] = await Promise.all([
      this.userRepository.find({
        where: { id: In(friendIds) },
        select: ['id', 'username', 'avatarUrl'],
      }),
      this.redis.mget(friendIds.map((id) => `online:${id}`)).catch(() => []),
    ]);

    const onlineMap = new Map<string, boolean>();
    for (const [index, friendId] of friendIds.entries()) {
      onlineMap.set(friendId, onlineStatuses[index] === '1');
    }

    return users
      .map((user) => ({
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        remark: relationStateMap.get(user.id)?.outgoingRemark ?? null,
        online: onlineMap.get(user.id) ?? false,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  async listIncomingPending(
    userId: string,
  ): Promise<Array<{ requesterUserId: string; username: string; avatarUrl: string | null; remark: string | null }>> {
    return this.friendshipRepository
      .createQueryBuilder('f')
      .innerJoin(User, 'u', 'u.id = f.user_id')
      .where('f.friend_id = :userId', { userId })
      .andWhere('f.status = 0')
      .select([
        'f.user_id AS requester_user_id',
        'f.remark AS remark',
        'u.username AS username',
        'u.avatar_url AS avatar_url',
      ])
      .orderBy('f.created_at', 'DESC')
      .getRawMany<{ requester_user_id: string; username: string; avatar_url: string | null; remark: string | null }>()
      .then((rows) =>
        rows.map((row) => ({
          requesterUserId: row.requester_user_id,
          username: row.username,
          avatarUrl: row.avatar_url,
          remark: row.remark,
        })),
      );
  }

  async blockUser(
    userId: string,
    dto: BlockUserDto,
  ): Promise<{ blocked: true; targetUserId: string }> {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const target = await this.userRepository.findOne({
      where: { id: dto.targetUserId },
      select: ['id'],
    });
    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    const row = await this.friendshipRepository.findOne({
      where: { userId, friendId: dto.targetUserId },
    });

    if (row) {
      row.status = 2;
      await this.friendshipRepository.save(row);
    } else {
      await this.friendshipRepository.save(
        this.friendshipRepository.create({
          userId,
          friendId: dto.targetUserId,
          status: 2,
          remark: null,
        }),
      );
    }

    return { blocked: true, targetUserId: dto.targetUserId };
  }

  async unblockUser(
    userId: string,
    dto: UnblockUserDto,
  ): Promise<{ unblocked: true; targetUserId: string }> {
    const row = await this.friendshipRepository.findOne({
      where: { userId, friendId: dto.targetUserId, status: 2 },
    });

    if (!row) {
      throw new NotFoundException('Blocked user not found');
    }

    await this.friendshipRepository.remove(row);
    return { unblocked: true, targetUserId: dto.targetUserId };
  }

  async listBlockedUsers(
    userId: string,
  ): Promise<Array<{ userId: string; username: string; avatarUrl: string | null }>> {
    const rows = await this.friendshipRepository
      .createQueryBuilder('f')
      .innerJoin(User, 'u', 'u.id = f.friend_id')
      .where('f.user_id = :userId', { userId })
      .andWhere('f.status = 2')
      .select(['f.friend_id AS friend_id', 'u.username AS username', 'u.avatar_url AS avatar_url'])
      .orderBy('u.username', 'ASC')
      .getRawMany<{ friend_id: string; username: string; avatar_url: string | null }>();

    return rows.map((row) => ({
      userId: row.friend_id,
      username: row.username,
      avatarUrl: row.avatar_url,
    }));
  }

  async searchUsers(
    userId: string,
    query: SearchUsersDto,
  ): Promise<Array<{ userId: string; username: string; avatarUrl: string | null; relation: string }>> {
    const rawKeyword = query.keyword.trim();
    if (!rawKeyword) {
      return [];
    }

    const keyword = `%${rawKeyword}%`;
    const limit = query.limit ?? 20;

    const users = await this.userRepository
      .createQueryBuilder('u')
      .where('u.id != :userId', { userId })
      .andWhere('(u.username ILIKE :keyword OR u.email ILIKE :keyword OR u.phone ILIKE :keyword)', { keyword })
      .select(['u.id AS id', 'u.username AS username', 'u.avatar_url AS avatar_url'])
      .orderBy('u.username', 'ASC')
      .limit(limit)
      .getRawMany<{ id: string; username: string; avatar_url: string | null }>();

    if (!users.length) {
      return [];
    }

    const targetIds = users.map((u) => u.id);
    const relations = await this.friendshipRepository
      .createQueryBuilder('f')
      .where('f.user_id = :userId AND f.friend_id IN (:...targetIds)', { userId, targetIds })
      .orWhere('f.friend_id = :userId AND f.user_id IN (:...targetIds)', { userId, targetIds })
      .select(['f.user_id AS user_id', 'f.friend_id AS friend_id', 'f.status AS status'])
      .getRawMany<{ user_id: string; friend_id: string; status: number }>();

    const relationMap = new Map<string, string>();
    const relationPriority: Record<string, number> = {
      none: 0,
      pending_outgoing: 1,
      pending_incoming: 2,
      friends: 3,
      blocked: 4,
    };
    for (const row of relations) {
      const otherId = row.user_id === userId ? row.friend_id : row.user_id;
      const current = relationMap.get(otherId) ?? 'none';
      const next =
        row.status === 2
          ? 'blocked'
          : row.status === 1
            ? 'friends'
            : row.user_id === userId
              ? 'pending_outgoing'
              : 'pending_incoming';

      if (relationPriority[next] >= relationPriority[current]) {
        relationMap.set(otherId, next);
      }
    }

    return users.map((u) => ({
      userId: u.id,
      username: u.username,
      avatarUrl: u.avatar_url,
      relation: relationMap.get(u.id) ?? 'none',
    }));
  }

  /**
   * 检查两个用户是否是好友关系
   */
  async areFriends(userId: string, otherUserId: string): Promise<boolean> {
    const relations = await this.friendshipRepository.find({
      where: [
        { userId, friendId: otherUserId },
        { userId: otherUserId, friendId: userId },
      ],
      select: ['userId', 'friendId', 'status'],
    });

    if (!relations.length) {
      return false;
    }

    let outgoingStatus: number | null = null;
    let incomingStatus: number | null = null;

    for (const row of relations) {
      if (row.userId === userId) {
        outgoingStatus = row.status;
      } else {
        incomingStatus = row.status;
      }
    }

    const hasFriendRelation = outgoingStatus === 1 || incomingStatus === 1;
    const hasBlockedRelation = outgoingStatus === 2 || incomingStatus === 2;

    return hasFriendRelation && !hasBlockedRelation;
  }
}
