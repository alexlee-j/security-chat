import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateBurnDefaultDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  burnDuration?: number;
}
