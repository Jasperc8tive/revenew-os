import { IsIn, IsOptional, IsString } from 'class-validator';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELED'] as const;

export class UpdateOrderStatusDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsIn(ORDER_STATUSES)
  status!: (typeof ORDER_STATUSES)[number];
}
