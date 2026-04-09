import { ForbiddenException, Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';

interface WorkspaceSettingsRow {
  organization_id: string;
  organization_defaults: unknown;
  preferences: unknown;
  updated_at: Date;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  async listMembers(organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');

    return this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMemberRole(input: {
    organizationId: string;
    membershipId: string;
    role: MembershipRole;
    actorUserId?: string;
  }) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');
    await this.assertWorkspaceAdmin(input.organizationId, input.actorUserId);

    await this.prisma.membership.updateMany({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId,
      },
      data: {
        role: input.role,
      },
    });

    return this.prisma.membership.findFirst({
      where: {
        id: input.membershipId,
        organizationId: input.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  async getWorkspaceSettings(organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');

    await this.ensureSettingsTable();
    const row = await this.fetchOrCreateSettings(organizationId);

    return {
      organizationId,
      organizationDefaults: this.normalizeObject(row.organization_defaults),
      preferences: this.normalizeObject(row.preferences),
      updatedAt: row.updated_at,
    };
  }

  async upsertWorkspaceSettings(input: {
    organizationId: string;
    organizationDefaults: Record<string, unknown>;
    preferences: Record<string, unknown>;
    actorUserId?: string;
  }) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');
    await this.assertWorkspaceAdmin(input.organizationId, input.actorUserId);

    await this.ensureSettingsTable();
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO workspace_settings (organization_id, organization_defaults, preferences)
      VALUES ($1, $2::jsonb, $3::jsonb)
      ON CONFLICT (organization_id)
      DO UPDATE SET
        organization_defaults = EXCLUDED.organization_defaults,
        preferences = EXCLUDED.preferences,
        updated_at = NOW()
      `,
      input.organizationId,
      JSON.stringify(input.organizationDefaults),
      JSON.stringify(input.preferences),
    );

    return this.getWorkspaceSettings(input.organizationId);
  }

  private async ensureSettingsTable() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS workspace_settings (
        organization_id TEXT PRIMARY KEY,
        organization_defaults JSONB NOT NULL,
        preferences JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async fetchOrCreateSettings(organizationId: string): Promise<WorkspaceSettingsRow> {
    const rows = await this.prisma.$queryRawUnsafe<WorkspaceSettingsRow[]>(
      `
      SELECT organization_id, organization_defaults, preferences, updated_at
      FROM workspace_settings
      WHERE organization_id = $1
      LIMIT 1
      `,
      organizationId,
    );

    if (rows[0]) {
      return rows[0];
    }

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO workspace_settings (organization_id, organization_defaults, preferences)
      VALUES ($1, $2::jsonb, $3::jsonb)
      ON CONFLICT (organization_id) DO NOTHING
      `,
      organizationId,
      JSON.stringify({
        defaultCurrency: 'NGN',
        defaultTimezone: 'Africa/Lagos',
      }),
      JSON.stringify({
        notifications: {
          email: true,
          sms: false,
          alertDigestHour: 9,
        },
        dataBehavior: {
          autoResolveAfterHours: 24,
          strictQualityMode: false,
        },
      }),
    );

    const inserted = await this.prisma.$queryRawUnsafe<WorkspaceSettingsRow[]>(
      `
      SELECT organization_id, organization_defaults, preferences, updated_at
      FROM workspace_settings
      WHERE organization_id = $1
      LIMIT 1
      `,
      organizationId,
    );

    return inserted[0];
  }

  private normalizeObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private async assertWorkspaceAdmin(organizationId: string, actorUserId?: string) {
    if (!actorUserId) {
      throw new ForbiddenException('Authenticated actor identity is required.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
      },
      select: {
        role: true,
      },
    });

    const allowedRoles: MembershipRole[] = [MembershipRole.OWNER, MembershipRole.ADMIN];

    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Only workspace owner or admin can perform this action.');
    }
  }
}
