import { BadRequestException, Inject, forwardRef, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { unlink } from 'node:fs/promises';
import { ConversationService } from '../conversation/conversation.service';
import { Conversation } from '../conversation/entities/conversation.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';
import { Message } from './entities/message.entity';
import { DraftMessage } from './entities/draft-message.entity';
import { RevokeEvent } from './entities/revoke-event.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { AckDeliveredDto } from './dto/ack-delivered.dto';
import { AckReadDto } from './dto/ack-read.dto';
import { AckReadOneDto } from './dto/ack-read-one.dto';
import { AckRevokeDto } from './dto/ack-revoke.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { SaveDraftDto, GetDraftDto, DeleteDraftDto } from './dto/draft-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { MessageGateway } from './gateways/message.gateway';
import { NotificationService } from '../notification/notification.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { MessageDeviceEnvelope } from './entities/message-device-envelope.entity';
import { SendMessageV2Dto } from './dto/send-message-v2.dto';
import { SendMessageEnvelopeDto } from './dto/send-message-envelope.dto';

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

type MessageSearchRow = {
  messageId: string;
  conversationId: string;
  senderId: string;
  messageType: number;
  messageIndex: string;
  isBurn: boolean;
  burnDuration: number | null;
  isRevoked: boolean;
  deliveredAt?: Date | string | null;
  deliveredat?: Date | string | null;
  readAt?: Date | string | null;
  readat?: Date | string | null;
  createdAt?: Date | string | null;
  createdat?: Date | string | null;
};

type ParsedRustGroupEnvelope = {
  gid: string;
  sid: string;
  mn: number;
  chain: string;
  body: string;
};

@Injectable()
export class MessageService implements OnModuleInit, OnModuleDestroy {
  private static readonly ALLOWED_BURN_DURATIONS = new Set([5, 10, 30, 60, 300]);
  private readonly logger = new Logger(MessageService.name);
  private burnSweepTimer: NodeJS.Timeout | null = null;
  private burnSweepRunning = false;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDeviceEnvelope)
    private readonly messageEnvelopeRepository: Repository<MessageDeviceEnvelope>,
    @InjectRepository(DraftMessage)
    private readonly draftRepository: Repository<DraftMessage>,
    @InjectRepository(RevokeEvent)
    private readonly revokeEventRepository: Repository<RevokeEvent>,
    @InjectRepository(MediaAsset)
    private readonly mediaAssetRepository: Repository<MediaAsset>,
    private readonly dataSource: DataSource,
    private readonly conversationService: ConversationService,
    @Inject(forwardRef(() => MessageGateway)) private readonly messageGateway: MessageGateway,
    private readonly notificationService: NotificationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    void this.ensureSendV2SchemaCompatibility();
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

  private async ensureSendV2SchemaCompatibility(): Promise<void> {
    try {
      const nullableRows = await this.dataSource.query(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'encrypted_payload' LIMIT 1;`,
      );
      const isNullable = Array.isArray(nullableRows) && nullableRows[0]?.is_nullable === 'YES';
      if (!isNullable) {
        await this.dataSource.query(`ALTER TABLE "messages" ALTER COLUMN "encrypted_payload" DROP NOT NULL;`);
      }

      const tableRows = await this.dataSource.query(
        `SELECT to_regclass('public.message_device_envelopes') AS reg;`,
      );
      const tableExists = Array.isArray(tableRows) && tableRows[0]?.reg;
      if (!tableExists) {
        await this.dataSource.query(`
          CREATE TABLE "message_device_envelopes" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "message_id" uuid NOT NULL,
            "target_user_id" uuid NOT NULL,
            "target_device_id" uuid NOT NULL,
            "source_device_id" uuid,
            "encrypted_payload" text NOT NULL,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_message_device_envelopes" PRIMARY KEY ("id"),
            CONSTRAINT "FK_message_device_envelopes_message" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_message_device_envelopes_target_device" FOREIGN KEY ("target_device_id") REFERENCES "devices"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_message_device_envelopes_source_device" FOREIGN KEY ("source_device_id") REFERENCES "devices"("id") ON DELETE SET NULL
          );
        `);
      }

      await this.dataSource.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_message_device_envelopes_message_device" ON "message_device_envelopes" ("message_id", "target_device_id");`,
      );
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS "IDX_message_device_envelopes_target_device" ON "message_device_envelopes" ("target_device_id", "message_id");`,
      );
    } catch (error) {
      this.logger.warn('Failed to ensure send-v2 schema compatibility', error as Error);
    }
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<{ messageId: string; messageIndex: string }> {
    await this.conversationService.assertMember(dto.conversationId, senderId);
    this.assertMediaPayloadShape(dto.messageType, dto.mediaAssetId);

    const sent = await this.dataSource.transaction(async (manager) => {
      const burnSettings = await this.resolveBurnSettings(
        manager,
        dto.conversationId,
        dto.messageType,
        dto.isBurn,
        dto.burnDuration,
      );

      const mediaAssetId = dto.mediaAssetId
        ? await this.assertAndBindMediaAsset(manager, senderId, dto.conversationId, dto.messageType, dto.mediaAssetId)
        : null;

      const conversation = await manager.findOne(Conversation, {
        where: { id: dto.conversationId },
        select: ['id', 'type'],
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
      if (conversation.type !== 2) {
        throw new BadRequestException('Direct conversations must use /api/v1/message/send-v2');
      }
      const groupEnvelope = this.assertAndParseGroupRustPayload(
        dto.conversationId,
        senderId,
        dto.encryptedPayload,
      );
      await this.upsertGroupSenderKey(manager, dto.conversationId, senderId, groupEnvelope.chain);

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
          sourceDeviceId: dto.sourceDeviceId ?? IsNull(),
        },
      });
      if (existed) {
        const samePayload =
          existed.messageType === dto.messageType &&
          existed.encryptedPayload === dto.encryptedPayload &&
          (existed.sourceDeviceId ?? null) === (dto.sourceDeviceId ?? null) &&
          (existed.mediaAssetId ?? null) === (mediaAssetId ?? null) &&
          existed.isBurn === burnSettings.isBurn &&
          (existed.burnDuration ?? null) === (burnSettings.burnDuration ?? null);
        if (!samePayload) {
          throw new BadRequestException('Replay nonce conflict detected');
        }
        return {
          conversationId: dto.conversationId,
          messageId: existed.id,
          messageIndex: String(existed.messageIndex),
          senderId,
          createdAt: existed.createdAt.toISOString(),
          deduped: true,
        };
      }

      if (dto.sourceDeviceId) {
        const ownDevice = await manager.query(
          'SELECT id FROM devices WHERE id = $1 AND user_id = $2 LIMIT 1;',
          [dto.sourceDeviceId, senderId],
        );
        if (!Array.isArray(ownDevice) || ownDevice.length === 0) {
          throw new BadRequestException('sourceDeviceId is invalid for current user');
        }
      }

      const nextIndex = String(result[0].next_index);

      const message = manager.create(Message, {
        conversationId: dto.conversationId,
        senderId,
        sourceDeviceId: dto.sourceDeviceId ?? null,
        messageType: dto.messageType,
        encryptedPayload: dto.encryptedPayload,
        nonce: dto.nonce,
        mediaAssetId,
        messageIndex: nextIndex,
        isBurn: burnSettings.isBurn,
        burnDuration: burnSettings.burnDuration,
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
      // 异步处理WebSocket事件和通知，避免阻塞主流程
      void this.handleMessageSentEvent(sent, senderId);
    }

    return { messageId: sent.messageId, messageIndex: sent.messageIndex };
  }

  private async sendMessageLegacyTransactionPath(
    manager: EntityManager,
    senderId: string,
    dto: SendMessageDto,
    burnSettings: { isBurn: boolean; burnDuration: number | null },
    mediaAssetId: string | null,
  ): Promise<{
    conversationId: string;
    messageId: string;
    messageIndex: string;
    senderId: string;
    createdAt: string;
    deduped: boolean;
  }> {
    const existed = await manager.findOne(Message, {
      where: {
        conversationId: dto.conversationId,
        senderId,
        nonce: dto.nonce,
        sourceDeviceId: dto.sourceDeviceId ?? IsNull(),
      },
    });
    if (existed) {
      const samePayload =
        existed.messageType === dto.messageType &&
        existed.encryptedPayload === dto.encryptedPayload &&
        (existed.sourceDeviceId ?? null) === (dto.sourceDeviceId ?? null) &&
        (existed.mediaAssetId ?? null) === (mediaAssetId ?? null) &&
        existed.isBurn === burnSettings.isBurn &&
        (existed.burnDuration ?? null) === (burnSettings.burnDuration ?? null);
      if (!samePayload) {
        throw new BadRequestException('Replay nonce conflict detected');
      }
      return {
        conversationId: dto.conversationId,
        messageId: existed.id,
        messageIndex: String(existed.messageIndex),
        senderId,
        createdAt: existed.createdAt.toISOString(),
        deduped: true,
      };
    }

    if (dto.sourceDeviceId) {
      const ownDevice = await manager.query(
        'SELECT id FROM devices WHERE id = $1 AND user_id = $2 LIMIT 1;',
        [dto.sourceDeviceId, senderId],
      );
      if (!Array.isArray(ownDevice) || ownDevice.length === 0) {
        throw new BadRequestException('sourceDeviceId is invalid for current user');
      }
    }

    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtext($1));',
      [dto.conversationId],
    );

    const result = await manager.query(
      'SELECT COALESCE(MAX(message_index), 0) + 1 AS next_index FROM messages WHERE conversation_id = $1;',
      [dto.conversationId],
    );
    const nextIndex = String(result[0].next_index);

    const message = manager.create(Message, {
      conversationId: dto.conversationId,
      senderId,
      sourceDeviceId: dto.sourceDeviceId ?? null,
      messageType: dto.messageType,
      encryptedPayload: dto.encryptedPayload,
      nonce: dto.nonce,
      mediaAssetId,
      messageIndex: nextIndex,
      isBurn: burnSettings.isBurn,
      burnDuration: burnSettings.burnDuration,
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
  }

  private assertAndParseGroupRustPayload(
    conversationId: string,
    senderId: string,
    encryptedPayload: string,
  ): ParsedRustGroupEnvelope {
    try {
      const parsed = JSON.parse(encryptedPayload);
      const isRustGroupEnvelope =
        parsed?.impl === 'rust-group' &&
        parsed?.v === 1 &&
        typeof parsed?.gid === 'string' &&
        typeof parsed?.sid === 'string' &&
        typeof parsed?.mn === 'number' &&
        typeof parsed?.chain === 'string' &&
        typeof parsed?.body === 'string';
      if (!isRustGroupEnvelope) {
        throw new BadRequestException('Group messages require rust-group encrypted payload');
      }
      if (parsed.gid !== conversationId) {
        throw new BadRequestException('Group payload gid must match conversationId');
      }
      if (parsed.sid !== senderId) {
        throw new BadRequestException('Group payload sid must match senderId');
      }
      return {
        gid: parsed.gid,
        sid: parsed.sid,
        mn: parsed.mn,
        chain: parsed.chain,
        body: parsed.body,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Group messages require rust-group encrypted payload');
    }
  }

  private async upsertGroupSenderKey(
    manager: EntityManager,
    conversationId: string,
    senderId: string,
    senderKey: string,
  ): Promise<void> {
    await manager.query(
      `
      INSERT INTO sender_keys (group_id, user_id, sender_key, updated_at)
      VALUES ($1::uuid, $2::uuid, $3, now())
      ON CONFLICT (group_id, user_id)
      DO UPDATE SET sender_key = EXCLUDED.sender_key, updated_at = now();
      `,
      [conversationId, senderId, senderKey],
    );
  }

  async sendMessageV2(
    user: RequestUser,
    dto: SendMessageV2Dto,
  ): Promise<{ messageId: string; messageIndex: string }> {
    const sourceDeviceId = this.assertAuthenticatedDeviceId(user);

    await this.conversationService.assertMember(dto.conversationId, user.userId);
    this.assertMediaPayloadShape(dto.messageType, dto.mediaAssetId);
    this.assertEnvelopeSetIsWellFormed(dto.envelopes);

    const sent = await this.dataSource.transaction(async (manager) => {
      const burnSettings = await this.resolveBurnSettings(
        manager,
        dto.conversationId,
        dto.messageType,
        dto.isBurn,
        dto.burnDuration,
      );

      const mediaAssetId = dto.mediaAssetId
        ? await this.assertAndBindMediaAsset(manager, user.userId, dto.conversationId, dto.messageType, dto.mediaAssetId)
        : null;

      await this.assertSourceDeviceBelongsToSender(manager, user.userId, sourceDeviceId);
      await this.assertEnvelopeTargetsBelongToConversation(
        manager,
        dto.conversationId,
        user.userId,
        dto.envelopes,
      );

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
          senderId: user.userId,
          nonce: dto.nonce,
          sourceDeviceId,
        },
      });
      if (existed) {
        const samePayload =
          existed.messageType === dto.messageType &&
          existed.encryptedPayload === null &&
          (existed.sourceDeviceId ?? null) === sourceDeviceId &&
          (existed.mediaAssetId ?? null) === (mediaAssetId ?? null) &&
          existed.isBurn === burnSettings.isBurn &&
          (existed.burnDuration ?? null) === (burnSettings.burnDuration ?? null) &&
          await this.hasMatchingEnvelopeSet(manager, existed.id, sourceDeviceId, dto.envelopes);
        if (!samePayload) {
          throw new BadRequestException('Replay nonce conflict detected');
        }
        return {
          conversationId: dto.conversationId,
          messageId: existed.id,
          messageIndex: String(existed.messageIndex),
          senderId: user.userId,
          createdAt: existed.createdAt.toISOString(),
          deduped: true,
        };
      }

      const nextIndex = String(result[0].next_index);

      const message = manager.create(Message, {
        conversationId: dto.conversationId,
        senderId: user.userId,
        sourceDeviceId,
        messageType: dto.messageType,
        encryptedPayload: null,
        nonce: dto.nonce,
        mediaAssetId,
        messageIndex: nextIndex,
        isBurn: burnSettings.isBurn,
        burnDuration: burnSettings.burnDuration,
      });

      const saved = await manager.save(Message, message);
      const envelopes = dto.envelopes.map((envelope) =>
        manager.create(MessageDeviceEnvelope, {
          messageId: saved.id,
          targetUserId: envelope.targetUserId,
          targetDeviceId: envelope.targetDeviceId,
          sourceDeviceId,
          encryptedPayload: envelope.encryptedPayload,
        }),
      );
      await manager.save(MessageDeviceEnvelope, envelopes);

      return {
        conversationId: dto.conversationId,
        messageId: saved.id,
        messageIndex: nextIndex,
        senderId: user.userId,
        createdAt: saved.createdAt.toISOString(),
        deduped: false,
      };
    });

    if (!sent.deduped) {
      void this.handleMessageSentEvent(sent, user.userId);
    }

    return { messageId: sent.messageId, messageIndex: sent.messageIndex };
  }

  private async handleMessageSentEvent(sent: any, senderId: string): Promise<void> {
    try {
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

      // Create notifications for all other members, respecting their notification settings
      const notificationDtos = [];
      for (const memberUserId of memberUserIds) {
        if (memberUserId === senderId) {
          continue;
        }
        const isEnabled = await this.notificationService.isNotificationEnabled(memberUserId, 'message');
        if (!isEnabled) {
          continue;
        }
        notificationDtos.push({
          userId: memberUserId,
          type: 'message' as const,
          title: 'New Message',
          body: 'You have a new message',
          data: {
            conversationId: sent.conversationId,
            messageId: sent.messageId,
            senderId: sent.senderId,
          },
        });
      }

      if (notificationDtos.length > 0) {
        await this.notificationService.createBatchNotifications(notificationDtos);
      }
    } catch (error) {
      this.logger.warn('Failed to handle message sent event:', error);
    }
  }

  async getMessageById(userId: string, messageId: string, deviceId?: string): Promise<Message | null> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) {
      return null;
    }

    // 验证用户是会话成员
    await this.conversationService.assertMember(message.conversationId, userId);

    // 解析 envelope payload（如果是 v2 消息）
    await this.resolveEnvelopePayloadsForDevice([message], deviceId);

    return message;
  }

  async queryMessages(userId: string, query: QueryMessagesDto, deviceId?: string): Promise<Message[]> {
    await this.conversationService.assertMember(query.conversationId, userId);
    // Optimized: Moved cleanup to background to improve query performance
    void this.cleanupExpiredBurnMessages(query.conversationId);
    const afterIndex = query.afterIndex ?? 0;
    const beforeIndex = query.beforeIndex ?? 0;
    const limit = Math.min(query.limit ?? 50, 100); // Optimized: Added upper limit to prevent excessive data fetching

    if (afterIndex > 0 && beforeIndex > 0) {
      throw new BadRequestException('afterIndex and beforeIndex cannot be used together');
    }

    if (beforeIndex > 0) {
      const olderRows = await this.messageRepository
        .createQueryBuilder('m')
        .where('m.conversationId = :conversationId', { conversationId: query.conversationId })
        .andWhere('m.messageIndex < :beforeIndex', { beforeIndex: String(beforeIndex) })
        .andWhere('m.isRevoked = false')
        .orderBy('m.messageIndex', 'DESC')
        .limit(limit)
        .getMany();
      const rows = olderRows.reverse();
      await this.resolveEnvelopePayloadsForDevice(rows, deviceId);
      return rows;
    }

    if (afterIndex <= 0) {
      const latestRows = await this.messageRepository
        .createQueryBuilder('m')
        .where('m.conversationId = :conversationId', { conversationId: query.conversationId })
        .andWhere('m.isRevoked = false')
        .orderBy('m.messageIndex', 'DESC')
        .limit(limit)
        .getMany();
      const rows = latestRows.reverse();
      await this.resolveEnvelopePayloadsForDevice(rows, deviceId);
      return rows;
    }

    const rows = await this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId: query.conversationId })
      .andWhere('m.messageIndex > :afterIndex', { afterIndex: String(afterIndex) })
      .andWhere('m.isRevoked = false')
      .orderBy('m.messageIndex', 'ASC')
      .limit(limit)
      .getMany();
    await this.resolveEnvelopePayloadsForDevice(rows, deviceId);
    return rows;
  }

  private assertMediaPayloadShape(messageType: number, mediaAssetId?: string | null): void {
    if (messageType === 1 && mediaAssetId) {
      throw new BadRequestException('Text message must not include mediaAssetId');
    }
  }

  private assertAuthenticatedDeviceId(user: RequestUser): string {
    if (!user.deviceId) {
      throw new BadRequestException('Authenticated deviceId is required for send-v2');
    }
    return user.deviceId;
  }

  private assertEnvelopeSetIsWellFormed(envelopes: SendMessageEnvelopeDto[]): void {
    if (envelopes.length === 0) {
      throw new BadRequestException('envelopes must not be empty');
    }

    const seen = new Set<string>();
    for (const envelope of envelopes) {
      const key = `${envelope.targetUserId}:${envelope.targetDeviceId}`;
      if (seen.has(key)) {
        throw new BadRequestException('duplicate target device envelope');
      }
      seen.add(key);
    }
  }

  private async assertSourceDeviceBelongsToSender(
    manager: EntityManager,
    senderId: string,
    sourceDeviceId: string,
  ): Promise<void> {
    const ownDevice = await manager.query(
      'SELECT id FROM devices WHERE id = $1 AND user_id = $2 LIMIT 1;',
      [sourceDeviceId, senderId],
    );
    if (!Array.isArray(ownDevice) || ownDevice.length === 0) {
      throw new BadRequestException('Authenticated deviceId is invalid for current user');
    }
  }

  private async assertEnvelopeTargetsBelongToConversation(
    manager: EntityManager,
    conversationId: string,
    senderId: string,
    envelopes: SendMessageEnvelopeDto[],
  ): Promise<void> {
    const conversation = await manager.findOne(Conversation, {
      where: { id: conversationId },
      select: ['id', 'type'],
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.type !== 1) {
      throw new BadRequestException('send-v2 currently supports direct conversations only');
    }

    const memberRows = await manager.query(
      `SELECT user_id::text AS user_id FROM conversation_members WHERE conversation_id = $1;`,
      [conversationId],
    );
    const memberUserIds = new Set(
      (memberRows as Array<{ user_id?: string }>).map((row) => row.user_id ?? '').filter(Boolean),
    );
    const allowedDirectTargets = new Set([...memberUserIds]);

    const targetDeviceIds = [...new Set(envelopes.map((envelope) => envelope.targetDeviceId))];
    const rows = await manager.query(
      `
      SELECT d.id::text AS device_id, d.user_id::text AS user_id
      FROM devices d
      INNER JOIN conversation_members cm ON cm.user_id = d.user_id AND cm.conversation_id = $1
      WHERE d.id = ANY($2::uuid[]);
      `,
      [conversationId, targetDeviceIds],
    );
    const devicesById = new Map(
      (rows as Array<{ device_id?: string; user_id?: string }>)
        .map((row) => [row.device_id ?? '', row.user_id ?? ''] as const)
        .filter(([deviceId, userId]) => deviceId && userId),
    );

    for (const envelope of envelopes) {
      if (!memberUserIds.has(envelope.targetUserId)) {
        throw new BadRequestException('envelope target must be a conversation member device');
      }

      const actualUserId = devicesById.get(envelope.targetDeviceId);
      if (!actualUserId || actualUserId !== envelope.targetUserId) {
        throw new BadRequestException('envelope target must be a conversation member device');
      }

      if (!allowedDirectTargets.has(envelope.targetUserId)) {
        throw new BadRequestException('direct conversations must target recipient devices');
      }
    }

    const hasRecipientTarget = envelopes.some((envelope) => envelope.targetUserId !== senderId);
    if (!hasRecipientTarget) {
      throw new BadRequestException('direct conversations must include recipient device envelopes');
    }
    await this.assertDirectRecipientDeviceCoverage(
      manager,
      conversationId,
      senderId,
      envelopes,
    );
  }

  private async hasMatchingEnvelopeSet(
    manager: EntityManager,
    messageId: string,
    sourceDeviceId: string,
    envelopes: SendMessageEnvelopeDto[],
  ): Promise<boolean> {
    const existingEnvelopes = await manager.find(MessageDeviceEnvelope, {
      where: { messageId },
    });

    if (existingEnvelopes.length !== envelopes.length) {
      return false;
    }

    const expected = new Map(
      envelopes.map((envelope) => [
        `${envelope.targetUserId}:${envelope.targetDeviceId}`,
        envelope.encryptedPayload,
      ]),
    );

    for (const envelope of existingEnvelopes) {
      const key = `${envelope.targetUserId}:${envelope.targetDeviceId}`;
      if ((envelope.sourceDeviceId ?? null) !== sourceDeviceId) {
        return false;
      }
      if (expected.get(key) !== envelope.encryptedPayload) {
        return false;
      }
      expected.delete(key);
    }

    return expected.size === 0;
  }

  private async resolveEnvelopePayloadsForDevice(rows: Message[], deviceId?: string): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const missingPayloadMessageIds = rows
      .filter((row) => !row.encryptedPayload)
      .map((row) => row.id);
    if (missingPayloadMessageIds.length === 0) {
      return;
    }
    if (!deviceId) {
      throw new BadRequestException(
        'Device context is required to read messages encrypted for multiple devices',
      );
    }

    const payloadByMessageId = new Map<string, string>();
    const envelopes = await this.messageEnvelopeRepository.find({
      where: {
        targetDeviceId: deviceId,
        messageId: In(missingPayloadMessageIds),
      },
      select: ['messageId', 'encryptedPayload'],
    });
    envelopes.forEach((envelope) => {
      payloadByMessageId.set(envelope.messageId, envelope.encryptedPayload);
    });

    for (const row of rows) {
      if (!row.encryptedPayload) {
        row.encryptedPayload = payloadByMessageId.get(row.id) ?? null;
      }
    }
  }

  private async assertDirectRecipientDeviceCoverage(
    manager: EntityManager,
    conversationId: string,
    senderId: string,
    envelopes: SendMessageEnvelopeDto[],
  ): Promise<void> {
    const expectedRows = await manager.query(
      `
      SELECT d.id::text AS device_id, d.user_id::text AS user_id
      FROM devices d
      INNER JOIN conversation_members cm ON cm.user_id = d.user_id
      WHERE cm.conversation_id = $1
        AND cm.user_id <> $2;
      `,
      [conversationId, senderId],
    );
    const requiredRecipientDeviceKeys = new Set(
      (expectedRows as Array<{ device_id?: string; user_id?: string }>)
        .map((row) => {
          const deviceId = row.device_id ?? '';
          const userId = row.user_id ?? '';
          return deviceId && userId ? `${userId}:${deviceId}` : '';
        })
        .filter(Boolean),
    );
    if (requiredRecipientDeviceKeys.size === 0) {
      throw new BadRequestException('direct conversations require at least one recipient device');
    }

    const providedRecipientKeys = new Set(
      envelopes
        .filter((envelope) => envelope.targetUserId !== senderId)
        .map((envelope) => `${envelope.targetUserId}:${envelope.targetDeviceId}`),
    );
    for (const requiredKey of requiredRecipientDeviceKeys) {
      if (!providedRecipientKeys.has(requiredKey)) {
        throw new BadRequestException('direct conversations must include all recipient devices');
      }
    }
  }

  private async resolveBurnSettings(
    manager: EntityManager,
    conversationId: string,
    messageType: number,
    requestedIsBurn: boolean | undefined,
    requestedBurnDuration: number | null | undefined,
  ): Promise<{ isBurn: boolean; burnDuration: number | null }> {
    const normalizedBurnDuration = requestedBurnDuration ?? undefined;
    const ensureSupportedType = (): void => {
      if (![1, 2, 3].includes(messageType)) {
        throw new BadRequestException('Burn message supports only text/image/audio');
      }
    };

    const ensureDurationAllowed = (duration: number | null | undefined): number => {
      if (!duration) {
        throw new BadRequestException('burnDuration is required for burn message');
      }
      if (!MessageService.ALLOWED_BURN_DURATIONS.has(duration)) {
        throw new BadRequestException('burnDuration must be one of 5,10,30,60,300');
      }
      return duration;
    };

    if (requestedIsBurn === true) {
      ensureSupportedType();
      return {
        isBurn: true,
        burnDuration: ensureDurationAllowed(normalizedBurnDuration),
      };
    }

    if (requestedIsBurn === false) {
      if (normalizedBurnDuration !== undefined) {
        throw new BadRequestException('burnDuration is only allowed when isBurn=true');
      }
      return { isBurn: false, burnDuration: null };
    }

    if (normalizedBurnDuration !== undefined) {
      throw new BadRequestException('burnDuration is only allowed when isBurn=true');
    }

    const conversation = await manager.findOne(Conversation, {
      where: { id: conversationId },
      select: ['id', 'defaultBurnEnabled', 'defaultBurnDuration'],
    });

    if (!conversation || !conversation.defaultBurnEnabled) {
      return { isBurn: false, burnDuration: null };
    }

    ensureSupportedType();
    return {
      isBurn: true,
      burnDuration: ensureDurationAllowed(conversation.defaultBurnDuration),
    };
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
    // 尝试从缓存获取
    const cacheKey = `conversation:${conversationId}:members`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn('Failed to get conversation members from cache:', error);
    }

    // 缓存未命中，从数据库查询
    const rows = await this.dataSource.query(
      `SELECT user_id::text AS user_id FROM conversation_members WHERE conversation_id = $1;`,
      [conversationId],
    );
    const members = (rows as Array<{ user_id?: string }>).map((row) => row.user_id ?? '').filter(Boolean);

    // 存入缓存，过期时间5分钟
    try {
      await this.redis.set(cacheKey, JSON.stringify(members), 'EX', 300);
    } catch (error) {
      this.logger.warn('Failed to set conversation members to cache:', error);
    }

    return members;
  }

  private async clearConversationMembersCache(conversationId: string): Promise<void> {
    const cacheKey = `conversation:${conversationId}:members`;
    try {
      await this.redis.del(cacheKey);
    } catch (error) {
      this.logger.warn('Failed to clear conversation members cache:', error);
    }
  }

  private async listConversationMemberUserIdsMap(conversationIds: string[]): Promise<Map<string, string[]>> {
    const membersMap = new Map<string, string[]>();
    if (conversationIds.length === 0) {
      return membersMap;
    }

    // 尝试从缓存获取
    const cachePromises = conversationIds.map(async (conversationId) => {
      const cacheKey = `conversation:${conversationId}:members`;
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          membersMap.set(conversationId, JSON.parse(cached));
          return true;
        }
      } catch (error) {
        this.logger.warn(`Failed to get conversation ${conversationId} members from cache:`, error);
      }
      return false;
    });

    const cacheResults = await Promise.all(cachePromises);
    const uncachedIds = conversationIds.filter((_, index) => !cacheResults[index]);

    if (uncachedIds.length > 0) {
      const rows = await this.dataSource.query(
        `
        SELECT conversation_id::text AS conversation_id, user_id::text AS user_id
        FROM conversation_members
        WHERE conversation_id = ANY($1::uuid[]);
        `,
        [uncachedIds],
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

        // 存入缓存
        try {
          const cacheKey = `conversation:${conversationId}:members`;
          await this.redis.set(cacheKey, JSON.stringify(current), 'EX', 300);
        } catch (error) {
          this.logger.warn(`Failed to set conversation ${conversationId} members to cache:`, error);
        }
      }
    }

    return membersMap;
  }

  private async deleteExpiredBurnMessages(conversationId?: string): Promise<ExpiredBurnRow[]> {
    const params: unknown[] = [];
    const conversationFilter = conversationId ? 'AND m.conversation_id = $1' : '';
    if (conversationId) {
      params.push(conversationId);
    }

    // First, fetch expired messages with their media asset IDs for cleanup
    const expiredMessages = await this.dataSource.query(
      `
      SELECT m.id::text AS id, m.conversation_id::text AS conversation_id, m.media_asset_id::text AS media_asset_id
      FROM messages m
      WHERE m.is_burn = true
        AND (
          (
            m.read_at IS NOT NULL
            AND m.burn_duration IS NOT NULL
            AND m.read_at + (m.burn_duration || ' seconds')::interval <= CURRENT_TIMESTAMP
          )
          OR (
            m.read_at IS NULL
            AND m.created_at <= CURRENT_TIMESTAMP - interval '24 hours'
          )
        )
        ${conversationFilter}
      FOR UPDATE SKIP LOCKED;
      `,
      params,
    );

    if (expiredMessages.length === 0) {
      return [];
    }

    // Delete associated media files
    const mediaAssetIds = expiredMessages
      .map((row: { media_asset_id?: string }) => row.media_asset_id)
      .filter(Boolean);
    if (mediaAssetIds.length > 0) {
      await this.cleanupMediaAssets(mediaAssetIds as string[]);
    }

    // Delete messages
    const messageIds = expiredMessages.map((row: { id?: string }) => row.id).filter(Boolean);
    if (messageIds.length > 0) {
      await this.dataSource.query(
        `DELETE FROM messages WHERE id = ANY($1::uuid[]);`,
        [messageIds],
      );
    }

    return (expiredMessages as ExpiredBurnRowRaw[])
      .map((row) => ({
        id: row.id,
        conversationId: row.conversation_id ?? row.conversationId ?? row.conversationid ?? '',
      }))
      .filter((row) => row.id && row.conversationId);
  }

  private async cleanupMediaAssets(mediaAssetIds: string[]): Promise<void> {
    if (mediaAssetIds.length === 0) {
      return;
    }

    // Fetch media assets to get storage paths
    const mediaAssets = await this.mediaAssetRepository
      .createQueryBuilder()
      .where('id = ANY(:ids)', { ids: mediaAssetIds })
      .getMany();

    const uniquePaths = [...new Set(mediaAssets.map((asset) => asset.storagePath).filter(Boolean))];
    const referencedPaths = new Set<string>();

    if (uniquePaths.length > 0) {
      const rows = await this.dataSource.query(
        `
        SELECT storage_path::text AS storage_path
        FROM media_assets
        WHERE storage_path = ANY($1::text[])
          AND id <> ALL($2::uuid[])
        GROUP BY storage_path;
        `,
        [uniquePaths, mediaAssetIds],
      );
      for (const row of rows as Array<{ storage_path?: string }>) {
        if (row.storage_path) {
          referencedPaths.add(row.storage_path);
        }
      }
    }

    // Delete files from storage only when no other records reference the same path.
    for (const storagePath of uniquePaths) {
      if (referencedPaths.has(storagePath)) {
        continue;
      }
      try {
        await unlink(storagePath);
      } catch {
        // File may already be deleted, continue
      }
    }

    // Delete media asset records
    await this.mediaAssetRepository.delete(mediaAssetIds);
  }

  private async assertAndBindMediaAsset(
    manager: EntityManager,
    senderId: string,
    conversationId: string,
    messageType: number,
    mediaAssetId: string,
  ): Promise<string> {
    const asset = await manager.findOne(MediaAsset, {
      where: { id: mediaAssetId },
    });
    if (!asset) {
      throw new BadRequestException('mediaAsset not found');
    }

    if (asset.uploaderId !== senderId) {
      throw new BadRequestException('mediaAsset uploader mismatch');
    }

    if (asset.mediaKind !== messageType) {
      throw new BadRequestException('mediaAsset type mismatch');
    }

    if (asset.conversationId && asset.conversationId !== conversationId) {
      throw new BadRequestException('mediaAsset already bound to another conversation');
    }

    if (!asset.conversationId) {
      asset.conversationId = conversationId;
      await manager.save(MediaAsset, asset);
    }

    return asset.id;
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
      // 异步处理WebSocket事件，避免阻塞主流程
      void this.handleDeliveredEvent(dto.conversationId, maxIndex, userId, deliveredCount);
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
      .andWhere('NOT (is_burn = true AND message_type IN (2, 3))')
      .andWhere('read_at IS NULL')
      .execute();

    const readCount = result.affected ?? 0;
    if (readCount > 0) {
      // 异步处理WebSocket事件，避免阻塞主流程
      void this.handleReadEvent(dto.conversationId, maxIndex, userId, readCount);
    }
    return { readCount };
  }

  private async handleDeliveredEvent(conversationId: string, maxIndex: string, userId: string, deliveredCount: number): Promise<void> {
    try {
      this.messageGateway.emitMessageDelivered(conversationId, {
        maxMessageIndex: maxIndex,
        ackByUserId: userId,
        deliveredCount,
        ackAt: new Date().toISOString(),
      });
      const memberUserIds = await this.listConversationMemberUserIds(conversationId);
      this.messageGateway.emitConversationUpdated(memberUserIds, {
        conversationId: conversationId,
        reason: 'message.delivered',
      });
    } catch (error) {
      this.logger.warn('Failed to handle delivered event:', error);
    }
  }

  private async handleReadEvent(conversationId: string, maxIndex: string, userId: string, readCount: number): Promise<void> {
    try {
      this.messageGateway.emitMessageRead(conversationId, {
        maxMessageIndex: maxIndex,
        ackByUserId: userId,
        readCount,
        ackAt: new Date().toISOString(),
      });
      const memberUserIds = await this.listConversationMemberUserIds(conversationId);
      this.messageGateway.emitConversationUpdated(memberUserIds, {
        conversationId: conversationId,
        reason: 'message.read',
      });
    } catch (error) {
      this.logger.warn('Failed to handle read event:', error);
    }
  }

  async ackReadOne(userId: string, dto: AckReadOneDto): Promise<{ readCount: number }> {
    const message = await this.messageRepository.findOne({
      where: { id: dto.messageId },
      select: ['id', 'conversationId', 'senderId', 'messageIndex', 'readAt'],
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.conversationService.assertMember(message.conversationId, userId);

    if (message.senderId === userId || message.readAt) {
      return { readCount: 0 };
    }

    const result = await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({
        readAt: () => 'CURRENT_TIMESTAMP',
        deliveredAt: () => 'COALESCE(delivered_at, CURRENT_TIMESTAMP)',
      })
      .where('id = :messageId', { messageId: dto.messageId })
      .andWhere('read_at IS NULL')
      .execute();

    const readCount = result.affected ?? 0;
    if (readCount > 0) {
      // 异步处理WebSocket事件，避免阻塞主流程
      void this.handleReadOneEvent(message, userId);
    }

    return { readCount };
  }

  async revokeMessage(userId: string, dto: AckRevokeDto): Promise<{ revokedCount: number }> {
    const message = await this.messageRepository.findOne({
      where: { id: dto.messageId },
      select: ['id', 'conversationId', 'senderId', 'messageIndex', 'isRevoked', 'createdAt'],
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.conversationService.assertMember(message.conversationId, userId);

    if (message.senderId !== userId) {
      throw new BadRequestException('Only message sender can revoke message');
    }

    if (message.isRevoked) {
      return { revokedCount: 0 };
    }

    // 5-minute revoke time limit
    const createdAt = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
    const fiveMinutesLater = new Date(createdAt.getTime() + 5 * 60 * 1000);
    if (Date.now() > fiveMinutesLater.getTime()) {
      throw new BadRequestException('Revoke time limit exceeded (5 minutes)');
    }

    const result = await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({
        isRevoked: true,
        revokedAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :messageId', { messageId: dto.messageId })
      .andWhere('is_revoked = false')
      .execute();

    const revokedCount = result.affected ?? 0;
    if (revokedCount > 0) {
      // Log revoke event
      try {
        await this.revokeEventRepository.save(
          this.revokeEventRepository.create({
            messageId: message.id,
            conversationId: message.conversationId,
            revokedBy: userId,
          }),
        );
      } catch {
        // Ignore duplicate key errors (concurrent revoke requests)
      }
      // 异步处理WebSocket事件，避免阻塞主流程
      void this.handleRevokeEvent(message, userId);
    }

    return { revokedCount };
  }

  private async handleReadOneEvent(message: Message, userId: string): Promise<void> {
    try {
      this.messageGateway.emitMessageRead(message.conversationId, {
        maxMessageIndex: String(message.messageIndex),
        ackByUserId: userId,
        readCount: 1,
        ackAt: new Date().toISOString(),
      });
      const memberUserIds = await this.listConversationMemberUserIds(message.conversationId);
      this.messageGateway.emitConversationUpdated(memberUserIds, {
        conversationId: message.conversationId,
        reason: 'message.read',
      });
    } catch (error) {
      this.logger.warn('Failed to handle read one event:', error);
    }
  }

  private async handleRevokeEvent(message: Message, userId: string): Promise<void> {
    try {
      this.messageGateway.emitMessageRevoked(message.conversationId, {
        messageId: message.id,
        messageIndex: String(message.messageIndex),
        revokedByUserId: userId,
        revokedAt: new Date().toISOString(),
      });
      const memberUserIds = await this.listConversationMemberUserIds(message.conversationId);
      this.messageGateway.emitConversationUpdated(memberUserIds, {
        conversationId: message.conversationId,
        reason: 'message.revoked',
      });
    } catch (error) {
      this.logger.warn('Failed to handle revoke event:', error);
    }
  }

  async forwardMessage(userId: string, dto: ForwardMessageDto): Promise<{ messageId: string; messageIndex: string }> {
    await this.conversationService.assertMember(dto.conversationId, userId);
    const targetConversation = await this.conversationService.findById(dto.conversationId);
    if (!targetConversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (targetConversation.type !== 1) {
      throw new BadRequestException('服务端转发仅支持单聊会话');
    }

    const originalMessage = await this.messageRepository.findOne({
      where: { id: dto.originalMessageId },
      select: ['id', 'messageType', 'encryptedPayload', 'mediaAssetId', 'isBurn', 'burnDuration'],
    });
    if (!originalMessage) {
      throw new NotFoundException('Original message not found');
    }

    // v2 消息（encryptedPayload 为 null）不能通过服务端转发，因为需要重新加密
    // 客户端必须：下载原始消息 -> 解密 -> 重新加密 -> 通过 send-v2 发送
    if (originalMessage.encryptedPayload === null) {
      throw new BadRequestException(
        'v2 消息不支持服务端转发，请在客户端重新加密后发送',
      );
    }

    const sent = await this.dataSource.transaction(async (manager) => {
      const burnSettings = await this.resolveBurnSettings(
        manager,
        dto.conversationId,
        originalMessage.messageType,
        dto.isBurn,
        dto.burnDuration,
      );

      const mediaAssetId = originalMessage.mediaAssetId
        ? await this.cloneMediaAssetForForward(
            manager,
            userId,
            dto.conversationId,
            originalMessage.messageType,
            originalMessage.mediaAssetId,
          )
        : null;

      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1));',
        [dto.conversationId],
      );

      const result = await manager.query(
        'SELECT COALESCE(MAX(message_index), 0) + 1 AS next_index FROM messages WHERE conversation_id = $1;',
        [dto.conversationId],
      );

      const nextIndex = String(result[0].next_index);

      const message = manager.create(Message, {
        conversationId: dto.conversationId,
        senderId: userId,
        messageType: originalMessage.messageType,
        encryptedPayload: originalMessage.encryptedPayload,
        nonce: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mediaAssetId,
        messageIndex: nextIndex,
        isBurn: burnSettings.isBurn,
        burnDuration: burnSettings.burnDuration,
        isForwarded: true,
        originalMessageId: originalMessage.id,
      });

      const saved = await manager.save(Message, message);
      return {
        conversationId: dto.conversationId,
        messageId: saved.id,
        messageIndex: nextIndex,
        senderId: userId,
        createdAt: saved.createdAt.toISOString(),
      };
    });

    // 异步处理WebSocket事件，避免阻塞主流程
    void this.handleMessageSentEvent(sent, userId);

    return { messageId: sent.messageId, messageIndex: sent.messageIndex };
  }

  async saveDraft(userId: string, dto: SaveDraftDto): Promise<{ draftId: string }> {
    await this.conversationService.assertMember(dto.conversationId, userId);
    this.assertMediaPayloadShape(dto.messageType, dto.mediaAssetId);

    const existingDraft = await this.draftRepository.findOne({
      where: { userId, conversationId: dto.conversationId },
    });

    if (existingDraft) {
      await this.draftRepository.update(existingDraft.id, {
        messageType: dto.messageType,
        encryptedPayload: dto.encryptedPayload,
        nonce: dto.nonce,
        mediaAssetId: dto.mediaAssetId || null,
        isBurn: dto.isBurn || false,
        burnDuration: dto.burnDuration || null,
      });
      return { draftId: existingDraft.id };
    } else {
      const draft = this.draftRepository.create({
        userId,
        conversationId: dto.conversationId,
        messageType: dto.messageType,
        encryptedPayload: dto.encryptedPayload,
        nonce: dto.nonce,
        mediaAssetId: dto.mediaAssetId || null,
        isBurn: dto.isBurn || false,
        burnDuration: dto.burnDuration || null,
      });
      const saved = await this.draftRepository.save(draft);
      return { draftId: saved.id };
    }
  }

  async getDraft(userId: string, dto: GetDraftDto): Promise<DraftMessage | null> {
    await this.conversationService.assertMember(dto.conversationId, userId);

    return this.draftRepository.findOne({
      where: { userId, conversationId: dto.conversationId },
    });
  }

  async deleteDraft(userId: string, dto: DeleteDraftDto): Promise<{ deleted: boolean }> {
    await this.conversationService.assertMember(dto.conversationId, userId);

    const result = await this.draftRepository.delete({
      userId,
      conversationId: dto.conversationId,
    });

    return { deleted: (result.affected || 0) > 0 };
  }

  async listDrafts(userId: string): Promise<DraftMessage[]> {
    return this.draftRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async searchMessages(userId: string, dto: SearchMessagesDto): Promise<Array<{
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
    const limit = Math.min(dto.limit ?? 50, 100);
    const offset = dto.offset ?? 0;

    let query = this.messageRepository
      .createQueryBuilder('m')
      .leftJoin('conversation_members', 'cm', 'cm.conversation_id = m.conversation_id')
      .where('cm.user_id = :userId', { userId });

    if (dto.conversationId) {
      await this.conversationService.assertMember(dto.conversationId, userId);
      query = query.andWhere('m.conversation_id = :conversationId', { conversationId: dto.conversationId });
    }

    if (dto.startDate) {
      query = query.andWhere('m.created_at >= :startDate', { startDate: dto.startDate });
    }

    if (dto.endDate) {
      query = query.andWhere('m.created_at <= :endDate', { endDate: dto.endDate });
    }

    // 内容是端到端加密，服务端仅支持元数据检索。
    const keyword = dto.keyword.trim();
    if (keyword) {
      const likeKeyword = `%${keyword}%`;
      query = query.andWhere(
        `
          CAST(m.message_index AS TEXT) ILIKE :likeKeyword
          OR CAST(m.message_type AS TEXT) ILIKE :likeKeyword
          OR CAST(m.sender_id AS TEXT) ILIKE :likeKeyword
        `,
        { likeKeyword },
      );
    }

    const messages = await query
      .select([
        'm.id as messageId',
        'm.conversation_id as conversationId',
        'm.sender_id as senderId',
        'm.message_type as messageType',
        'm.message_index as messageIndex',
        'm.is_burn as isBurn',
        'm.burn_duration as burnDuration',
        'm.is_revoked as isRevoked',
        'm.delivered_at as deliveredAt',
        'm.read_at as readAt',
        'm.created_at as createdAt',
      ])
      .orderBy('m.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getRawMany<MessageSearchRow>();

    const toIso = (value: Date | string | null | undefined): string | null => {
      if (!value) {
        return null;
      }
      const parsed = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return parsed.toISOString();
    };

    return messages.map(message => ({
      messageId: message.messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      messageType: message.messageType,
      messageIndex: message.messageIndex,
      isBurn: message.isBurn,
      burnDuration: message.burnDuration,
      isRevoked: message.isRevoked,
      deliveredAt: toIso(message.deliveredAt ?? message.deliveredat),
      readAt: toIso(message.readAt ?? message.readat),
      createdAt: toIso(message.createdAt ?? message.createdat) ?? new Date(0).toISOString(),
    }));
  }

  private async cloneMediaAssetForForward(
    manager: EntityManager,
    userId: string,
    conversationId: string,
    messageType: number,
    originalMediaAssetId: string,
  ): Promise<string> {
    const sourceAsset = await manager.findOne(MediaAsset, { where: { id: originalMediaAssetId } });
    if (!sourceAsset) {
      throw new BadRequestException('mediaAsset not found');
    }
    if (sourceAsset.mediaKind !== messageType) {
      throw new BadRequestException('mediaAsset type mismatch');
    }

    if (sourceAsset.conversationId) {
      await this.conversationService.assertMember(sourceAsset.conversationId, userId);
    } else if (sourceAsset.uploaderId !== userId) {
      throw new BadRequestException('mediaAsset uploader mismatch');
    }

    const cloned = manager.create(MediaAsset, {
      uploaderId: userId,
      conversationId,
      mediaKind: sourceAsset.mediaKind,
      originalName: sourceAsset.originalName,
      mimeType: sourceAsset.mimeType,
      fileSize: sourceAsset.fileSize,
      storagePath: sourceAsset.storagePath,
      sha256: sourceAsset.sha256,
    });
    const saved = await manager.save(MediaAsset, cloned);
    return saved.id;
  }
}
