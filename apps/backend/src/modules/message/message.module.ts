import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConversationModule } from '../conversation/conversation.module';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageGateway } from './gateways/message.gateway';
import { Message } from './entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), ConversationModule, AuthModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService, MessageGateway],
})
export class MessageModule {}
