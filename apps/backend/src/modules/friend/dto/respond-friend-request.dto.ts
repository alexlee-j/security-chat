import { IsBoolean, IsUUID } from 'class-validator';

export class RespondFriendRequestDto {
  @IsUUID()
  requesterUserId!: string;

  @IsBoolean()
  accept!: boolean;
}
