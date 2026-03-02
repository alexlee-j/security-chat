import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ForwardMessageDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  originalMessageId!: string;

  @IsOptional()
  @IsBoolean()
  isBurn?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  burnDuration?: number;
}
