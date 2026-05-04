import Redis from 'ioredis';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FriendService } from '../../src/modules/friend/friend.service';
import { Friendship } from '../../src/modules/friend/entities/friendship.entity';
import { User } from '../../src/modules/user/entities/user.entity';

describe('FriendService remove-friend contract', () => {
  let friendshipRepository: jest.Mocked<Repository<Friendship>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let redis: jest.Mocked<Redis>;
  let dataSource: { query: jest.Mock };
  let messageGateway: { emitFriendRequestReceived: jest.Mock; emitFriendRequestResponded: jest.Mock };
  let service: FriendService;

  beforeEach(() => {
    friendshipRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn((payload: object) => payload as Friendship),
    } as unknown as jest.Mocked<Repository<Friendship>>;
    userRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    redis = {
      mget: jest.fn(),
    } as unknown as jest.Mocked<Redis>;
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
    };
    messageGateway = {
      emitFriendRequestReceived: jest.fn(),
      emitFriendRequestResponded: jest.fn(),
    };

    service = new FriendService(friendshipRepository, userRepository, redis, dataSource as any, messageGateway as any);
  });

  it('removes both directions of an accepted friendship and preserves chat history', async () => {
    friendshipRepository.findOne
      .mockResolvedValueOnce({
        id: 'friendship-a',
        userId: 'user-a',
        friendId: 'user-b',
        status: 1,
        remark: null,
      } as Friendship)
      .mockResolvedValueOnce({
        id: 'friendship-b',
        userId: 'user-b',
        friendId: 'user-a',
        status: 1,
        remark: null,
      } as Friendship);

    await expect(service.removeFriend('user-a', { targetUserId: 'user-b' } as never)).resolves.toEqual({
      removed: true,
      targetUserId: 'user-b',
    });

    expect(friendshipRepository.remove).toHaveBeenCalledTimes(1);
    expect(friendshipRepository.remove).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'friendship-a' }),
      expect.objectContaining({ id: 'friendship-b' }),
    ]);
  });

  it('rejects pending friend requests', async () => {
    friendshipRepository.findOne
      .mockResolvedValueOnce({
        id: 'friendship-a',
        userId: 'user-a',
        friendId: 'user-b',
        status: 0,
        remark: null,
      } as Friendship)
      .mockResolvedValueOnce(null);

    await expect(service.removeFriend('user-a', { targetUserId: 'user-b' } as never)).rejects.toEqual(
      new BadRequestException('Cannot remove a pending friend request'),
    );
    expect(friendshipRepository.remove).not.toHaveBeenCalled();
  });

  it('rejects missing friendships', async () => {
    friendshipRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(service.removeFriend('user-a', { targetUserId: 'user-b' } as never)).rejects.toEqual(
      new NotFoundException('Friend relationship not found'),
    );
    expect(friendshipRepository.remove).not.toHaveBeenCalled();
  });

  it('rejects blocked relationships', async () => {
    friendshipRepository.findOne
      .mockResolvedValueOnce({
        id: 'friendship-a',
        userId: 'user-a',
        friendId: 'user-b',
        status: 2,
        remark: null,
      } as Friendship)
      .mockResolvedValueOnce({
        id: 'friendship-b',
        userId: 'user-b',
        friendId: 'user-a',
        status: 2,
        remark: null,
      } as Friendship);

    await expect(service.removeFriend('user-a', { targetUserId: 'user-b' } as never)).rejects.toEqual(
      new BadRequestException('Cannot remove a blocked relationship'),
    );
    expect(friendshipRepository.remove).not.toHaveBeenCalled();
  });

  it('hides both users direct conversation when blocking', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-b' } as User);
    friendshipRepository.findOne.mockResolvedValue(null);
    friendshipRepository.save.mockResolvedValue({} as Friendship);

    await service.blockUser('user-a', { targetUserId: 'user-b' } as never);

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conversation_members'),
      ['user-a', 'user-b'],
    );
  });

  describe('sendRequest', () => {
    it('emits friend.request.received when creating a new pending request', async () => {
      userRepository.findOne.mockResolvedValueOnce({ id: 'user-b' } as User);
      friendshipRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      friendshipRepository.save.mockResolvedValue({} as Friendship);
      userRepository.findOne.mockResolvedValueOnce({ id: 'user-a', username: 'Alice', avatarUrl: 'https://example.com/a.png' } as User);

      await service.sendRequest('user-a', { targetUserId: 'user-b', remark: 'Hey there' } as never);

      expect(messageGateway.emitFriendRequestReceived).toHaveBeenCalledTimes(1);
      expect(messageGateway.emitFriendRequestReceived).toHaveBeenCalledWith('user-b', {
        requesterUserId: 'user-a',
        requesterUsername: 'Alice',
        requesterAvatarUrl: 'https://example.com/a.png',
        remark: 'Hey there',
        createdAt: expect.any(String),
      });
    });

    it('does not emit when target already sent a request (mutual acceptance)', async () => {
      userRepository.findOne.mockResolvedValueOnce({ id: 'user-b' } as User);
      friendshipRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'fs-1', userId: 'user-b', friendId: 'user-a', status: 0 } as Friendship);
      friendshipRepository.save.mockResolvedValue({} as Friendship);

      await service.sendRequest('user-a', { targetUserId: 'user-b' } as never);

      expect(messageGateway.emitFriendRequestReceived).not.toHaveBeenCalled();
    });

    it('does not emit when outgoing request already exists', async () => {
      userRepository.findOne.mockResolvedValueOnce({ id: 'user-b' } as User);
      friendshipRepository.findOne
        .mockResolvedValueOnce({ id: 'fs-1', userId: 'user-a', friendId: 'user-b', status: 0 } as Friendship)
        .mockResolvedValueOnce(null);

      await service.sendRequest('user-a', { targetUserId: 'user-b' } as never);

      expect(messageGateway.emitFriendRequestReceived).not.toHaveBeenCalled();
    });

    it('does not emit when already friends', async () => {
      userRepository.findOne.mockResolvedValueOnce({ id: 'user-b' } as User);
      friendshipRepository.findOne
        .mockResolvedValueOnce({ id: 'fs-1', userId: 'user-a', friendId: 'user-b', status: 1 } as Friendship)
        .mockResolvedValueOnce(null);

      await expect(service.sendRequest('user-a', { targetUserId: 'user-b' } as never)).rejects.toEqual(
        new BadRequestException('Already friends'),
      );
      expect(messageGateway.emitFriendRequestReceived).not.toHaveBeenCalled();
    });
  });

  describe('respondRequest', () => {
    it('emits friend.request.responded with accepted=true when accepting', async () => {
      friendshipRepository.findOne
        .mockResolvedValueOnce({ id: 'fs-1', userId: 'user-a', friendId: 'user-b', status: 0 } as Friendship)
        .mockResolvedValueOnce(null);
      friendshipRepository.save.mockResolvedValue({} as Friendship);
      userRepository.findOne.mockResolvedValue({ id: 'user-b', username: 'Bob', avatarUrl: null } as User);

      await service.respondRequest('user-b', { requesterUserId: 'user-a', accept: true } as never);

      expect(messageGateway.emitFriendRequestResponded).toHaveBeenCalledTimes(1);
      expect(messageGateway.emitFriendRequestResponded).toHaveBeenCalledWith('user-a', {
        targetUserId: 'user-b',
        targetUsername: 'Bob',
        targetAvatarUrl: null,
        accepted: true,
        respondedAt: expect.any(String),
      });
    });

    it('emits friend.request.responded with accepted=false when rejecting', async () => {
      friendshipRepository.findOne.mockResolvedValueOnce({ id: 'fs-1', userId: 'user-a', friendId: 'user-b', status: 0 } as Friendship);
      userRepository.findOne.mockResolvedValue({ id: 'user-b', username: 'Bob', avatarUrl: null } as User);

      await service.respondRequest('user-b', { requesterUserId: 'user-a', accept: false } as never);

      expect(messageGateway.emitFriendRequestResponded).toHaveBeenCalledTimes(1);
      expect(messageGateway.emitFriendRequestResponded).toHaveBeenCalledWith('user-a', {
        targetUserId: 'user-b',
        targetUsername: 'Bob',
        targetAvatarUrl: null,
        accepted: false,
        respondedAt: expect.any(String),
      });
    });

    it('does not emit when pending request is not found', async () => {
      friendshipRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.respondRequest('user-b', { requesterUserId: 'user-a', accept: true } as never)).rejects.toEqual(
        new NotFoundException('Pending friend request not found'),
      );
      expect(messageGateway.emitFriendRequestResponded).not.toHaveBeenCalled();
    });
  });
});
