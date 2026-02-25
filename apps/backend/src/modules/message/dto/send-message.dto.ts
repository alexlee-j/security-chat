import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  conversationId!: string;

  @IsIn([1, 2, 3, 4])
  messageType!: number;

  @IsString()
  encryptedPayload!: string;

  @IsString()
  nonce!: string;

  @IsBoolean()
  isBurn!: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(86400)
  burnDuration?: number;
}
