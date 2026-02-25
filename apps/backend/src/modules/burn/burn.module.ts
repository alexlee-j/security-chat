import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationModule } from '../conversation/conversation.module';
import { MessageModule } from '../message/message.module';
import { Message } from '../message/entities/message.entity';
import { BurnController } from './burn.controller';
import { BurnService } from './burn.service';
import { BurnEvent } from './entities/burn-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BurnEvent, Message]), ConversationModule, MessageModule],
  controllers: [BurnController],
  providers: [BurnService],
  exports: [BurnService],
})
export class BurnModule {}
