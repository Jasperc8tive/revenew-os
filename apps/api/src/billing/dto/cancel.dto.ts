import { IsOptional, IsString } from 'class-validator';

export class CancelDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
