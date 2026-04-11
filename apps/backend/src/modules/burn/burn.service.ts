import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'node:fs/promises';
import { ConversationService } from '../conversation/conversation.service';
import { MessageGateway } from '../message/gateways/message.gateway';
import { Message } from '../message/entities/message.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';
import { BurnEvent } from './entities/burn-event.entity';

@Injectable()
export class BurnService {
  constructor(
    @InjectRepository(BurnEvent)
    private readonly burnEventRepository: Repository<BurnEvent>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MediaAsset)
    private readonly mediaAssetRepository: Repository<MediaAsset>,
    private readonly dataSource: DataSource,
    private readonly conversationService: ConversationService,
    private readonly messageGateway: MessageGateway,
  ) {}

  async triggerBurn(
    userId: string,
    messageId: string,
  ): Promise<{ burned: boolean; messageId: string; triggeredAt: string }> {
    const existed = await this.burnEventRepository.findOne({ where: { messageId } });
    if (existed) {
      return {
        burned: true,
        messageId,
        triggeredAt: existed.triggeredAt.toISOString(),
      };
    }

    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.conversationService.assertMember(message.conversationId, userId);

    // 群聊不支持阅后即焚功能
    const conversation = await this.conversationService.findById(message.conversationId);
    if (conversation?.type === 2) {
      throw new BadRequestException('Burn messages are not supported in group chats');
    }

    // 消息发送者不能触发焚毁（只有接收者可以）
    if (message.senderId === userId) {
      throw new ForbiddenException('Only message recipient can trigger burn');
    }

    if (!message.isBurn) {
      throw new BadRequestException('Message is not burn-enabled');
    }

    let burnEvent: BurnEvent;
    try {
      burnEvent = await this.burnEventRepository.save(
        this.burnEventRepository.create({
          messageId,
          triggeredBy: userId,
        }),
      );
    } catch {
      const concurrentEvent = await this.burnEventRepository.findOne({ where: { messageId } });
      if (concurrentEvent) {
        return {
          burned: true,
          messageId,
          triggeredAt: concurrentEvent.triggeredAt.toISOString(),
        };
      }
      throw new BadRequestException('Failed to trigger burn');
    }

    // Delete associated media file if exists
    if (message.mediaAssetId) {
      const mediaAsset = await this.mediaAssetRepository.findOne({
        where: { id: message.mediaAssetId },
      });
      if (mediaAsset) {
        try {
          await unlink(mediaAsset.storagePath);
        } catch {
          // File may already be deleted, continue
        }
        await this.mediaAssetRepository.delete({ id: message.mediaAssetId });
      }
    }

    await this.messageRepository.delete({ id: messageId });

    this.messageGateway.emitBurnTriggered(
      message.conversationId,
      messageId,
      burnEvent.triggeredAt.toISOString(),
    );
    const memberUserIds = await this.listConversationMemberUserIds(message.conversationId);
    this.messageGateway.emitConversationUpdated(memberUserIds, {
      conversationId: message.conversationId,
      reason: 'burn.triggered',
    });

    return {
      burned: true,
      messageId,
      triggeredAt: burnEvent.triggeredAt.toISOString(),
    };
  }

  private async listConversationMemberUserIds(conversationId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT user_id::text AS user_id FROM conversation_members WHERE conversation_id = $1;`,
      [conversationId],
    );
    return (rows as Array<{ user_id?: string }>).map((row) => row.user_id ?? '').filter(Boolean);
  }
}
