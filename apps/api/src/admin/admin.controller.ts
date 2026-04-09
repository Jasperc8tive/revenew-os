import { Body, Controller, Get, Param, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../common/guards/jwt.guard';
import { AdminService } from './admin.service';
import { ListMembersQueryDto, UpdateMemberRoleDto } from './dto/admin-members.dto';
import { UpsertWorkspaceSettingsDto, WorkspaceSettingsQueryDto } from './dto/workspace-settings.dto';

@UseGuards(JwtGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('members')
  listMembers(@Query() query: ListMembersQueryDto) {
    return this.adminService.listMembers(query.organizationId);
  }

  @Patch('members/:id/role')
  updateRole(
    @Req() req: Request,
    @Param('id') membershipId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return this.adminService.updateMemberRole({
      organizationId: body.organizationId,
      membershipId,
      role: body.role,
      actorUserId: (req as Request & { user?: { id?: string } }).user?.id,
    });
  }

  @Get('settings')
  getSettings(@Query() query: WorkspaceSettingsQueryDto) {
    return this.adminService.getWorkspaceSettings(query.organizationId);
  }

  @Put('settings')
  upsertSettings(@Req() req: Request, @Body() body: UpsertWorkspaceSettingsDto) {
    return this.adminService.upsertWorkspaceSettings({
      organizationId: body.organizationId,
      organizationDefaults: body.organizationDefaults,
      preferences: body.preferences,
      actorUserId: (req as Request & { user?: { id?: string } }).user?.id,
    });
  }
}
