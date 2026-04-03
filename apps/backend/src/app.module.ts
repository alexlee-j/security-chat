import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infra/database/database.module';
import { RedisModule } from './infra/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { BurnModule } from './modules/burn/burn.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { FriendModule } from './modules/friend/friend.module';
import { MessageModule } from './modules/message/message.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SecurityModule } from './modules/security/security.module';
import { UserModule } from './modules/user/user.module';
import { MailModule } from './modules/mail/mail.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { IdentityModule } from './modules/identity/identity.module';
import { GroupModule } from './modules/group/group.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    UserModule,
    FriendModule,
    ConversationModule,
    MessageModule,
    MediaModule,
    BurnModule,
    NotificationModule,
    SecurityModule,
    MailModule,
    MetricsModule,
    IdentityModule,
    GroupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
