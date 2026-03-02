import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationModule } from '../conversation/conversation.module';
import { MediaController } from './media.controller';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaService } from './media.service';

@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset]), ConversationModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
