import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationService } from '../conversation/conversation.service';
import { MessageGateway } from '../message/gateways/message.gateway';
import { Message } from '../message/entities/message.entity';
import { BurnEvent } from './entities/burn-event.entity';

@Injectable()
export class BurnService {
  constructor(
    @InjectRepository(BurnEvent)
    private readonly burnEventRepository: Repository<BurnEvent>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
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

    if (!message.isBurn) {
      throw new BadRequestException('Message is not burn-enabled');
    }

    const burnEvent = await this.burnEventRepository.save(
      this.burnEventRepository.create({
        messageId,
        triggeredBy: userId,
      }),
    );

    await this.messageRepository.delete({ id: messageId });

    this.messageGateway.emitBurnTriggered(
      message.conversationId,
      messageId,
      burnEvent.triggeredAt.toISOString(),
    );

    return {
      burned: true,
      messageId,
      triggeredAt: burnEvent.triggeredAt.toISOString(),
    };
  }
}
