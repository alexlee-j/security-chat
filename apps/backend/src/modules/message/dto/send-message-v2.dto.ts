import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SendMessageEnvelopeDto } from './send-message-envelope.dto';

export class SendMessageV2Dto {
  @IsUUID()
  conversationId!: string;

  @IsIn([1, 2, 3, 4])
  messageType!: number;

  @IsString()
  nonce!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SendMessageEnvelopeDto)
  envelopes!: SendMessageEnvelopeDto[];

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
