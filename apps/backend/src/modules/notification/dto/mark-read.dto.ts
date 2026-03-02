import { IsArray, IsUUID } from 'class-validator';

export class MarkReadDto {
  @IsArray()
  @IsUUID('all', { each: true })
  notificationIds!: string[];
}
