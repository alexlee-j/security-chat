import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Conversation } from './entities/conversation.entity';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { UpdateBurnDefaultDto } from './dto/update-burn-default.dto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';

@Injectable()
export class ConversationService {
  private static readonly ALLOWED_BURN_DURATIONS = new Set([5, 10, 30, 60, 300]);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly memberRepository: Repository<ConversationMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createDirectConversation(userId: string, peerUserId: string): Promise<{ conversationId: string }> {
    if (userId === peerUserId) {
      throw new BadRequestException('Cannot create direct conversation with yourself');
    }

    const peerUser = await this.userRepository.findOne({
      where: { id: peerUserId },
      select: ['id'],
    });
    if (!peerUser) {
      throw new NotFoundException('Peer user not found');
    }

    const [a, b] = [userId, peerUserId].sort();

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1));', [`direct:${a}:${b}`]);

      const rows = await manager.query(
        `
        SELECT c.id::text AS conversation_id
        FROM conversations c
        INNER JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
        INNER JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
        WHERE c.type = 1
        LIMIT 1;
        `,
        [userId, peerUserId],
      );
      if (rows.length > 0) {
        return { conversationId: rows[0].conversation_id as string };
      }

      const conversation = await manager.save(
        Conversation,
        manager.create(Conversation, {
          type: 1,
        }),
      );

      await manager.save(ConversationMember, [
        manager.create(ConversationMember, { conversationId: conversation.id, userId, role: 0 }),
        manager.create(ConversationMember, { conversationId: conversation.id, userId: peerUserId, role: 0 }),
      ]);

      return { conversationId: conversation.id };
    });
  }

  async createGroupConversation(userId: string, name: string, memberUserIds: string[]): Promise<{ conversationId: string }> {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Group name is required');
    }

    const validMembers = [...new Set(memberUserIds?.filter(id => id && id !== userId) ?? [])];

    const users = await this.userRepository.find({
      where: { id: In(validMembers) },
      select: ['id'],
    });

    if (users.length !== validMembers.length) {
      throw new BadRequestException('Some member user IDs are invalid');
    }

    const conversation = await this.conversationRepository.save(
      this.conversationRepository.create({
        type: 2,
        name: name.trim(),
      }),
    );

    const membersToAdd = [
      this.memberRepository.create({ conversationId: conversation.id, userId, role: 1 }), // Creator is admin
      ...validMembers.map(memberId => 
        this.memberRepository.create({ conversationId: conversation.id, userId: memberId, role: 0 })
      ),
    ];

    await this.memberRepository.save(membersToAdd);

    return { conversationId: conversation.id };
  }

  async addGroupMembers(userId: string, conversationId: string, userIds: string[]): Promise<{ addedCount: number }> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.type !== 2) {
      throw new BadRequestException('Only group conversations can add members');
    }

    const currentMember = await this.memberRepository.findOne({
      where: { conversationId, userId },
    });

    if (!currentMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    if (currentMember.role !== 1) {
      throw new ForbiddenException('Only admins can add members');
    }

    const validUsers = [...new Set(userIds.filter(id => id && id !== userId))];
    if (validUsers.length === 0) {
      return { addedCount: 0 };
    }

    const existingMembers = await this.memberRepository.find({
      where: { conversationId, userId: In(validUsers) },
      select: ['userId'],
    });

    const existingUserIds = new Set(existingMembers.map(m => m.userId));
    const newUserIds = validUsers.filter(id => !existingUserIds.has(id));

    if (newUserIds.length === 0) {
      return { addedCount: 0 };
    }

    const users = await this.userRepository.find({
      where: { id: In(newUserIds) },
      select: ['id'],
    });

    if (users.length !== newUserIds.length) {
      throw new BadRequestException('Some user IDs are invalid');
    }

    const membersToAdd = newUserIds.map(memberId => 
      this.memberRepository.create({ conversationId, userId: memberId, role: 0 })
    );

    await this.memberRepository.save(membersToAdd);

    // 清除缓存
    await this.clearConversationMembersCache(conversationId);

    return { addedCount: membersToAdd.length };
  }

  async removeGroupMember(userId: string, conversationId: string, targetUserId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.type !== 2) {
      throw new BadRequestException('Only group conversations can remove members');
    }

    const currentMember = await this.memberRepository.findOne({
      where: { conversationId, userId },
    });

    if (!currentMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const targetMember = await this.memberRepository.findOne({
      where: { conversationId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException('Target user is not a member of this conversation');
    }

    if (currentMember.role !== 1 && currentMember.userId !== targetUserId) {
      throw new ForbiddenException('Only admins can remove other members');
    }

    await this.memberRepository.remove(targetMember);

    // 清除缓存
    await this.clearConversationMembersCache(conversationId);
  }

  private async clearConversationMembersCache(conversationId: string): Promise<void> {
    const cacheKey = `conversation:${conversationId}:members`;
    try {
      await this.redis.del(cacheKey);
    } catch (error) {
      console.warn('Failed to clear conversation members cache:', error);
    }
  }

  async listGroupMembers(userId: string, conversationId: string): Promise<
    Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      role: number;
      joinedAt: string;
    }>
  > {
    await this.assertMember(conversationId, userId);

    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.type !== 2) {
      throw new BadRequestException('Only group conversations have members list');
    }

    const members = await this.dataSource.query(
      `
      SELECT
        u.id AS user_id,
        u.username AS username,
        u.avatar_url AS avatar_url,
        cm.role AS role,
        cm.joined_at AS joined_at
      FROM conversation_members cm
      INNER JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = $1
      ORDER BY cm.role DESC, cm.joined_at ASC;
      `,
      [conversationId],
    );

    return members.map(
      (row: {
        user_id: string;
        username: string;
        avatar_url: string | null;
        role: number;
        joined_at: string;
      }) => ({
        userId: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
        role: row.role,
        joinedAt: row.joined_at,
      }),
    );
  }

  async findUserConversations(userId: string): Promise<Conversation[]> {
    const conversations = await this.conversationRepository
      .createQueryBuilder('c')
      .innerJoin('c.members', 'cm', 'cm.userId = :userId', { userId })
      .select(['c.id', 'c.type', 'c.name'])
      .getMany();
    return conversations;
  }

  async listMembers(conversationId: string): Promise<Array<{ userId: string; role: number }>> {
    const members = await this.memberRepository
      .createQueryBuilder('cm')
      .where('cm.conversationId = :conversationId', { conversationId })
      .select(['cm.userId', 'cm.role'])
      .getMany();
    return members;
  }

  async getBurnDefault(
    userId: string,
    conversationId: string,
  ): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
    await this.assertMember(conversationId, userId);
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      select: ['id', 'defaultBurnEnabled', 'defaultBurnDuration'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      conversationId: conversation.id,
      enabled: conversation.defaultBurnEnabled,
      burnDuration: conversation.defaultBurnDuration,
    };
  }

  async updateBurnDefault(
    userId: string,
    conversationId: string,
    dto: UpdateBurnDefaultDto,
  ): Promise<{ conversationId: string; enabled: boolean; burnDuration: number | null }> {
    await this.assertMember(conversationId, userId);
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      select: ['id', 'defaultBurnEnabled', 'defaultBurnDuration'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (dto.enabled) {
      if (!dto.burnDuration) {
        throw new BadRequestException('burnDuration is required when enabled=true');
      }
      if (!ConversationService.ALLOWED_BURN_DURATIONS.has(dto.burnDuration)) {
        throw new BadRequestException('burnDuration must be one of 5,10,30,60,300');
      }
      conversation.defaultBurnEnabled = true;
      conversation.defaultBurnDuration = dto.burnDuration;
    } else {
      conversation.defaultBurnEnabled = false;
      conversation.defaultBurnDuration = null;
    }

    const saved = await this.conversationRepository.save(conversation);
    return {
      conversationId: saved.id,
      enabled: saved.defaultBurnEnabled,
      burnDuration: saved.defaultBurnDuration,
    };
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<{
    conversationId: string;
    type: number;
    name: string | null;
    defaultBurnEnabled: boolean;
    defaultBurnDuration: number | null;
    peerUser: { userId: string; username: string; avatarUrl: string | null } | null;
    groupInfo: { name: string; memberCount: number } | null;
  }> {
    await this.assertMember(conversationId, userId);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // 获取成员信息
    const members = await this.memberRepository.find({
      where: { conversationId },
      select: ['userId'],
    });

    const isGroup = conversation.type === 2;

    // 获取 peerUser 或群组信息
    let peerUser: { userId: string; username: string; avatarUrl: string | null } | null = null;
    let groupInfo: { name: string; memberCount: number } | null = null;

    if (!isGroup) {
      // 单聊：获取对方用户信息
      const peerMember = members.find((m) => m.userId !== userId);
      if (peerMember) {
        const peer = await this.userRepository.findOne({
          where: { id: peerMember.userId },
          select: ['id', 'username', 'avatarUrl'],
        });
        if (peer) {
          peerUser = {
            userId: peer.id,
            username: peer.username,
            avatarUrl: peer.avatarUrl,
          };
        }
      }
    } else {
      // 群聊：获取群信息
      try {
        const groupResult = await this.dataSource.query(
          `SELECT name FROM "groups" WHERE conversation_id = $1`,
          [conversationId],
        );
        if (groupResult.length > 0) {
          groupInfo = {
            name: groupResult[0].name,
            memberCount: members.length,
          };
        }
      } catch (error) {
        // groups 表可能不存在，返回基本信息
        groupInfo = {
          name: conversation.name ?? 'Group Chat',
          memberCount: members.length,
        };
      }
    }

    return {
      conversationId: conversation.id,
      type: conversation.type,
      name: conversation.name,
      defaultBurnEnabled: conversation.defaultBurnEnabled,
      defaultBurnDuration: conversation.defaultBurnDuration,
      peerUser,
      groupInfo,
    };
  }

  async assertMember(conversationId: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { conversationId, userId },
      select: ['id'],
    });

    if (!member) {
      throw new ForbiddenException('User is not a member of this conversation');
    }
  }

  async updateSettings(
    userId: string,
    conversationId: string,
    dto: { isPinned?: boolean; isMuted?: boolean },
  ): Promise<{ conversationId: string; isPinned: boolean; isMuted: boolean }> {
    await this.assertMember(conversationId, userId);

    const member = await this.memberRepository.findOne({
      where: { conversationId, userId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (dto.isPinned !== undefined) {
      member.isPinned = dto.isPinned;
    }

    if (dto.isMuted !== undefined) {
      member.isMuted = dto.isMuted;
    }

    await this.memberRepository.save(member);

    return {
      conversationId,
      isPinned: member.isPinned,
      isMuted: member.isMuted,
    };
  }

  async searchConversations(
    userId: string,
    query: string,
  ): Promise<
    Array<{
      conversationId: string;
      type: number;
      name: string | null;
    }>
  > {
    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT ON (c.id)
        c.id AS conversation_id,
        c.type AS type,
        c.name AS conversation_name,
        c.updated_at
      FROM conversations c
      INNER JOIN conversation_members cm ON cm.conversation_id = c.id
      WHERE cm.user_id = $1
        AND (
          c.name ILIKE $2
          OR c.id::text = $2
        )
      ORDER BY c.id, c.updated_at DESC
      LIMIT 20;
      `,
      [userId, `%${query.replace(/[%_]/g, '\\$&')}%`],
    );

    return rows.map((row: { conversation_id: string; type: number; conversation_name: string | null }) => ({
      conversationId: row.conversation_id,
      type: Number(row.type),
      name: row.conversation_name,
    }));
  }

  async deleteConversation(userId: string, conversationId: string): Promise<{ deleted: boolean }> {
    await this.assertMember(conversationId, userId);

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // 私聊：任何成员都可以删除
    // 群聊：只有创建者可以删除
    if (conversation.type === 2) {
      // 检查是否是群聊创建者
      const members = await this.memberRepository.find({
        where: { conversationId, role: 1 },
      });
      const isCreator = members.some((m) => m.userId === userId);
      if (!isCreator) {
        throw new ForbiddenException('Only group creator can delete the conversation');
      }
    }

    await this.conversationRepository.remove(conversation);

    return { deleted: true };
  }

  async listConversations(
    userId: string,
    query: ListConversationsDto,
  ): Promise<
    Array<{
      conversationId: string;
      type: number;
      name: string | null;
      defaultBurnEnabled: boolean;
      defaultBurnDuration: number | null;
      unreadCount: number;
      isPinned: boolean;
      isMuted: boolean;
      isOnline?: boolean;
      peerUser: { userId: string; username: string; avatarUrl: string | null } | null;
      groupInfo: { name: string; memberCount: number } | null;
      lastMessage: {
        messageId: string;
        messageIndex: string;
        senderId: string;
        messageType: number;
        encryptedPayload: string;
        isBurn: boolean;
        deliveredAt: string | null;
        readAt: string | null;
        createdAt: string;
      } | null;
    }>
  > {
    const limit = query.limit ?? 50;
    const rows = await this.dataSource.query(
      `
      SELECT
        c.id AS conversation_id,
        c.type AS type,
        c.name AS conversation_name,
        c.default_burn_enabled AS default_burn_enabled,
        c.default_burn_duration AS default_burn_duration,
        COALESCE(uc.unread_count, 0) AS unread_count,
        my.is_pinned AS is_pinned,
        my.is_muted AS is_muted,
        u.id AS peer_user_id,
        u.username AS peer_username,
        u.avatar_url AS peer_avatar_url,
        lm.id AS last_message_id,
        lm.message_index AS last_message_index,
        lm.sender_id AS last_message_sender_id,
        lm.message_type AS last_message_type,
        lm.encrypted_payload AS last_message_encrypted_payload,
        lm.is_burn AS last_message_is_burn,
        lm.delivered_at AS last_message_delivered_at,
        lm.read_at AS last_message_read_at,
        lm.created_at AS last_message_created_at,
        COALESCE(cm.member_count, 0) AS member_count
      FROM conversation_members my
      INNER JOIN conversations c ON c.id = my.conversation_id
      LEFT JOIN LATERAL (
        SELECT
          m.id,
          m.message_index,
          m.sender_id,
          m.message_type,
          m.encrypted_payload,
          m.is_burn,
          m.delivered_at,
          m.read_at,
          m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.message_index DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> $1
          AND m.read_at IS NULL
      ) uc ON TRUE
      LEFT JOIN LATERAL (
        SELECT u2.id, u2.username, u2.avatar_url
        FROM conversation_members cm2
        INNER JOIN users u2 ON u2.id = cm2.user_id
        WHERE cm2.conversation_id = c.id
          AND cm2.user_id <> $1
        ORDER BY cm2.joined_at ASC
        LIMIT 1
      ) u ON c.type = 1
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS member_count
        FROM conversation_members cm2
        WHERE cm2.conversation_id = c.id
      ) cm ON c.type = 2
      WHERE my.user_id = $1
      ORDER BY COALESCE(lm.created_at, c.updated_at) DESC
      LIMIT $2;
      `,
      [userId, limit],
    );

    // 批量查询私聊对方的在线状态
    const peerUserIds = rows
      .map((row: { peer_user_id: string | null; type: number }) => row.type === 1 ? row.peer_user_id : null)
      .filter((id): id is string => id !== null);
    const onlineStatusMap = await this.getUsersOnlineStatus(peerUserIds);

    return rows.map(
      (row: {
        conversation_id: string;
        type: number;
        conversation_name: string | null;
        default_burn_enabled: boolean;
        default_burn_duration: number | null;
        unread_count: string | number;
        is_pinned: boolean;
        is_muted: boolean;
        peer_user_id: string | null;
        peer_username: string | null;
        peer_avatar_url: string | null;
        last_message_id: string | null;
        last_message_index: string | null;
        last_message_sender_id: string | null;
        last_message_type: number | null;
        last_message_encrypted_payload: string | null;
        last_message_is_burn: boolean | null;
        last_message_delivered_at: string | null;
        last_message_read_at: string | null;
        last_message_created_at: string | null;
        member_count: string | number;
      }) => ({
        conversationId: row.conversation_id,
        type: Number(row.type),
        name: row.conversation_name,
        defaultBurnEnabled: Boolean(row.default_burn_enabled),
        defaultBurnDuration: row.default_burn_duration === null ? null : Number(row.default_burn_duration),
        unreadCount: Number(row.unread_count ?? 0),
        isPinned: Boolean(row.is_pinned),
        isMuted: Boolean(row.is_muted),
        isOnline: row.type === 1 && row.peer_user_id ? (onlineStatusMap.get(row.peer_user_id) ?? false) : undefined,
        peerUser: row.peer_user_id
          ? {
              userId: row.peer_user_id,
              username: row.peer_username ?? '',
              avatarUrl: row.peer_avatar_url,
            }
          : null,
        groupInfo: row.type === 2
          ? {
              name: row.conversation_name ?? 'Group Chat',
              memberCount: Number(row.member_count ?? 0),
            }
          : null,
        lastMessage: row.last_message_id
          ? {
              messageId: row.last_message_id,
              messageIndex: row.last_message_index ?? '0',
              senderId: row.last_message_sender_id ?? '',
              messageType: Number(row.last_message_type ?? 0),
              encryptedPayload: row.last_message_encrypted_payload ?? '',
              isBurn: Boolean(row.last_message_is_burn),
              deliveredAt: row.last_message_delivered_at,
              readAt: row.last_message_read_at,
              createdAt: row.last_message_created_at ?? new Date().toISOString(),
            }
          : null,
      }),
    );
  }

  private async getUsersOnlineStatus(userIds: string[]): Promise<Map<string, boolean>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const result = new Map<string, boolean>();
    try {
      const keys = userIds.map((id) => `online:${id}`);
      const values = await this.redis.mget(...keys);
      userIds.forEach((userId, index) => {
        result.set(userId, values[index] === '1');
      });
    } catch (error) {
      console.error('Failed to batch check users online status:', error);
      userIds.forEach((userId) => {
        result.set(userId, false);
      });
    }
    return result;
  }
}
