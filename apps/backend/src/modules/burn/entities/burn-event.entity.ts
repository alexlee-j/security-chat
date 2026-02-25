import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'burn_events' })
export class BurnEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @Column({ name: 'triggered_by', type: 'uuid' })
  triggeredBy!: string;

  @CreateDateColumn({ name: 'triggered_at', type: 'timestamptz' })
  triggeredAt!: Date;
}
