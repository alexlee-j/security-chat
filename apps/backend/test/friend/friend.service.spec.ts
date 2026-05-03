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

    service = new FriendService(friendshipRepository, userRepository, redis, dataSource as any);
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
});
