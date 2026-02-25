import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConversationService } from '../conversation/conversation.service';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { AckDeliveredDto } from './dto/ack-delivered.dto';
import { AckReadDto } from './dto/ack-read.dto';
import { MessageGateway } from './gateways/message.gateway';

type ExpiredBurnRow = {
  id: string;
  conversationId: string;
};

type ExpiredBurnRowRaw = {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  conversationid?: string;
};

@Injectable()
export class MessageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageService.name);
  private burnSweepTimer: NodeJS.Timeout | null = null;
  private burnSweepRunning = false;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly dataSource: DataSource,
    private readonly conversationService: ConversationService,
    private readonly messageGateway: MessageGateway,
  ) {}

  onModuleInit(): void {
    // Proactively clean expired burn messages so clients receive burn.triggered
    // without requiring a conversation refresh.
    this.burnSweepTimer = setInterval(() => {
      void this.sweepExpiredBurnMessages();
    }, 1000);
  }

  onModuleDestroy(): void {
    if (this.burnSweepTimer) {
      clearInterval(this.burnSweepTimer);
      this.burnSweepTimer = null;
    }
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<{ messageId: string; messageIndex: string }> {
    await this.conversationService.assertMember(dto.conversationId, senderId);

    const sent = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1));',
        [dto.conversationId],
      );

      const result = await manager.query(
        'SELECT COALESCE(MAX(message_index), 0) + 1 AS next_index FROM messages WHERE conversation_id = $1;',
        [dto.conversationId],
      );

      const existed = await manager.findOne(Message, {
        where: {
          conversationId: dto.conversationId,
          senderId,
          nonce: dto.nonce,
        },
      });
      if (existed) {
        return {
          conversationId: dto.conversationId,
          messageId: existed.id,
          messageIndex: String(existed.messageIndex),
          senderId,
          createdAt: existed.createdAt.toISOString(),
          deduped: true,
        };
      }

      const nextIndex = String(result[0].next_index);

      const message = manager.create(Message, {
        conversationId: dto.conversationId,
        senderId,
        messageType: dto.messageType,
        encryptedPayload: dto.encryptedPayload,
        nonce: dto.nonce,
        messageIndex: nextIndex,
        isBurn: dto.isBurn,
        burnDuration: dto.burnDuration ?? null,
      });

      const saved = await manager.save(Message, message);
      return {
        conversationId: dto.conversationId,
        messageId: saved.id,
        messageIndex: nextIndex,
        senderId,
        createdAt: saved.createdAt.toISOString(),
        deduped: false,
      };
    });

    if (!sent.deduped) {
      this.messageGateway.emitMessageSent(sent.conversationId, {
        messageId: sent.messageId,
        messageIndex: sent.messageIndex,
        senderId: sent.senderId,
        createdAt: sent.createdAt,
      });
      const memberUserIds = await this.listConversationMemberUserIds(sent.conversationId);
      this.messageGateway.emitConversationUpdated(memberUserIds, {
        conversationId: sent.conversationId,
        reason: 'message.sent',
      });
    }

    return { messageId: sent.messageId, messageIndex: sent.messageIndex };
  }

  async queryMessages(userId: string, query: QueryMessagesDto): Promise<Message[]> {
    await this.conversationService.assertMember(query.conversationId, userId);
    await this.cleanupExpiredBurnMessages(query.conversationId);
    const afterIndex = query.afterIndex ?? 0;
    const limit = query.limit ?? 50;

    if (afterIndex <= 0) {
      const latestRows = await this.messageRepository
        .createQueryBuilder('m')
        .where('m.conversationId = :conversationId', { conversationId: query.conversationId })
        .orderBy('m.messageIndex', 'DESC')
        .limit(limit)
        .getMany();
      return latestRows.reverse();
    }

    return this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId: query.conversationId })
      .andWhere('m.messageIndex > :afterIndex', { afterIndex: String(afterIndex) })
      .orderBy('m.messageIndex', 'ASC')
      .limit(limit)
      .getMany();
  }

  private async cleanupExpiredBurnMessages(conversationId: string): Promise<void> {
    const deletedRows = await this.deleteExpiredBurnMessages(conversationId);
    if (deletedRows.length > 0) {
      await this.emitBurnTriggeredBatch(deletedRows);
    }
  }

  private async sweepExpiredBurnMessages(): Promise<void> {
    if (this.burnSweepRunning) {
      return;
    }
    this.burnSweepRunning = true;

    try {
      const deletedRows = await this.deleteExpiredBurnMessages();
      if (deletedRows.length > 0) {
        await this.emitBurnTriggeredBatch(deletedRows);
      }
    } catch (error) {
      this.logger.error('Failed to sweep expired burn messages', error as Error);
    } finally {
      this.burnSweepRunning = false;
    }
  }

  private async emitBurnTriggeredBatch(rows: ExpiredBurnRow[]): Promise<void> {
    const triggeredAt = new Date().toISOString();
    const conversationIds = [...new Set(rows.map((row) => row.conversationId))];
    const membersMap = await this.listConversationMemberUserIdsMap(conversationIds);

    for (const row of rows) {
      this.messageGateway.emitBurnTriggered(row.conversationId, row.id, triggeredAt);
      this.messageGateway.emitConversationUpdated(membersMap.get(row.conversationId) ?? [], {
        conversationId: row.conversationId,
        reason: 'burn.triggered',
      });
    }
  }

  private async listConversationMemberUserIds(conversationId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT user_id::text AS user_id FROM conversation_members WHERE conversation_id = $1;`,
      [conversationId],
    );
    return (rows as Array<{ user_id?: string }>).map((row) => row.user_id ?? '').filter(Boolean);
  }

  private async listConversationMemberUserIdsMap(conversationIds: string[]): Promise<Map<string, string[]>> {
    const membersMap = new Map<string, string[]>();
    if (conversationIds.length === 0) {
      return membersMap;
    }

    const rows = await this.dataSource.query(
      `
      SELECT conversation_id::text AS conversation_id, user_id::text AS user_id
      FROM conversation_members
      WHERE conversation_id = ANY($1::uuid[]);
      `,
      [conversationIds],
    );

    for (const row of rows as Array<{ conversation_id?: string; user_id?: string }>) {
      const conversationId = row.conversation_id ?? '';
      const userId = row.user_id ?? '';
      if (!conversationId || !userId) {
        continue;
      }
      const current = membersMap.get(conversationId) ?? [];
      current.push(userId);
      membersMap.set(conversationId, current);
    }

    return membersMap;
  }

  private async deleteExpiredBurnMessages(conversationId?: string): Promise<ExpiredBurnRow[]> {
    const params: unknown[] = [];
    const conversationFilter = conversationId ? 'AND m.conversation_id = $1' : '';
    if (conversationId) {
      params.push(conversationId);
    }

    const rows = await this.dataSource.query(
      `
      WITH expired AS (
        SELECT m.id, m.conversation_id
        FROM messages m
        WHERE m.is_burn = true
          AND m.read_at IS NOT NULL
          AND m.burn_duration IS NOT NULL
          AND m.read_at + (m.burn_duration || ' seconds')::interval <= CURRENT_TIMESTAMP
          ${conversationFilter}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM messages t
      USING expired e
      WHERE t.id = e.id
      RETURNING e.id::text AS id, e.conversation_id::text AS conversation_id;
      `,
      params,
    );

    return (rows as ExpiredBurnRowRaw[])
      .map((row) => ({
        id: row.id,
        conversationId: row.conversation_id ?? row.conversationId ?? row.conversationid ?? '',
      }))
      .filter((row) => row.id && row.conversationId);
  }

  async ackDelivered(userId: string, dto: AckDeliveredDto): Promise<{ deliveredCount: number }> {
    await this.conversationService.assertMember(dto.conversationId, userId);
    const maxIndex = String(dto.maxMessageIndex);

    const result = await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ deliveredAt: () => 'CURRENT_TIMESTAMP' })
      .where('conversation_id = :conversationId', { conversationId: dto.conversationId })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('message_index <= :maxIndex', { maxIndex })
      .andWhere('delivered_at IS NULL')
      .execute();

    const deliveredCount = result.affected ?? 0;
    if (deliveredCount > 0) {
      this.messageGateway.emitMessageDelivered(dto.conversationId, {
        maxMessageIndex: maxIndex,
        ackByUserId: userId,
        deliveredCount,
        ackAt: new Date().toISOString(),
      });
      const memberUserIds = await this.listConversationMemberUserIds(dto.conversationId);
      this.messageGateway.emitConversationUpdated(memberUserIds, {
        conversationId: dto.conversationId,
        reason: 'message.delivered',
      });
    }
    return { deliveredCount };
  }

  async ackRead(userId: string, dto: AckReadDto): Promise<{ readCount: number }> {
    await this.conversationService.assertMember(dto.conversationId, userId);
    const maxIndex = String(dto.maxMessageIndex);

    const result = await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({
        readAt: () => 'CURRENT_TIMESTAMP',
        deliveredAt: () => 'COALESCE(delivered_at, CURRENT_TIMESTAMP)',
      })
      .where('conversation_id = :conversationId', { conversationId: dto.conversationId })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('message_index <= :maxIndex', { maxIndex })
      .andWhere('read_at IS NULL')
      .execute();

    const readCount = result.affected ?? 0;
    if (readCount > 0) {
      this.messageGateway.emitMessageRead(dto.conversationId, {
        maxMessageIndex: maxIndex,
        ackByUserId: userId,
        readCount,
        ackAt: new Date().toISOString(),
      });
      const memberUserIds = await this.listConversationMemberUserIds(dto.conversationId);
      this.messageGateway.emitConversationUpdated(memberUserIds, {
        conversationId: dto.conversationId,
        reason: 'message.read',
      });
    }
    return { readCount };
  }
}
