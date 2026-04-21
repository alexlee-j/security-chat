import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { BurnEvent } from '../../src/modules/burn/entities/burn-event.entity';
import { BurnService } from '../../src/modules/burn/burn.service';
import { MediaAsset } from '../../src/modules/media/entities/media-asset.entity';
import { Message } from '../../src/modules/message/entities/message.entity';
import { MessageGateway } from '../../src/modules/message/gateways/message.gateway';

describe('BurnService encrypted media cleanup', () => {
  const messageId = '11111111-1111-4111-8111-111111111111';
  const conversationId = '22222222-2222-4222-8222-222222222222';
  const senderId = '33333333-3333-4333-8333-333333333333';
  const recipientId = '44444444-4444-4444-8444-444444444444';
  const mediaAssetId = '55555555-5555-4555-8555-555555555555';

  let burnEventRepository: jest.Mocked<Repository<BurnEvent>>;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let mediaAssetRepository: jest.Mocked<Repository<MediaAsset>>;
  let conversationService: jest.Mocked<ConversationService>;
  let messageGateway: jest.Mocked<MessageGateway>;
  let service: BurnService;

  beforeEach(() => {
    burnEventRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload: object) => ({
        ...payload,
        triggeredAt: new Date('2026-04-17T00:00:00.000Z'),
      })),
      save: jest.fn(async (payload: any) => payload),
    } as unknown as jest.Mocked<Repository<BurnEvent>>;

    messageRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: messageId,
        conversationId,
        senderId,
        mediaAssetId,
        isBurn: true,
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<Repository<Message>>;

    mediaAssetRepository = {
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<Repository<MediaAsset>>;

    conversationService = {
      assertMember: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({ id: conversationId, type: 1 }),
    } as unknown as jest.Mocked<ConversationService>;

    messageGateway = {
      emitBurnTriggered: jest.fn(),
      emitConversationUpdated: jest.fn(),
    } as unknown as jest.Mocked<MessageGateway>;

    service = new BurnService(
      burnEventRepository,
      messageRepository,
      mediaAssetRepository,
      {
        query: jest.fn().mockResolvedValue([{ user_id: senderId }, { user_id: recipientId }]),
      } as any,
      conversationService,
      messageGateway,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes encrypted media ciphertext by asset id without plaintext key material', async () => {
    const dir = join('/tmp', 'security-chat-burn-media-test');
    await mkdir(dir, { recursive: true });
    const storagePath = join(dir, `${mediaAssetId}.bin`);
    await writeFile(storagePath, Buffer.from('ciphertext-only'));
    mediaAssetRepository.findOne.mockResolvedValue({
      id: mediaAssetId,
      uploaderId: senderId,
      conversationId,
      mediaKind: 2,
      originalName: 'encrypted-media.bin',
      mimeType: 'application/octet-stream',
      fileSize: '15',
      storagePath,
      sha256: 'a'.repeat(64),
      encryptionVersion: 1,
      createdAt: new Date('2026-04-17T00:00:00.000Z'),
    });

    const result = await service.triggerBurn(recipientId, messageId);

    expect(result).toMatchObject({ burned: true, messageId });
    expect(mediaAssetRepository.findOne).toHaveBeenCalledWith({ where: { id: mediaAssetId } });
    expect(mediaAssetRepository.delete).toHaveBeenCalledWith({ id: mediaAssetId });
    expect(messageRepository.delete).toHaveBeenCalledWith({ id: messageId });
    expect(messageGateway.emitBurnTriggered).toHaveBeenCalledWith(
      conversationId,
      messageId,
      '2026-04-17T00:00:00.000Z',
    );
  });
});
