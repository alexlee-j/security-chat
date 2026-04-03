import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /** 群组类型: 1 = 私密, 2 = 公开 (默认私密) */
  @IsNumber()
  @IsOptional()
  @Min(1)
  type?: number = 1;

  /** 初始成员用户 ID 列表 */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberUserIds?: string[];
}

export class AddGroupMembersDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}

export class RemoveGroupMemberDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class DistributeSenderKeyDto {
  @IsString()
  @IsNotEmpty()
  senderKey!: string;
}
