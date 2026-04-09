import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ResolveMessageDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  resolved?: boolean;
}
