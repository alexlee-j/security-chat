import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConversationService } from '../conversation/conversation.service';
import { CallRecord } from './entities/call-record.entity';
import type { CallOutcome } from './types/call.types';

export type CreateCallRecordInput = {
  conversationId: string;
  callerUserId: string;
  calleeUserId: string;
  callerDeviceId?: string | null;
  acceptedDeviceId?: string | null;
  outcome: CallOutcome;
  startedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  endedAt?: Date | string | null;
  createdByUserId?: string | null;
};

@Injectable()
export class CallHistoryService implements OnModuleInit {
  private readonly logger = new Logger(CallHistoryService.name);

  constructor(
    @InjectRepository(CallRecord)
    private readonly callRecordRepository: Repository<CallRecord>,
    private readonly dataSource: DataSource,
    private readonly conversationService: ConversationService,
  ) {}

  onModuleInit(): void {
    void this.ensureSchema();
  }

  async createRecord(input: CreateCallRecordInput): Promise<CallRecord> {
    const startedAt = toDateOrNull(input.startedAt);
    const acceptedAt = toDateOrNull(input.acceptedAt);
    const endedAt = toDateOrNull(input.endedAt) ?? new Date();
    const durationSeconds = acceptedAt && endedAt
      ? Math.max(0, Math.floor((endedAt.getTime() - acceptedAt.getTime()) / 1000))
      : null;

    return this.callRecordRepository.save(this.callRecordRepository.create({
      conversationId: input.conversationId,
      callerUserId: input.callerUserId,
      calleeUserId: input.calleeUserId,
      callerDeviceId: input.callerDeviceId ?? null,
      acceptedDeviceId: input.acceptedDeviceId ?? null,
      outcome: input.outcome,
      startedAt,
      acceptedAt,
      endedAt,
      durationSeconds,
      createdByUserId: input.createdByUserId ?? input.callerUserId,
    }));
  }

  async listForConversation(userId: string, conversationId: string): Promise<CallRecord[]> {
    await this.conversationService.assertMember(conversationId, userId);
    return this.callRecordRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  private async ensureSchema(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "call_records" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "conversation_id" uuid NOT NULL,
          "caller_user_id" uuid NOT NULL,
          "callee_user_id" uuid NOT NULL,
          "caller_device_id" uuid,
          "accepted_device_id" uuid,
          "outcome" varchar(32) NOT NULL,
          "started_at" timestamptz,
          "accepted_at" timestamptz,
          "ended_at" timestamptz,
          "duration_seconds" integer,
          "created_by_user_id" uuid,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_call_records" PRIMARY KEY ("id")
        );
      `);
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS "IDX_call_records_conversation_created" ON "call_records" ("conversation_id", "created_at");`,
      );
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS "IDX_call_records_caller" ON "call_records" ("caller_user_id");`,
      );
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS "IDX_call_records_callee" ON "call_records" ("callee_user_id");`,
      );
    } catch (error) {
      this.logger.warn('Failed to ensure call history schema', error as Error);
    }
  }
}

function toDateOrNull(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}
