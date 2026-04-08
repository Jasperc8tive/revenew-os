import { IntegrationProvider } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class ConnectIntegrationDto {
  @IsString()
  organizationId!: string;

  @IsEnum(IntegrationProvider)
  provider!: IntegrationProvider;

  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
