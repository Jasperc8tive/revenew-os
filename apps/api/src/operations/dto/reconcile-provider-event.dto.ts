import { IsIn, IsOptional, IsString } from 'class-validator';

const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
const PROVIDER_MESSAGE_STATUSES = ['queued', 'sent', 'delivered', 'read', 'failed'] as const;

export class ReconcileProviderEventDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsIn(MESSAGE_DIRECTIONS)
  direction!: (typeof MESSAGE_DIRECTIONS)[number];

  @IsIn(PROVIDER_MESSAGE_STATUSES)
  providerStatus!: (typeof PROVIDER_MESSAGE_STATUSES)[number];

  @IsString()
  providerEventId!: string;
}
