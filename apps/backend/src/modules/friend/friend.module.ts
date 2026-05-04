import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../infra/redis/redis.module';
import { User } from '../user/entities/user.entity';
import { Friendship } from './entities/friendship.entity';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship, User]), RedisModule, forwardRef(() => MessageModule)],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
