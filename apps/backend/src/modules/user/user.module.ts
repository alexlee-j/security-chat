import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Device } from './entities/device.entity';
import { OneTimePrekey } from './entities/one-time-prekey.entity';
import { User } from './entities/user.entity';
import { KeyVerification } from './entities/key-verification.entity';
import { FriendModule } from '../friend/friend.module';
import { KyberPreKey } from '../prekey/entities/prekey.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Device, OneTimePrekey, KeyVerification, KyberPreKey]), FriendModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
