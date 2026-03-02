import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationMember } from './conversation-member.entity';

@Entity({ name: 'conversations' })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'smallint' })
  type!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Column({ name: 'default_burn_enabled', type: 'boolean', default: false })
  defaultBurnEnabled!: boolean;

  @Column({ name: 'default_burn_duration', type: 'integer', nullable: true })
  defaultBurnDuration!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ConversationMember, (member) => member.conversation)
  members!: ConversationMember[];
}
