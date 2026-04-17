import { IsString, IsUUID } from 'class-validator';

export class SendMessageEnvelopeDto {
  @IsUUID()
  targetUserId!: string;

  @IsUUID()
  targetDeviceId!: string;

  @IsString()
  encryptedPayload!: string;
}
