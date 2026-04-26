import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from './src/modules/user/entities/user.entity';
import { Device } from './src/modules/user/entities/device.entity';
import { OneTimePrekey } from './src/modules/user/entities/one-time-prekey.entity';
import { KeyVerification } from './src/modules/user/entities/key-verification.entity';
import { SignedPreKey, KyberPreKey } from './src/modules/prekey/entities/prekey.entity';
import { Conversation } from './src/modules/conversation/entities/conversation.entity';
import { ConversationMember } from './src/modules/conversation/entities/conversation-member.entity';
import { Message } from './src/modules/message/entities/message.entity';
import { DraftMessage } from './src/modules/message/entities/draft-message.entity';
import { MediaAsset } from './src/modules/media/entities/media-asset.entity';
import { BurnEvent } from './src/modules/burn/entities/burn-event.entity';
import { Friendship } from './src/modules/friend/entities/friendship.entity';
import { Notification } from './src/modules/notification/entities/notification.entity';
import { NotificationSettings } from './src/modules/notification/entities/notification-settings.entity';

const options: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'security_chat_user',
  password: process.env.DB_PASSWORD || 'security_chat_pass_please_change',
  database: process.env.DB_NAME || 'security_chat',
  entities: [
    User,
    Device,
    OneTimePrekey,
    KeyVerification,
    SignedPreKey,
    KyberPreKey,
    Conversation,
    ConversationMember,
    Message,
    DraftMessage,
    MediaAsset,
    BurnEvent,
    Friendship,
    Notification,
    NotificationSettings,
  ],
  migrations: ['dist/src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
};

export const AppDataSource = new DataSource(options);
