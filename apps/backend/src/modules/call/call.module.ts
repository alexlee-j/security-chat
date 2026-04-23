import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConversationModule } from '../conversation/conversation.module';
import { CallConfigService } from './call-config.service';
import { CallController } from './call.controller';
import { CallGateway } from './call.gateway';
import { CallHistoryService } from './call-history.service';
import { CallService } from './call.service';
import { CallRecord } from './entities/call-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallRecord]),
    AuthModule,
    ConversationModule,
  ],
  controllers: [CallController],
  providers: [CallConfigService, CallGateway, CallHistoryService, CallService],
  exports: [CallConfigService, CallHistoryService, CallService],
})
export class CallModule {}
