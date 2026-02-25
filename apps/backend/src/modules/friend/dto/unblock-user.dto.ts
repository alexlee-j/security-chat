import { IsUUID } from 'class-validator';

export class UnblockUserDto {
  @IsUUID()
  targetUserId!: string;
}
