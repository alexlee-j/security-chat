import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * 搜索会话 DTO
 */
export class SearchConversationsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  search!: string;
}
