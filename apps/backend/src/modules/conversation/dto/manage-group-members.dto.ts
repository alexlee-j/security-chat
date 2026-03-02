import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AddGroupMembersDto {
  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty({ each: true })
  userIds!: string[];
}

export class RemoveGroupMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}

export class ListGroupMembersDto {
  @IsUUID()
  @IsNotEmpty()
  conversationId!: string;
}
