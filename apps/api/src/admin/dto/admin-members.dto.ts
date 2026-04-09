import { MembershipRole } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class ListMembersQueryDto {
  @IsString()
  organizationId!: string;
}

export class UpdateMemberRoleDto {
  @IsString()
  organizationId!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
