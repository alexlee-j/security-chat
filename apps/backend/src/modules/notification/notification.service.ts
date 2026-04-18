import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationSettings } from './entities/notification-settings.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationSettings)
    private readonly settingsRepository: Repository<NotificationSettings>,
  ) {}

  async createNotification(dto: CreateNotificationDto): Promise<{ notificationId: string }> {
    const notification = this.notificationRepository.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: dto.data || null,
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);
    return { notificationId: saved.id };
  }

  async getNotifications(
    userId: string,
    dto: QueryNotificationsDto,
  ): Promise<{
    notifications: Array<{
      id: string;
      type: 'friend_request' | 'message' | 'system' | 'burn' | 'group';
      title: string;
      body: string;
      data: Record<string, unknown> | null;
      isRead: boolean;
      createdAt: string;
    }>;
    total: number;
  }> {
    const limit = Math.min(dto.limit ?? 20, 100);
    const offset = dto.offset ?? 0;

    let query = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId });

    if (dto.isRead !== undefined) {
      query = query.andWhere('n.isRead = :isRead', { isRead: dto.isRead });
    }

    const [notifications, total] = await query
      .orderBy('n.createdAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return {
      notifications: notifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      })),
      total,
    };
  }

  async markAsRead(userId: string, dto: MarkReadDto): Promise<{ updatedCount: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('id IN (:...notificationIds)', { notificationIds: dto.notificationIds })
      .andWhere('userId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    return { updatedCount: result.affected || 0 };
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('userId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    return { updatedCount: result.affected || 0 };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const count = await this.notificationRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.isRead = false')
      .getCount();

    return { unreadCount: count };
  }

  async deleteNotification(userId: string, notificationId: string): Promise<{ deleted: boolean }> {
    const result = await this.notificationRepository.delete({
      id: notificationId,
      userId,
    });

    return { deleted: (result.affected || 0) > 0 };
  }

  async createBatchNotifications(dtos: Array<{
    userId: string;
    type: 'friend_request' | 'message' | 'system' | 'burn' | 'group';
    title: string;
    body: string;
    data: Record<string, unknown> | null;
  }>): Promise<{ createdCount: number }> {
    const notifications = dtos.map(dto => this.notificationRepository.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: dto.data || null,
      isRead: false,
    }));

    const saved = await this.notificationRepository.save(notifications);
    return { createdCount: saved.length };
  }

  async getUnreadSummary(userId: string): Promise<{
    totalUnread: number;
    recentUnread: Array<{
      id: string;
      type: 'friend_request' | 'message' | 'system' | 'burn' | 'group';
      title: string;
      body: string;
      data: Record<string, unknown> | null;
      createdAt: string;
    }>;
  }> {
    const totalUnread = await this.notificationRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.isRead = false')
      .getCount();

    const recentUnread = await this.notificationRepository
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.isRead = false')
      .orderBy('n.createdAt', 'DESC')
      .limit(5)
      .getMany();

    return {
      totalUnread,
      recentUnread: recentUnread.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        createdAt: notification.createdAt.toISOString(),
      })),
    };
  }

  async getNotificationSettings(userId: string): Promise<{
    messageEnabled: boolean;
    friendRequestEnabled: boolean;
    burnEnabled: boolean;
    groupEnabled: boolean;
  }> {
    let settings = await this.settingsRepository.findOne({ where: { userId } });

    if (!settings) {
      settings = this.settingsRepository.create({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
      });
      await this.settingsRepository.save(settings);
    }

    return {
      messageEnabled: settings.messageEnabled,
      friendRequestEnabled: settings.friendRequestEnabled,
      burnEnabled: settings.burnEnabled,
      groupEnabled: settings.groupEnabled,
    };
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<{
    messageEnabled: boolean;
    friendRequestEnabled: boolean;
    burnEnabled: boolean;
    groupEnabled: boolean;
  }> {
    let settings = await this.settingsRepository.findOne({ where: { userId } });

    if (!settings) {
      settings = this.settingsRepository.create({
        userId,
        messageEnabled: true,
        friendRequestEnabled: true,
        burnEnabled: true,
        groupEnabled: true,
      });
    }

    if (dto.messageEnabled !== undefined) {
      settings.messageEnabled = dto.messageEnabled;
    }
    if (dto.friendRequestEnabled !== undefined) {
      settings.friendRequestEnabled = dto.friendRequestEnabled;
    }
    if (dto.burnEnabled !== undefined) {
      settings.burnEnabled = dto.burnEnabled;
    }
    if (dto.groupEnabled !== undefined) {
      settings.groupEnabled = dto.groupEnabled;
    }

    await this.settingsRepository.save(settings);

    return {
      messageEnabled: settings.messageEnabled,
      friendRequestEnabled: settings.friendRequestEnabled,
      burnEnabled: settings.burnEnabled,
      groupEnabled: settings.groupEnabled,
    };
  }

  async isNotificationEnabled(userId: string, type: 'message' | 'friend_request' | 'burn' | 'group'): Promise<boolean> {
    const settings = await this.getNotificationSettings(userId);

    switch (type) {
      case 'message':
        return settings.messageEnabled;
      case 'friend_request':
        return settings.friendRequestEnabled;
      case 'burn':
        return settings.burnEnabled;
      case 'group':
        return settings.groupEnabled;
      default:
        return true;
    }
  }
}
