import { IsArray, IsObject, IsOptional, IsString, IsUUID, ValidateNested, MaxLength, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class SignedPrekeyDto {
  @IsNumber()
  keyId!: number;

  @IsString()
  @MaxLength(4096)
  publicKey!: string;

  @IsString()
  @MaxLength(4096)
  signature!: string;
}

class OneTimePrekeyDto {
  @IsNumber()
  keyId!: number;

  @IsString()
  @MaxLength(4096)
  publicKey!: string;
}

class KyberPrekeyDto {
  @IsNumber()
  keyId!: number;

  @IsString()
  @MaxLength(8192)
  publicKey!: string;

  @IsString()
  @MaxLength(8192)
  signature!: string;
}

export class UploadPrekeysDto {
  @IsUUID()
  deviceId!: string;

  @IsString()
  @MaxLength(4096)
  @IsOptional()
  identityKey?: string;

  @ValidateNested()
  @Type(() => SignedPrekeyDto)
  @IsOptional()
  signedPrekey?: SignedPrekeyDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OneTimePrekeyDto)
  @IsOptional()
  oneTimePrekeys?: OneTimePrekeyDto[];

  @ValidateNested()
  @Type(() => KyberPrekeyDto)
  @IsOptional()
  kyberPrekey?: KyberPrekeyDto;
}
