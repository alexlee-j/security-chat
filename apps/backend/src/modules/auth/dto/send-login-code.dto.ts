import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class SendLoginCodeDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  account?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,20}$/)
  phone?: string;
}

