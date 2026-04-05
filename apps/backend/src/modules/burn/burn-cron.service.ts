import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'node:fs/promises';
import { Message } from '../message/entities/message.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';
import { BurnEvent } from './entities/burn-event.entity';
import { MessageGateway } from '../message/gateways/message.gateway';

@Injectable()
export class BurnCronService {
  private readonly logger = new Logger(BurnCronService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(BurnEvent)
    private readonly burnEventRepository: Repository<BurnEvent>,
    @InjectRepository(MediaAsset)
    private readonly mediaAssetRepository: Repository<MediaAsset>,
    private readonly messageGateway: MessageGateway,
  ) {}

  /**
   * 处理阅后即焚消息的自动焚毁
   * 每分钟执行一次，检查所有已读且超过焚毁时间的消息
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processBurnMessages(): Promise<void> {
    this.logger.debug('Running burn message cron job');

    const now = new Date();

    // 查找所有已读且需要焚毁的消息（readAt + burnDuration < now）
    // 使用子查询排除已经有 burn_event 的消息
    const messagesToBurn = await this.messageRepository
      .createQueryBuilder('m')
      .where('m.is_burn = :isBurn', { isBurn: true })
      .andWhere('m.read_at IS NOT NULL')
      .andWhere(
        `m.read_at + (m.burn_duration || ' seconds')::interval < :now`,
        { now },
      )
      .andWhere(
        `m.id NOT IN (
          SELECT be.message_id FROM burn_events be WHERE be.message_id = m.id
        )`,
      )
      .getMany();

    if (messagesToBurn.length === 0) {
      this.logger.debug('No messages to burn');
      return;
    }

    this.logger.log(`Found ${messagesToBurn.length} messages to burn`);

    for (const message of messagesToBurn) {
      try {
        await this.burnMessage(message);
      } catch (error) {
        this.logger.error(`Failed to burn message ${message.id}:`, error);
      }
    }
  }

  private async burnMessage(message: Message): Promise<void> {
    // 创建焚毁事件
    const burnEvent = await this.burnEventRepository.save(
      this.burnEventRepository.create({
        messageId: message.id,
        triggeredBy: 'system', // 系统自动触发
      }),
    );

    // 删除关联的媒体文件
    if (message.mediaAssetId) {
      const mediaAsset = await this.mediaAssetRepository.findOne({
        where: { id: message.mediaAssetId },
      });
      if (mediaAsset) {
        try {
          await unlink(mediaAsset.storagePath);
        } catch {
          // 文件可能已删除，继续执行
        }
        await this.mediaAssetRepository.delete({ id: message.mediaAssetId });
      }
    }

    // 删除消息
    await this.messageRepository.delete({ id: message.id });

    // 发送 WebSocket 通知
    this.messageGateway.emitBurnTriggered(
      message.conversationId,
      message.id,
      burnEvent.triggeredAt.toISOString(),
    );

    this.logger.log(`Message ${message.id} auto-burned`);
  }
}
