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
import { SignedPreKey, KyberPreKey } from '../../modules/prekey/entities/prekey.entity';

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
          SignedPreKey,
          KyberPreKey,
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
        poolSize: Number(configService.get<string>('DB_POOL_SIZE', '20')),
        maxQueryExecutionTime: Number(configService.get<string>('DB_MAX_QUERY_TIME', '2000')),
        connectTimeoutMS: Number(configService.get<string>('DB_CONNECT_TIMEOUT', '10000')),
        // 生产环境优化
        idleTimeoutMillis: Number(configService.get<string>('DB_IDLE_TIMEOUT', '30000')),
        statementTimeout: Number(configService.get<string>('DB_STATEMENT_TIMEOUT', '30000')),
        ssl: configService.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
  ],
})
export class DatabaseModule {}
