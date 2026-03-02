import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class SaveDraftDto {
  @IsUUID()
  conversationId!: string;

  @IsIn([1, 2, 3, 4])
  messageType!: number;

  @IsString()
  encryptedPayload!: string;

  @IsString()
  nonce!: string;

  @IsOptional()
  @IsUUID()
  mediaAssetId?: string;

  @IsOptional()
  @IsBoolean()
  isBurn?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  burnDuration?: number;
}

export class GetDraftDto {
  @IsUUID()
  conversationId!: string;
}

export class DeleteDraftDto {
  @IsUUID()
  conversationId!: string;
}
