import { IsNotEmpty, IsUUID } from 'class-validator';

export class AckRevokeDto {
  @IsUUID()
  @IsNotEmpty()
  messageId!: string;
}
