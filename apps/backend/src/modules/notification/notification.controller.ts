import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Controller('notification')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('list')
  getNotifications(
    @CurrentUser() user: RequestUser,
    @Query() dto: QueryNotificationsDto,
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
    return this.notificationService.getNotifications(user.userId, dto);
  }

  @Post('mark-read')
  markAsRead(
    @CurrentUser() user: RequestUser,
    @Body() dto: MarkReadDto,
  ): Promise<{ updatedCount: number }> {
    return this.notificationService.markAsRead(user.userId, dto);
  }

  @Post('mark-all-read')
  markAllAsRead(
    @CurrentUser() user: RequestUser,
  ): Promise<{ updatedCount: number }> {
    return this.notificationService.markAllAsRead(user.userId);
  }

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: RequestUser,
  ): Promise<{ unreadCount: number }> {
    return this.notificationService.getUnreadCount(user.userId);
  }

  @Delete(':notificationId')
  deleteNotification(
    @CurrentUser() user: RequestUser,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ): Promise<{ deleted: boolean }> {
    return this.notificationService.deleteNotification(user.userId, notificationId);
  }

  @Get('unread-summary')
  getUnreadSummary(
    @CurrentUser() user: RequestUser,
  ): Promise<{
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
    return this.notificationService.getUnreadSummary(user.userId);
  }
}
