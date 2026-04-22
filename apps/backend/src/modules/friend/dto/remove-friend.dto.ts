import { IsUUID } from 'class-validator';

export class RemoveFriendDto {
  @IsUUID()
  targetUserId!: string;
}
