import { IsUUID } from 'class-validator';

export class CreateDirectConversationDto {
  @IsUUID()
  peerUserId!: string;
}
