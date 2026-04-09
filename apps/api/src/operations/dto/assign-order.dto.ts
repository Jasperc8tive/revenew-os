import { IsOptional, IsString } from 'class-validator';

export class AssignOrderDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  assigneeId!: string;
}
