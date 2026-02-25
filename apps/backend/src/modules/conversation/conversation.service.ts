import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { Conversation } from './entities/conversation.entity';
import { ListConversationsDto } from './dto/list-conversations.dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly memberRepository: Repository<ConversationMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
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

    const members = [userId, peerUserId];

    const existingMembers = await this.memberRepository.find({
      where: { userId: In(members) },
      select: ['conversationId', 'userId'],
    });

    const grouped = new Map<string, Set<string>>();
    for (const member of existingMembers) {
      if (!grouped.has(member.conversationId)) {
        grouped.set(member.conversationId, new Set());
      }
      grouped.get(member.conversationId)?.add(member.userId);
    }

    for (const [conversationId, userSet] of grouped.entries()) {
      if (userSet.size === 2 && userSet.has(userId) && userSet.has(peerUserId)) {
        const conversation = await this.conversationRepository.findOne({ where: { id: conversationId, type: 1 } });
        if (conversation) {
          return { conversationId: conversation.id };
        }
      }
    }

    const conversation = await this.conversationRepository.save(
      this.conversationRepository.create({
        type: 1,
      }),
    );

    await this.memberRepository.save([
      this.memberRepository.create({ conversationId: conversation.id, userId, role: 0 }),
      this.memberRepository.create({ conversationId: conversation.id, userId: peerUserId, role: 0 }),
    ]);

    return { conversationId: conversation.id };
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

  async listConversations(
    userId: string,
    query: ListConversationsDto,
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
    const limit = query.limit ?? 50;
    const rows = await this.dataSource.query(
      `
      SELECT
        c.id AS conversation_id,
        c.type AS type,
        COALESCE(uc.unread_count, 0) AS unread_count,
        u.id AS peer_user_id,
        u.username AS peer_username,
        u.avatar_url AS peer_avatar_url,
        lm.id AS last_message_id,
        lm.message_index AS last_message_index,
        lm.sender_id AS last_message_sender_id,
        lm.message_type AS last_message_type,
        lm.is_burn AS last_message_is_burn,
        lm.delivered_at AS last_message_delivered_at,
        lm.read_at AS last_message_read_at,
        lm.created_at AS last_message_created_at
      FROM conversation_members my
      INNER JOIN conversations c ON c.id = my.conversation_id
      LEFT JOIN LATERAL (
        SELECT
          m.id,
          m.message_index,
          m.sender_id,
          m.message_type,
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
      WHERE my.user_id = $1
      ORDER BY COALESCE(lm.created_at, c.updated_at) DESC
      LIMIT $2;
      `,
      [userId, limit],
    );

    return rows.map(
      (row: {
        conversation_id: string;
        type: number;
        unread_count: string | number;
        peer_user_id: string | null;
        peer_username: string | null;
        peer_avatar_url: string | null;
        last_message_id: string | null;
        last_message_index: string | null;
        last_message_sender_id: string | null;
        last_message_type: number | null;
        last_message_is_burn: boolean | null;
        last_message_delivered_at: string | null;
        last_message_read_at: string | null;
        last_message_created_at: string | null;
      }) => ({
        conversationId: row.conversation_id,
        type: Number(row.type),
        unreadCount: Number(row.unread_count ?? 0),
        peerUser: row.peer_user_id
          ? {
              userId: row.peer_user_id,
              username: row.peer_username ?? '',
              avatarUrl: row.peer_avatar_url,
            }
          : null,
        lastMessage: row.last_message_id
          ? {
              messageId: row.last_message_id,
              messageIndex: row.last_message_index ?? '0',
              senderId: row.last_message_sender_id ?? '',
              messageType: Number(row.last_message_type ?? 0),
              isBurn: Boolean(row.last_message_is_burn),
              deliveredAt: row.last_message_delivered_at,
              readAt: row.last_message_read_at,
              createdAt: row.last_message_created_at ?? new Date().toISOString(),
            }
          : null,
      }),
    );
  }
}
