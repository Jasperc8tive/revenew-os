import { IsIn, IsOptional, IsString } from 'class-validator';

const MESSAGE_CHANNELS = ['whatsapp', 'sms', 'email'] as const;

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  customerEmail!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsIn(MESSAGE_CHANNELS)
  channel?: (typeof MESSAGE_CHANNELS)[number];

  @IsOptional()
  @IsString()
  source?: string;
}
