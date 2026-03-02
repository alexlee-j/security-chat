import { IsString, IsIn, IsOptional, IsObject } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsIn(['friend_request', 'message', 'system', 'burn', 'group'])
  type!: 'friend_request' | 'message' | 'system' | 'burn' | 'group';

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
