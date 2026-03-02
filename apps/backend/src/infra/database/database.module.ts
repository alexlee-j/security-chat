import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationMember } from '../../modules/conversation/entities/conversation-member.entity';
import { Conversation } from '../../modules/conversation/entities/conversation.entity';
import { BurnEvent } from '../../modules/burn/entities/burn-event.entity';
import { Message } from '../../modules/message/entities/message.entity';
import { MediaAsset } from '../../modules/media/entities/media-asset.entity';
import { Friendship } from '../../modules/friend/entities/friendship.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Device } from '../../modules/user/entities/device.entity';
import { OneTimePrekey } from '../../modules/user/entities/one-time-prekey.entity';
import { Notification } from '../../modules/notification/entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USER', 'security_chat_user'),
        password: configService.get<string>('DB_PASSWORD', 'security_chat_pass_please_change'),
        database: configService.get<string>('DB_NAME', 'security_chat'),
        autoLoadEntities: false,
        entities: [
          User,
          Device,
          OneTimePrekey,
          Conversation,
          ConversationMember,
          Message,
          MediaAsset,
          BurnEvent,
          Friendship,
          Notification,
        ],
        synchronize: configService.get<string>('DB_SYNC', 'true') === 'true',
        // 数据库连接池配置
        poolSize: 10,
        maxQueryExecutionTime: 2000,
        connectTimeoutMS: 10000,
      }),
    }),
  ],
})
export class DatabaseModule {}
