import { IsBoolean, IsOptional } from 'class-validator';

/**
 * 更新会话设置 DTO（置顶/静音）
 */
export class UpdateConversationSettingsDto {
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isMuted?: boolean;
}
