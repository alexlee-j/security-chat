import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CallOutcome } from '../types/call.types';

@Entity({ name: 'call_records' })
@Index(['conversationId', 'createdAt'])
@Index(['callerUserId'])
@Index(['calleeUserId'])
export class CallRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'caller_user_id', type: 'uuid' })
  callerUserId!: string;

  @Column({ name: 'callee_user_id', type: 'uuid' })
  calleeUserId!: string;

  @Column({ name: 'caller_device_id', type: 'uuid', nullable: true })
  callerDeviceId!: string | null;

  @Column({ name: 'accepted_device_id', type: 'uuid', nullable: true })
  acceptedDeviceId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  outcome!: CallOutcome;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds!: number | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
