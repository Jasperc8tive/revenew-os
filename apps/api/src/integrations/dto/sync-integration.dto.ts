import { IsOptional, IsString } from 'class-validator';

export class SyncIntegrationDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  initiatedBy?: string;
}
