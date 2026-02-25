import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendFriendRequestDto {
  @IsUUID()
  targetUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  remark?: string;
}
