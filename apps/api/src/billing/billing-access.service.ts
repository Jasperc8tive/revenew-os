import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlanTier, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { STARTER_INTEGRATION_LIMIT } from './billing.constants';

export type BillingFeature =
  | 'analytics.basic'
  | 'analytics.full'
  | 'integrations.list'
  | 'integrations.connect'
  | 'ai.full'
  | 'forecasting.advanced';

@Injectable()
export class BillingAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertFeatureAccess(organizationId: string, feature: BillingFeature) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        organizationId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE],
        },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new ForbiddenException('Active subscription required');
    }

    const tier = subscription.plan.tier;

    if (feature === 'analytics.basic' || feature === 'integrations.list') {
      return true;
    }

    if (feature === 'analytics.full' || feature === 'ai.full') {
      if (tier === PlanTier.Starter) {
        throw new ForbiddenException('Upgrade to Growth or Enterprise to access advanced analytics and AI insights');
      }
      return true;
    }

    if (feature === 'forecasting.advanced') {
      if (tier !== PlanTier.Enterprise) {
        throw new ForbiddenException('Enterprise plan required for advanced forecasting');
      }
      return true;
    }

    if (feature === 'integrations.connect' && tier === PlanTier.Starter) {
      const integrationCount = await this.prisma.integration.count({
        where: {
          organizationId,
        },
      });

      if (integrationCount >= STARTER_INTEGRATION_LIMIT) {
        throw new ForbiddenException(`Starter plan supports up to ${STARTER_INTEGRATION_LIMIT} integrations`);
      }
    }

    return true;
  }
}
