import { IsArray, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGroupConversationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty({ each: true })
  memberUserIds!: string[];
}
