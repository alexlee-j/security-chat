import { Repository } from 'typeorm';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { Notification } from '../../src/modules/notification/entities/notification.entity';
import { NotificationSettings } from '../../src/modules/notification/entities/notification-settings.entity';

const userId = '3c0f8e1a-0d56-4a73-9f32-6f4f7a0ad001';
const otherUserId = '3c0f8e1a-0d56-4a73-9f32-6f4f7a0ad002';

describe('NotificationService settings', () => {
  let notificationService: NotificationService;
  let notificationRepository: jest.Mocked<Repository<Notification>>;
  let settingsRepository: jest.Mocked<Repository<NotificationSettings>>;

  const createService = () => {
    notificationRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Notification>>;

    settingsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<NotificationSettings>>;

    notificationService = new NotificationService(
      notificationRepository,
      settingsRepository,
    );
  };

  beforeEach(() => {
    createService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getNotificationSettings', () => {
    it('returns default settings when user has no settings', async () => {
      settingsRepository.findOne.mockResolvedValue(null);
      settingsRepository.create.mockReturnValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);
      settingsRepository.save.mockResolvedValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.getNotificationSettings(userId);

      expect(result).toEqual({
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      });
    });

    it('returns existing settings when user has settings', async () => {
      const existingSettings = {
        userId,
        messageEnabled: false,
        friendRequestEnabled: true,
        burnEnabled: false,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings;
      settingsRepository.findOne.mockResolvedValue(existingSettings);

      const result = await notificationService.getNotificationSettings(userId);

      expect(result).toEqual({
        messageEnabled: false,
        friendRequestEnabled: true,
        burnEnabled: false,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      });
    });
  });

  describe('updateNotificationSettings', () => {
    it('creates new settings with defaults when user has no settings', async () => {
      settingsRepository.findOne.mockResolvedValue(null);
      settingsRepository.create.mockReturnValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);
      settingsRepository.save.mockResolvedValue({
        userId,
        messageEnabled: false,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.updateNotificationSettings(userId, {
        messageEnabled: false,
      });

      expect(result.messageEnabled).toBe(false);
      expect(result.friendRequestEnabled).toBe(true);
      expect(result.accountRecoveryEnabled).toBe(true);
    });

    it('updates only specified fields', async () => {
      const existingSettings = {
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings;
      settingsRepository.findOne.mockResolvedValue(existingSettings);
      settingsRepository.save.mockResolvedValue({
        ...existingSettings,
        messageEnabled: false,
      } as NotificationSettings);

      const result = await notificationService.updateNotificationSettings(userId, {
        messageEnabled: false,
      });

      expect(result.messageEnabled).toBe(false);
      expect(result.friendRequestEnabled).toBe(true);
      expect(result.burnEnabled).toBe(true);
      expect(result.groupEnabled).toBe(true);
      expect(result.accountRecoveryEnabled).toBe(true);
    });
  });

  describe('isNotificationEnabled', () => {
    it('returns true for message when enabled', async () => {
      settingsRepository.findOne.mockResolvedValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.isNotificationEnabled(userId, 'message');

      expect(result).toBe(true);
    });

    it('returns false for message when disabled', async () => {
      settingsRepository.findOne.mockResolvedValue({
        userId,
        messageEnabled: false,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.isNotificationEnabled(userId, 'message');

      expect(result).toBe(false);
    });

    it('returns true for friend_request when enabled', async () => {
      settingsRepository.findOne.mockResolvedValue({
        userId,
        messageEnabled: false,
        friendRequestEnabled: true,
        burnEnabled: false,
        groupEnabled: false,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: false,
      } as NotificationSettings);

      const result = await notificationService.isNotificationEnabled(userId, 'friend_request');

      expect(result).toBe(true);
    });

    it('returns false for friend_request when disabled', async () => {
      settingsRepository.findOne.mockResolvedValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: false,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: false,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.isNotificationEnabled(userId, 'friend_request');

      expect(result).toBe(false);
    });

    it('returns false for account_recovery when disabled', async () => {
      settingsRepository.findOne.mockResolvedValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: false,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.isNotificationEnabled(userId, 'account_recovery');

      expect(result).toBe(false);
    });

    it('returns true for group_lifecycle when enabled', async () => {
      settingsRepository.findOne.mockResolvedValue({
        userId,
        messageEnabled: false,
        friendRequestEnabled: false,
        burnEnabled: false,
        groupEnabled: false,
        accountRecoveryEnabled: false,
        securityEventEnabled: false,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.isNotificationEnabled(userId, 'group_lifecycle');

      expect(result).toBe(true);
    });

    it('returns true when user has no settings (default to enabled)', async () => {
      settingsRepository.findOne.mockResolvedValue(null);
      settingsRepository.create.mockReturnValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);
      settingsRepository.save.mockResolvedValue({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
        accountRecoveryEnabled: true,
        securityEventEnabled: true,
        groupLifecycleEnabled: true,
      } as NotificationSettings);

      const result = await notificationService.isNotificationEnabled(userId, 'message');

      expect(result).toBe(true);
    });
  });
});
