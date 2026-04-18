import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Redis from 'ioredis';
import { RequestUser } from '../../src/common/decorators/current-user.decorator';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { Conversation } from '../../src/modules/conversation/entities/conversation.entity';
import { MediaAsset } from '../../src/modules/media/entities/media-asset.entity';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { SendMessageV2Dto } from '../../src/modules/message/dto/send-message-v2.dto';
import { Message } from '../../src/modules/message/entities/message.entity';
import { MessageDeviceEnvelope } from '../../src/modules/message/entities/message-device-envelope.entity';
import { RevokeEvent } from '../../src/modules/message/entities/revoke-event.entity';
import { DraftMessage } from '../../src/modules/message/entities/draft-message.entity';
import { MessageGateway } from '../../src/modules/message/gateways/message.gateway';
import { MessageService } from '../../src/modules/message/message.service';

const conversationId = '11111111-1111-4111-8111-111111111111';
const senderId = '22222222-2222-4222-8222-222222222222';
const senderDeviceId = '33333333-3333-4333-8333-333333333333';
const recipientUserId = '44444444-4444-4444-8444-444444444444';
const recipientMacId = '55555555-5555-4555-8555-555555555555';
const recipientWinId = '66666666-6666-4666-8666-666666666666';
const createdAt = new Date('2026-04-16T00:00:00.000Z');

type MockManager = {
  create: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  query: jest.Mock;
  save: jest.Mock;
};

