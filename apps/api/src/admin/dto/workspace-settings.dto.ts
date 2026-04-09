import { IsObject, IsString } from 'class-validator';

export class WorkspaceSettingsQueryDto {
  @IsString()
  organizationId!: string;
}

export class UpsertWorkspaceSettingsDto {
  @IsString()
  organizationId!: string;

  @IsObject()
  organizationDefaults!: Record<string, unknown>;

  @IsObject()
  preferences!: Record<string, unknown>;
}
