import { UserService } from '../../src/modules/user/user.service';

describe('UserService.uploadOneTimePrekeys idempotency', () => {
  const userId = '7f0cb20d-2a58-43f1-a6fc-0870d02f0f01';
  const deviceId = 'b3df5607-651f-4501-bf38-3dca5e70a001';

  let service: UserService;
  let deviceRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let oneTimePrekeyRepository: {
    create: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
  };
  let kyberPrekeyRepository: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    deviceRepository = {
      findOne: jest.fn().mockResolvedValue({ id: deviceId, userId }),
      find: jest.fn().mockResolvedValue([{ id: deviceId }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    oneTimePrekeyRepository = {
      create: jest.fn((input) => input),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    kyberPrekeyRepository = {
      create: jest.fn((input) => input),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };

    service = new UserService(
      {} as any,
      deviceRepository as any,
      oneTimePrekeyRepository as any,
      {} as any,
      kyberPrekeyRepository as any,
      {} as any,
    );
  });

  it('skips existing prekey keyIds and still writes kyber prekey', async () => {
    oneTimePrekeyRepository.find.mockResolvedValueOnce([
      { keyId: 1 },
      { keyId: 2 },
    ]);

    const result = await service.uploadOneTimePrekeys(userId, deviceId, {
      oneTimePrekeys: [
        { keyId: 1, publicKey: 'pk-1' },
        { keyId: 2, publicKey: 'pk-2' },
        { keyId: 3, publicKey: 'pk-3' },
      ],
      kyberPrekey: {
        keyId: 1,
        publicKey: 'kyber-public',
        signature: 'kyber-signature',
      },
    });

    expect(oneTimePrekeyRepository.save).toHaveBeenCalledTimes(1);
    expect(oneTimePrekeyRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ deviceId, keyId: 3, publicKey: 'pk-3', isUsed: false }),
    ]);
    expect(kyberPrekeyRepository.save).toHaveBeenCalledTimes(1);
    expect(result.inserted).toBe(2);
  });

  it('updates existing kyber key in place without inserting duplicate prekeys', async () => {
    oneTimePrekeyRepository.find.mockResolvedValueOnce([{ keyId: 11 }]);
    kyberPrekeyRepository.findOne.mockResolvedValueOnce({
      id: 'kyber-row-id',
      userId,
      kyberPreKeyId: 1,
      publicKey: 'old-public',
      signature: 'old-signature',
      timestamp: 1,
      createdAt: new Date(),
    });

    const result = await service.uploadOneTimePrekeys(userId, deviceId, {
      oneTimePrekeys: [{ keyId: 11, publicKey: 'pk-11' }],
      kyberPrekey: {
        keyId: 1,
        publicKey: 'new-public',
        signature: 'new-signature',
      },
    });

    expect(oneTimePrekeyRepository.save).not.toHaveBeenCalled();
    expect(kyberPrekeyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kyber-row-id',
        publicKey: 'new-public',
        signature: 'new-signature',
      }),
    );
    expect(result.inserted).toBe(1);
  });
});

