import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class AckReadDto {
  @IsUUID()
  conversationId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMessageIndex!: number;
}
