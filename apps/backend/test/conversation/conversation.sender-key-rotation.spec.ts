import { ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { Conversation } from '../../src/modules/conversation/entities/conversation.entity';
import { ConversationMember } from '../../src/modules/conversation/entities/conversation-member.entity';
import { User } from '../../src/modules/user/entities/user.entity';
import { SenderKey } from '../../src/modules/group/entities/sender-key.entity';

describe('ConversationService sender-key rotation', () => {
  let conversationRepository: jest.Mocked<Repository<Conversation>>;
  let memberRepository: jest.Mocked<Repository<ConversationMember>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let senderKeyRepository: jest.Mocked<Repository<SenderKey>>;
  let dataSource: jest.Mocked<DataSource>;
  let redis: jest.Mocked<Redis>;
  let service: ConversationService;

  beforeEach(() => {
    conversationRepository = {
      save: jest.fn(),
      create: jest.fn((payload: object) => payload as Conversation),
      findOne: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<Repository<Conversation>>;
    memberRepository = {
      save: jest.fn(),
      create: jest.fn((payload: object) => payload as ConversationMember),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<Repository<ConversationMember>>;
    userRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    senderKeyRepository = {
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<SenderKey>>;
    dataSource = {
      query: jest.fn(),
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;
    redis = {
      del: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    service = new ConversationService(
      conversationRepository,
      memberRepository,
      userRepository,
      senderKeyRepository,
      dataSource,
      redis,
    );
  });

  it('rotates sender_keys after adding new group members', async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: 'conv-1',
      type: 2,
    } as Conversation);
    memberRepository.findOne.mockResolvedValue({
      conversationId: 'conv-1',
      userId: 'admin-1',
      role: 1,
    } as ConversationMember);
    memberRepository.find.mockResolvedValue([]);
    userRepository.find.mockResolvedValue([{ id: 'user-2' } as User]);
    memberRepository.save.mockImplementation(async (payload: any) => payload);
    senderKeyRepository.delete.mockResolvedValue({ affected: 1, raw: {} } as any);

    const result = await service.addGroupMembers('admin-1', 'conv-1', ['user-2']);

    expect(result).toEqual({ addedCount: 1 });
    expect(senderKeyRepository.delete).toHaveBeenCalledWith({ groupId: 'conv-1' });
  });

  it('rotates sender_keys after removing a group member', async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: 'conv-1',
      type: 2,
    } as Conversation);
    memberRepository.findOne
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        userId: 'admin-1',
        role: 1,
      } as ConversationMember)
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        userId: 'user-2',
        role: 0,
      } as ConversationMember);
    memberRepository.remove.mockResolvedValue({} as ConversationMember);
    senderKeyRepository.delete.mockResolvedValue({ affected: 1, raw: {} } as any);

    await service.removeGroupMember('admin-1', 'conv-1', 'user-2');

    expect(senderKeyRepository.delete).toHaveBeenCalledWith({ groupId: 'conv-1' });
  });

  it('does not rotate sender_keys when adding members is forbidden', async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: 'conv-1',
      type: 2,
    } as Conversation);
    memberRepository.findOne.mockResolvedValue({
      conversationId: 'conv-1',
      userId: 'member-1',
      role: 0,
    } as ConversationMember);

    await expect(service.addGroupMembers('member-1', 'conv-1', ['user-2'])).rejects.toThrow(
      new ForbiddenException('Only admins can add members'),
    );
    expect(senderKeyRepository.delete).not.toHaveBeenCalled();
  });

  it('rejects direct conversation creation when users are not friends', async () => {
    userRepository.findOne = jest.fn().mockResolvedValue({ id: 'user-b' } as User);
    (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

    await expect(service.createDirectConversation('user-a', 'user-b')).rejects.toThrow(
      new ForbiddenException('You can only message friends'),
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects direct sends when either side has blocked the other', async () => {
    (dataSource.query as jest.Mock).mockResolvedValueOnce([{ id: 'block-row' }]);

    await expect(service.assertCanSendDirectMessage('user-a', 'user-b')).rejects.toThrow(
      new ForbiddenException('BLOCKED'),
    );
  });

  it('hides only the current member when deleting a conversation', async () => {
    memberRepository.findOne.mockResolvedValue({ id: 'member-a', conversationId: 'conv-1', userId: 'user-a' } as ConversationMember);
    conversationRepository.findOne.mockResolvedValue({ id: 'conv-1', type: 1 } as Conversation);
    memberRepository.update = jest.fn().mockResolvedValue({ affected: 1, raw: {} } as any);

    await expect(service.deleteConversation('user-a', 'conv-1')).resolves.toEqual({ deleted: true });

    expect(memberRepository.update).toHaveBeenCalledWith(
      { conversationId: 'conv-1', userId: 'user-a' },
      { hidden: true },
    );
    expect(conversationRepository.remove).not.toHaveBeenCalled();
  });

  it('unhides current member when reopening an existing direct conversation', async () => {
    userRepository.findOne = jest.fn().mockResolvedValue({ id: 'user-b' } as User);
    (dataSource.query as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 2 }]);
    const manager = {
      query: jest.fn().mockResolvedValue([{ conversation_id: 'conv-1' }]),
      update: jest.fn().mockResolvedValue({ affected: 1, raw: {} }),
    };
    dataSource.transaction.mockImplementation(async (callback: any) => callback(manager));

    await expect(service.createDirectConversation('user-a', 'user-b')).resolves.toEqual({ conversationId: 'conv-1' });

    expect(manager.update).toHaveBeenCalledWith(
      ConversationMember,
      { conversationId: 'conv-1', userId: 'user-a' },
      { hidden: false },
    );
  });
});
