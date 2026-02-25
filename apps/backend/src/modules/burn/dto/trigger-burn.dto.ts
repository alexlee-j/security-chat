import { IsUUID } from 'class-validator';

export class TriggerBurnDto {
  @IsUUID()
  messageId!: string;
}
