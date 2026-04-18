import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  messageEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  friendRequestEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  burnEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  groupEnabled?: boolean;
}
