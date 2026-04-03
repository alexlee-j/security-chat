import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { GroupMember } from './group-member.entity';

@Entity({ name: 'groups' })
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  /** 群组类型: 1 = 私密(仅好友可加入), 2 = 公开(任何人可加入) */
  @Column({ type: 'smallint', default: 1 })
  type!: number;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => GroupMember, (member) => member.group)
  members!: GroupMember[];
}
