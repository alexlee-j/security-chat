import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConversationModule } from '../conversation/conversation.module';
import { NotificationModule } from '../notification/notification.module';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageGateway } from './gateways/message.gateway';
import { Message } from './entities/message.entity';
import { DraftMessage } from './entities/draft-message.entity';
import { RevokeEvent } from './entities/revoke-event.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, DraftMessage, RevokeEvent, MediaAsset]), ConversationModule, AuthModule, NotificationModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService, MessageGateway],
})
export class MessageModule {}
