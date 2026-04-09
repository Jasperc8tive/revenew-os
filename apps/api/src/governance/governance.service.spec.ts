import { ForbiddenException } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GovernanceService } from './governance.service';

describe('GovernanceService RBAC', () => {
  let service: GovernanceService;

  const prismaMock = {
    membership: {
      findFirst: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(async () => 1),
    $queryRawUnsafe: jest.fn(async () => []),
  } as unknown as PrismaService;

  const billingMock = {
    assertFeatureAccess: jest.fn(async () => true),
  } as unknown as BillingAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GovernanceService(prismaMock, billingMock);
  });

  it('allows staff read access to governance listings', async () => {
    const membershipFindFirst = prismaMock.membership.findFirst as unknown as jest.Mock;
    membershipFindFirst.mockImplementation(async () => ({ role: MembershipRole.STAFF }));

    await expect(service.listWeeklyReviews('org-1', 'staff-1')).resolves.toEqual([]);
  });

  it('rejects staff from mutating quality gates', async () => {
    const membershipFindFirst = prismaMock.membership.findFirst as unknown as jest.Mock;
    membershipFindFirst.mockImplementation(async () => ({ role: MembershipRole.STAFF }));

    await expect(
      service.upsertQualityGate({
        organizationId: 'org-1',
        feature: 'growth-graph',
        testsPassed: true,
        observabilityReady: true,
        rollbackReady: true,
        actorUserId: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows owner mutation of governance controls', async () => {
    const rows = [{ feature: 'growth-graph' }];
    const membershipFindFirst = prismaMock.membership.findFirst as unknown as jest.Mock;
    const queryRawUnsafe = prismaMock.$queryRawUnsafe as unknown as jest.Mock;
    membershipFindFirst.mockImplementation(async () => ({ role: MembershipRole.OWNER }));
    queryRawUnsafe.mockImplementation(async () => rows);

    await expect(
      service.upsertQualityGate({
        organizationId: 'org-1',
        feature: 'growth-graph',
        testsPassed: true,
        observabilityReady: true,
        rollbackReady: true,
        actorUserId: 'owner-1',
      }),
    ).resolves.toEqual(rows);
  });
});
