import { IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class ChatMessageDto {
  @IsString()
  organizationId!: string;

  @IsString()
  content!: string;
}

export class ConversationQueryDto {
  @IsString()
  organizationId!: string;
}
