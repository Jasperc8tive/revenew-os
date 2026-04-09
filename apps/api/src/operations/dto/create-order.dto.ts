import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  customerEmail!: string;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  items?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  sourceMessageId?: string;

  @IsOptional()
  @IsString()
  sourceConversationId?: string;
}
