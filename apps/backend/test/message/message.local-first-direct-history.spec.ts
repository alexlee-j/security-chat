import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { MediaAsset } from '../../src/modules/media/entities/media-asset.entity';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { Message } from '../../src/modules/message/entities/message.entity';
import { MessageDeviceEnvelope } from '../../src/modules/message/entities/message-device-envelope.entity';
import { RevokeEvent } from '../../src/modules/message/entities/revoke-event.entity';
import { DraftMessage } from '../../src/modules/message/entities/draft-message.entity';
import { MessageGateway } from '../../src/modules/message/gateways/message.gateway';
import { MessageService } from '../../src/modules/message/message.service';

const conversationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const deviceId = '33333333-3333-4333-8333-333333333333';
const otherDeviceId = '44444444-4444-4444-8444-444444444444';
const messageId = '55555555-5555-4555-8555-555555555555';
const otherMessageId = '66666666-6666-4666-8666-666666666666';

describe('MessageService local-first direct history pending envelopes', () => {
  let dataSource: jest.Mocked<DataSource>;
  let conversationService: jest.Mocked<ConversationService>;
  let service: MessageService;

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;
    conversationService = {
      assertMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConversationService>;

    service = new MessageService(
      {} as Repository<Message>,
      {} as Repository<MessageDeviceEnvelope>,
      {} as Repository<DraftMessage>,
      {} as Repository<RevokeEvent>,
      {} as Repository<MediaAsset>,
      dataSource,
      conversationService,
      {} as MessageGateway,
      {} as NotificationService,
      {} as Redis,
    );
    jest.spyOn(service as any, 'cleanupExpiredBurnMessages').mockResolvedValue(undefined);
  });

  it('lists only pending direct envelopes for the authenticated device', async () => {
    dataSource.query.mockResolvedValue([
      {
        message_id: messageId,
        conversation_id: conversationId,
        sender_id: userId,
        source_device_id: otherDeviceId,
        source_signal_device_id: 11,
        message_type: 1,
        encrypted_payload: 'cipher-for-this-device',
        nonce: 'nonce-1',
        media_asset_id: null,
        message_index: '7',
        is_burn: false,
        burn_duration: null,
        delivered_at: null,
        read_at: null,
        created_at: new Date('2026-04-28T00:00:00.000Z'),
      },
    ]);

    const result = await (service as any).queryPendingDirectEnvelopes(userId, deviceId, {
      conversationId,
      afterIndex: 3,
      limit: 20,
    });

    expect(conversationService.assertMember).toHaveBeenCalledWith(conversationId, userId);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('target_device_id'),
      expect.arrayContaining([conversationId, deviceId, '3', 20]),
    );
    expect(result).toEqual([
      {
        messageId,
        conversationId,
        senderId: userId,
        sourceDeviceId: otherDeviceId,
        sourceSignalDeviceId: 11,
        messageType: 1,
        encryptedPayload: 'cipher-for-this-device',
        nonce: 'nonce-1',
        mediaAssetId: null,
        messageIndex: '7',
        isBurn: false,
        burnDuration: null,
        deliveredAt: null,
        readAt: null,
        createdAt: '2026-04-28T00:00:00.000Z',
      },
    ]);
  });

  it('rejects pending direct envelope listing without authenticated device context', async () => {
    await expect(
      (service as any).queryPendingDirectEnvelopes(userId, undefined, {
        conversationId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('acknowledges persisted direct envelopes only for the authenticated device', async () => {
    dataSource.query.mockResolvedValue([{ message_id: messageId }]);

    const result = await (service as any).ackDirectEnvelopesPersisted(userId, deviceId, {
      conversationId,
      messageIds: [messageId, otherMessageId],
      maxMessageIndex: 9,
    });

    expect(conversationService.assertMember).toHaveBeenCalledWith(conversationId, userId);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM message_device_envelopes'),
      [deviceId, [messageId, otherMessageId], conversationId],
    );
    expect(result).toEqual({ acknowledgedCount: 1 });
  });

  it('treats duplicate persisted direct envelope acknowledgements as successful', async () => {
    dataSource.query.mockResolvedValue([]);

    const result = await (service as any).ackDirectEnvelopesPersisted(userId, deviceId, {
      conversationId,
      messageIds: [messageId],
    });

    expect(result).toEqual({ acknowledgedCount: 0 });
  });

  it('rejects direct conversation historical message listing after local-first delivery is enabled', async () => {
    conversationService.findById = jest.fn().mockResolvedValue({
      id: conversationId,
      type: 1,
    });

    await expect(
      service.queryMessages(userId, {
        conversationId,
        afterIndex: 0,
        limit: 50,
      }, deviceId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps group conversation historical message listing unchanged', async () => {
    const message = {
      id: messageId,
      conversationId,
      senderId: userId,
      sourceDeviceId: otherDeviceId,
      messageType: 1,
      encryptedPayload: 'group-ciphertext',
      nonce: 'nonce-1',
      mediaAssetId: null,
      messageIndex: '3',
      isBurn: false,
      burnDuration: null,
      isRevoked: false,
      revokedAt: null,
      isForwarded: false,
      originalMessageId: null,
      deliveredAt: null,
      readAt: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
    } as Message;
    const getMany = jest.fn().mockResolvedValue([message]);
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany,
    };
    (service as any).messageRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    conversationService.findById = jest.fn().mockResolvedValue({
      id: conversationId,
      type: 2,
    });

    await expect(
      service.queryMessages(userId, {
        conversationId,
        afterIndex: 0,
        limit: 50,
      }, deviceId),
    ).resolves.toEqual([message]);
  });
});
