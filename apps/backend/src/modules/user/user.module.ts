import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Device } from './entities/device.entity';
import { OneTimePrekey } from './entities/one-time-prekey.entity';
import { User } from './entities/user.entity';
import { KeyVerification } from './entities/key-verification.entity';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Device, OneTimePrekey, KeyVerification]), FriendModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
