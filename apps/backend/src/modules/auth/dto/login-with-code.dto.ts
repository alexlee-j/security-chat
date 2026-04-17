import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class LoginWithCodeDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  account?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,20}$/)
  phone?: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;

  @IsUUID()
  deviceId!: string;
}
