import { IsOptional, IsString } from 'class-validator';

export class ResolveMessageDto {
  @IsOptional()
  @IsString()
  organizationId?: string;
}
