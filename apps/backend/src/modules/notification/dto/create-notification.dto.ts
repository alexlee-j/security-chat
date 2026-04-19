import { IsString, IsIn, IsOptional, IsObject } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsIn(['friend_request', 'message', 'system', 'burn', 'group', 'account_recovery', 'security_event', 'group_lifecycle'])
  type!: 'friend_request' | 'message' | 'system' | 'burn' | 'group' | 'account_recovery' | 'security_event' | 'group_lifecycle';

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