describe('MessageService sendMessageV2', () => {
  let messageRepository: jest.Mocked<Repository<Message>>;
  let messageEnvelopeRepository: jest.Mocked<Repository<MessageDeviceEnvelope>>;
  let draftRepository: jest.Mocked<Repository<DraftMessage>>;
  let revokeEventRepository: jest.Mocked<Repository<RevokeEvent>>;
  let mediaAssetRepository: jest.Mocked<Repository<MediaAsset>>;
  let dataSource: jest.Mocked<DataSource>;
  let conversationService: jest.Mocked<ConversationService>;
  let messageGateway: jest.Mocked<MessageGateway>;
  let notificationService: jest.Mocked<NotificationService>;
  let redis: jest.Mocked<Redis>;
  let service: MessageService;

  const user: RequestUser = {
    userId: senderId,
    jti: 'jti-1',
    tokenType: 'access',
    deviceId: senderDeviceId,
    iat: 1,
    exp: 2,
  };

  const dto: SendMessageV2Dto = {
    conversationId,
    messageType: 1,
    nonce: 'nonce-1',
    envelopes: [
      {
        targetUserId: recipientUserId,
        targetDeviceId: recipientMacId,
        encryptedPayload: 'ciphertext-mac',
      },
      {
        targetUserId: recipientUserId,
        targetDeviceId: recipientWinId,
        encryptedPayload: 'ciphertext-win',
      },
    ],
    isBurn: false,
  };

  const buildManager = (overrides: {
    conversationType?: number;
    existingMessage?: Message | null;
    existingEnvelopes?: MessageDeviceEnvelope[];
    ownDeviceRows?: Array<{ id: string }>;
    memberRows?: Array<{ user_id: string }>;
    targetDeviceRows?: Array<{ device_id: string; user_id: string }>;
  } = {}): MockManager => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT id FROM devices WHERE id = $1 AND user_id = $2 LIMIT 1;')) {
        return overrides.ownDeviceRows ?? [{ id: senderDeviceId }];
      }
      if (sql.includes('cm.user_id <> $2')) {
        return (overrides.targetDeviceRows ?? [
          { device_id: recipientMacId, user_id: recipientUserId },
          { device_id: recipientWinId, user_id: recipientUserId },
        ]).filter((row) => row.user_id !== senderId);
      }
      if (sql.includes('SELECT user_id::text AS user_id FROM conversation_members')) {
        return overrides.memberRows ?? [{ user_id: senderId }, { user_id: recipientUserId }];
      }
      if (sql.includes('SELECT d.id::text AS device_id, d.user_id::text AS user_id')) {
        return overrides.targetDeviceRows ?? [
          { device_id: recipientMacId, user_id: recipientUserId },
          { device_id: recipientWinId, user_id: recipientUserId },
        ];
      }
      if (sql.includes('SELECT pg_advisory_xact_lock')) {
        return [];
      }
      if (sql.includes('SELECT COALESCE(MAX(message_index), 0) + 1 AS next_index')) {
        return [{ next_index: 1 }];
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    const findOne = jest.fn(async (entity: unknown) => {
      if (entity === Conversation) {
        return {
          id: conversationId,
          type: overrides.conversationType ?? 1,
        } as Conversation;
      }
      if (entity === Message) {
        return overrides.existingMessage ?? null;
      }
      return null;
    });

    const find = jest.fn(async (entity: unknown) => {
      if (entity === MessageDeviceEnvelope) {
        return overrides.existingEnvelopes ?? [];
      }
      return [];
    });

    const create = jest.fn((_entity: unknown, payload: object) => ({ ...payload }));

    const save = jest.fn(async (entity: unknown, payload: any) => {
      if (entity === Message) {
        return {
          id: '77777777-7777-4777-8777-777777777777',
          createdAt,
          ...payload,
        };
      }
      if (entity === MessageDeviceEnvelope) {
        return payload;
      }
      if (entity === MediaAsset) {
        return payload;
      }
      throw new Error(`Unexpected save entity: ${String(entity)}`);
    });

    return { create, find, findOne, query, save };
  };

  beforeEach(() => {
    messageRepository = {} as jest.Mocked<Repository<Message>>;
    messageEnvelopeRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Repository<MessageDeviceEnvelope>>;
    draftRepository = {} as jest.Mocked<Repository<DraftMessage>>;
    revokeEventRepository = {} as jest.Mocked<Repository<RevokeEvent>>;
    mediaAssetRepository = {} as jest.Mocked<Repository<MediaAsset>>;
    dataSource = {
      transaction: jest.fn(),
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;
    conversationService = {
      assertMember: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ id: conversationId, type: 1 } as Conversation),
    } as unknown as jest.Mocked<ConversationService>;
    messageGateway = {} as jest.Mocked<MessageGateway>;
    notificationService = {} as jest.Mocked<NotificationService>;
    redis = {} as jest.Mocked<Redis>;

    service = new MessageService(
      messageRepository,
      messageEnvelopeRepository,
      draftRepository,
      revokeEventRepository,
      mediaAssetRepository,
      dataSource,
      conversationService,
      messageGateway,
      notificationService,
      redis,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists one logical message and one envelope row per target device using auth device context', async () => {
    const manager = buildManager();
    dataSource.transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args.at(-1) as (em: EntityManager) => Promise<unknown>;
      return callback(manager as unknown as EntityManager);
    });
    const eventSpy = jest
      .spyOn<any, any>(service as any, 'handleMessageSentEvent')
      .mockResolvedValue(undefined);

    const result = await service.sendMessageV2(user, dto);

    expect(result).toEqual({
      messageId: '77777777-7777-4777-8777-777777777777',
      messageIndex: '1',
    });
    expect(conversationService.assertMember).toHaveBeenCalledWith(conversationId, senderId);
    expect(manager.save).toHaveBeenNthCalledWith(
      1,
      Message,
      expect.objectContaining({
        conversationId,
        senderId,
        sourceDeviceId: senderDeviceId,
        encryptedPayload: null,
        nonce: dto.nonce,
      }),
    );
    expect(manager.save).toHaveBeenNthCalledWith(
      2,
      MessageDeviceEnvelope,
      [
        expect.objectContaining({
          messageId: '77777777-7777-4777-8777-777777777777',
          targetUserId: recipientUserId,
          targetDeviceId: recipientMacId,
          sourceDeviceId: senderDeviceId,
          encryptedPayload: 'ciphertext-mac',
        }),
        expect.objectContaining({
          messageId: '77777777-7777-4777-8777-777777777777',
          targetUserId: recipientUserId,
          targetDeviceId: recipientWinId,
          sourceDeviceId: senderDeviceId,
          encryptedPayload: 'ciphertext-win',
        }),
      ],
    );
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        messageId: '77777777-7777-4777-8777-777777777777',
        messageIndex: '1',
        senderId,
      }),
      senderId,
    );
  });

  it('dedupes an identical nonce replay without saving duplicate rows or emitting events', async () => {
    const existingMessage = {
      id: '88888888-8888-4888-8888-888888888888',
      conversationId,
      senderId,
      sourceDeviceId: senderDeviceId,
      messageType: 1,
      encryptedPayload: null,
      nonce: dto.nonce,
      mediaAssetId: null,
      messageIndex: '9',
      isBurn: false,
      burnDuration: null,
      isRevoked: false,
      revokedAt: null,
      isForwarded: false,
      originalMessageId: null,
      deliveredAt: null,
      readAt: null,
      createdAt,
    } as Message;
    const manager = buildManager({
      existingMessage,
      existingEnvelopes: [
        {
          id: 'env-1',
          messageId: existingMessage.id,
          targetUserId: recipientUserId,
          targetDeviceId: recipientMacId,
          sourceDeviceId: senderDeviceId,
          encryptedPayload: 'ciphertext-mac',
          createdAt,
        },
        {
          id: 'env-2',
          messageId: existingMessage.id,
          targetUserId: recipientUserId,
          targetDeviceId: recipientWinId,
          sourceDeviceId: senderDeviceId,
          encryptedPayload: 'ciphertext-win',
          createdAt,
        },
      ],
    });
    dataSource.transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args.at(-1) as (em: EntityManager) => Promise<unknown>;
      return callback(manager as unknown as EntityManager);
    });
    const eventSpy = jest
      .spyOn<any, any>(service as any, 'handleMessageSentEvent')
      .mockResolvedValue(undefined);

    const result = await service.sendMessageV2(user, dto);

    expect(result).toEqual({
      messageId: existingMessage.id,
      messageIndex: '9',
    });
    expect(manager.save).not.toHaveBeenCalled();
    expect(eventSpy).not.toHaveBeenCalled();
  });

  it('fails fast when the authenticated deviceId is missing', async () => {
    await expect(
      service.sendMessageV2(
        {
          ...user,
          deviceId: undefined,
        },
        dto,
      ),
    ).rejects.toThrow(new BadRequestException('Authenticated deviceId is required for send-v2'));

    expect(conversationService.assertMember).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate target device envelopes before opening a transaction', async () => {
    await expect(
      service.sendMessageV2(user, {
        ...dto,
        envelopes: [
          dto.envelopes[0],
          { ...dto.envelopes[0] },
        ],
      }),
    ).rejects.toThrow(new BadRequestException('duplicate target device envelope'));

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects direct-chat envelopes that do not map to recipient member devices', async () => {
    const manager = buildManager({
      targetDeviceRows: [
        { device_id: recipientMacId, user_id: senderId },
      ],
    });
    dataSource.transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args.at(-1) as (em: EntityManager) => Promise<unknown>;
      return callback(manager as unknown as EntityManager);
    });

    await expect(
      service.sendMessageV2(user, {
        ...dto,
        envelopes: [dto.envelopes[0]],
      }),
    ).rejects.toThrow(new BadRequestException('envelope target must be a conversation member device'));

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('accepts direct-chat envelopes that include sender current device for self-sync', async () => {
    const manager = buildManager({
      targetDeviceRows: [
        { device_id: senderDeviceId, user_id: senderId },
        { device_id: recipientMacId, user_id: recipientUserId },
        { device_id: recipientWinId, user_id: recipientUserId },
      ],
    });
    dataSource.transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args.at(-1) as (em: EntityManager) => Promise<unknown>;
      return callback(manager as unknown as EntityManager);
    });

    const eventSpy = jest
      .spyOn<any, any>(service as any, 'handleMessageSentEvent')
      .mockResolvedValue(undefined);

    const result = await service.sendMessageV2(user, {
      ...dto,
      envelopes: [
        {
          targetUserId: senderId,
          targetDeviceId: senderDeviceId,
          encryptedPayload: 'ciphertext-self',
        },
        {
          targetUserId: recipientUserId,
          targetDeviceId: recipientMacId,
          encryptedPayload: 'ciphertext-recipient',
        },
        {
          targetUserId: recipientUserId,
          targetDeviceId: recipientWinId,
          encryptedPayload: 'ciphertext-recipient-win',
        },
      ],
    });

    expect(result.messageId).toBe('77777777-7777-4777-8777-777777777777');
    expect(manager.save).toHaveBeenNthCalledWith(
      1,
      Message,
      expect.objectContaining({
        encryptedPayload: null,
      }),
    );
    expect(eventSpy).toHaveBeenCalled();
  });
});

