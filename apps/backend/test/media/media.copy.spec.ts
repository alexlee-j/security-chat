import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { MediaAsset } from '../../src/modules/media/entities/media-asset.entity';
import { MediaService } from '../../src/modules/media/media.service';

type TxManager = {
  query: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

describe('MediaService.copyForConversation', () => {
  let mediaAssetRepository: jest.Mocked<Repository<MediaAsset>>;
  let configService: jest.Mocked<ConfigService>;
  let conversationService: jest.Mocked<ConversationService>;
  let service: MediaService;

  const userId = '22222222-2222-4222-8222-222222222222';
  const sourceConversationId = '11111111-1111-4111-8111-111111111111';
  const targetConversationId = '33333333-3333-4333-8333-333333333333';
  const mediaAssetId = '44444444-4444-4444-8444-444444444444';

  const sourceAsset: MediaAsset = {
    id: mediaAssetId,
    uploaderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    conversationId: sourceConversationId,
    mediaKind: 2,
    originalName: 'photo.png',
    mimeType: 'image/png',
    fileSize: '12345',
    storagePath: '/tmp/security-chat-media/shared.png',
    sha256: 'b'.repeat(64),
    createdAt: new Date('2026-04-17T00:00:00.000Z'),
  };

  const buildTxManager = (overrides: { existing?: MediaAsset | null } = {}): TxManager => {
    const query = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue(overrides.existing ?? null);
    const create = jest.fn((_entity: unknown, payload: object) => ({ ...payload }));
    const save = jest.fn(async (_entity: unknown, payload: MediaAsset) => ({
      ...payload,
      id: payload.id || '55555555-5555-4555-8555-555555555555',
      createdAt: payload.createdAt || new Date('2026-04-17T00:10:00.000Z'),
    }));
    return { query, findOne, create, save };
  };

  beforeEach(() => {
    mediaAssetRepository = {
      findOne: jest.fn().mockResolvedValue(sourceAsset),
      create: jest.fn((_payload: object) => ({})),
      save: jest.fn(),
      manager: {
        transaction: jest.fn(),
      } as any,
    } as unknown as jest.Mocked<Repository<MediaAsset>>;
    configService = {
      get: jest.fn((_key: string, fallback?: string) => fallback ?? ''),
    } as unknown as jest.Mocked<ConfigService>;
    conversationService = {
      assertMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ConversationService>;

    service = new MediaService(mediaAssetRepository, configService, conversationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns existing copied asset for idempotent retries', async () => {
    const existingCopied: MediaAsset = {
      ...sourceAsset,
      id: '66666666-6666-4666-8666-666666666666',
      uploaderId: userId,
      conversationId: targetConversationId,
    };
    const tx = buildTxManager({ existing: existingCopied });
    (mediaAssetRepository.manager.transaction as jest.Mock).mockImplementation(
      async (callback: (manager: TxManager) => Promise<MediaAsset>) => await callback(tx),
    );

    const result = await service.copyForConversation(userId, mediaAssetId, targetConversationId);

    expect(tx.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1));',
      [`media.copy:${mediaAssetId}:${targetConversationId}:${userId}`],
    );
    expect(tx.findOne).toHaveBeenCalled();
    expect(tx.save).not.toHaveBeenCalled();
    expect(result).toEqual({
      mediaAssetId: existingCopied.id,
      conversationId: targetConversationId,
    });
  });

  it('creates copied asset when no existing idempotent record exists', async () => {
    const tx = buildTxManager({ existing: null });
    (mediaAssetRepository.manager.transaction as jest.Mock).mockImplementation(
      async (callback: (manager: TxManager) => Promise<MediaAsset>) => await callback(tx),
    );

    const result = await service.copyForConversation(userId, mediaAssetId, targetConversationId);

    expect(tx.save).toHaveBeenCalled();
    expect(result.conversationId).toBe(targetConversationId);
  });

  it('rejects copy when user is neither uploader nor source conversation member', async () => {
    conversationService.assertMember.mockRejectedValue(new ForbiddenException('forbidden'));

    await expect(
      service.copyForConversation(userId, mediaAssetId, targetConversationId),
    ).rejects.toThrow(new ForbiddenException('Not allowed to copy this media asset'));
  });
});
