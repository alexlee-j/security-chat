import { IsUUID } from 'class-validator';

export class AttachMediaDto {
  @IsUUID()
  conversationId!: string;
}
