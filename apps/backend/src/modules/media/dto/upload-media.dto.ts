import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export class UploadMediaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([2, 3, 4])
  mediaKind?: number;
}