describe('MessageService forwardMessage', () => {
  let messageRepository: jest.Mocked<Repository<Message>>;
  let messageEnvelopeRepository: jest.Mocked<Repository<MessageDeviceEnvelope>>;
  let draftRepository: jest.Mocked<Repository<DraftMessage>>;
  let revokeEventRepository: jest.Mocked<Repository<RevokeEvent>>;
  let mediaAssetRepository: jest.Mocked<Repository<MediaAsset>>;
  let dataSource: jest.Mocked<DataSource>;
  let conversationService: jest.Mocked<ConversationService>;
  let messageGateway: jest.Mocked<MessageGateway>;
  let notificationService: jest.Mocked<NotificationService>;
  let redis: jest.Mocked<Redis>;
  let service: MessageService;

  const userId = '22222222-2222-4222-8222-222222222222';
  const originalMessageId = '77777777-7777-4777-8777-777777777777';

  const buildManager = (overrides: {
    originalMessage?: Message | null;
  } = {}): MockManager => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT pg_advisory_xact_lock')) {
        return [];
      }
      if (sql.includes('SELECT COALESCE(MAX(message_index), 0) + 1 AS next_index')) {
        return [{ next_index: 1 }];
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    const findOne = jest.fn(async (entity: unknown) => {
      if (entity === Message) {
        return overrides.originalMessage ?? null;
      }
      return null;
    });

    const create = jest.fn((_entity: unknown, payload: object) => ({ ...payload }));

    const save = jest.fn(async (entity: unknown, payload: any) => {
      if (entity === Message) {
        return {
          id: '99999999-9999-4999-8999-999999999999',
          createdAt,
          ...payload,
        };
      }
      return payload;
    });

    const find = jest.fn(async () => []);

    return { create, find, findOne, query, save };
  };

  beforeEach(() => {
    messageRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Message>>;
    messageEnvelopeRepository = {} as jest.Mocked<Repository<MessageDeviceEnvelope>>;
    draftRepository = {} as jest.Mocked<Repository<DraftMessage>>;
    revokeEventRepository = {} as jest.Mocked<Repository<RevokeEvent>>;
    mediaAssetRepository = {} as jest.Mocked<Repository<MediaAsset>>;
    dataSource = {
      transaction: jest.fn(),
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;
    conversationService = {
      assertMember: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ id: conversationId, type: 1 } as Conversation),
    } as unknown as jest.Mocked<ConversationService>;
    messageGateway = {} as jest.Mocked<MessageGateway>;
    notificationService = {} as jest.Mocked<NotificationService>;
    redis = {} as jest.Mocked<Redis>;

    service = new MessageService(
      messageRepository,
      messageEnvelopeRepository,
      draftRepository,
      revokeEventRepository,
      mediaAssetRepository,
      dataSource,
      conversationService,
      messageGateway,
      notificationService,
      redis,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects forwarding a v2 message (encryptedPayload is null)', async () => {
    const v2Message = {
      id: originalMessageId,
      conversationId,
      senderId: 'aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      messageType: 1,
      encryptedPayload: null, // v2 message
      mediaAssetId: null,
      isBurn: false,
      burnDuration: null,
    } as Message;

    const manager = buildManager({ originalMessage: v2Message });
    messageRepository.findOne.mockResolvedValue(v2Message);
    dataSource.transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args.at(-1) as (em: EntityManager) => Promise<unknown>;
      return callback(manager as unknown as EntityManager);
    });

    await expect(
      service.forwardMessage(userId, {
        conversationId,
        originalMessageId,
      }),
    ).rejects.toThrow(
      new BadRequestException('v2 消息不支持服务端转发，请在客户端重新加密后发送'),
    );

    expect(conversationService.assertMember).toHaveBeenCalledWith(conversationId, userId);
  });

  it('rejects server-forward for non-direct target conversations', async () => {
    const legacyMessage = {
      id: originalMessageId,
      conversationId,
      senderId: 'aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      messageType: 1,
      encryptedPayload: 'legacy-ciphertext',
      mediaAssetId: null,
      isBurn: false,
      burnDuration: null,
    } as Message;
    messageRepository.findOne.mockResolvedValue(legacyMessage);
    (conversationService.findById as jest.Mock).mockResolvedValue({ id: conversationId, type: 2 } as Conversation);

    await expect(
      service.forwardMessage(userId, {
        conversationId,
        originalMessageId,
      }),
    ).rejects.toThrow(new BadRequestException('服务端转发仅支持单聊会话'));

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('allows forwarding a legacy message (encryptedPayload is not null)', async () => {
    const legacyMessage = {
      id: originalMessageId,
      conversationId,
      senderId: 'aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      messageType: 1,
      encryptedPayload: 'legacy-ciphertext', // legacy message
      mediaAssetId: null,
      isBurn: false,
      burnDuration: null,
    } as Message;

    const manager = buildManager({ originalMessage: legacyMessage });
    messageRepository.findOne.mockResolvedValue(legacyMessage);
    dataSource.transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args.at(-1) as (em: EntityManager) => Promise<unknown>;
      return callback(manager as unknown as EntityManager);
    });

    const eventSpy = jest
      .spyOn<any, any>(service as any, 'handleMessageSentEvent')
      .mockResolvedValue(undefined);

    const result = await service.forwardMessage(userId, {
      conversationId,
      originalMessageId,
    });

    expect(result.messageId).toBe('99999999-9999-4999-8999-999999999999');
    expect(manager.save).toHaveBeenCalledWith(
      Message,
      expect.objectContaining({
        conversationId,
        senderId: userId,
        messageType: 1,
        encryptedPayload: 'legacy-ciphertext',
        isForwarded: true,
        originalMessageId,
      }),
    );
    expect(eventSpy).toHaveBeenCalled();
  });
});
