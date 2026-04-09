import { IsIn, IsOptional, IsString } from 'class-validator';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELED'] as const;
const OPERATIONAL_STATES = ['UNASSIGNED', 'QUEUED', 'PROCESSING', 'READY_FOR_DELIVERY', 'COMPLETED'] as const;

export class ListOrdersDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @IsIn(OPERATIONAL_STATES)
  operationalState?: (typeof OPERATIONAL_STATES)[number];

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  sourceConversationId?: string;
}
