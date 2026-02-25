import { IsUUID } from 'class-validator';

export class ConsumePrekeyDto {
  @IsUUID()
  preKeyId!: string;
}
