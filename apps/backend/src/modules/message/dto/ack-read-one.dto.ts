import { IsUUID } from 'class-validator';

export class AckReadOneDto {
  @IsUUID()
  messageId!: string;
}

