import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { SenderKey } from './entities/sender-key.entity';
import { User } from '../user/entities/user.entity';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, GroupMember, SenderKey, User]),
    FriendModule,
  ],
  controllers: [GroupController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
