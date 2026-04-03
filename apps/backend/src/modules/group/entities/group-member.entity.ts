import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  JoinColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { User } from '../../user/entities/user.entity';

@Entity({ name: 'group_members' })
@Index(['groupId', 'userId'], { unique: true })
export class GroupMember {
  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** 角色: 1 = 管理员, 2 = 成员 */
  @Column({ type: 'smallint', default: 2 })
  role!: number;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
