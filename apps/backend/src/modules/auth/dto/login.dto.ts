import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  account?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,20}$/)
  phone?: string;

  @IsString()
  @Length(8, 64)
  password!: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;
}
