import {
  BillingInterval,
  CampaignStatus,
  CurrencyCode,
  Industry,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationSyncStatus,
  MarketingChannelType,
  MembershipRole,
  PlanTier,
  PrismaClient,
  RevenueEventType,
  SubscriptionStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Revenew OS demo fintech data...");

  const user = await prisma.user.upsert({
    where: { email: "admin@demo-fintech.ng" },
    update: {},
    create: {
      email: "admin@demo-fintech.ng",
      passwordHash: "$2b$10$demo.hash.replace.in.production",
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: "Demo Fintech Company",
      industry: Industry.FINTECH,
      memberships: {
        create: {
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      },
      integrations: {
        create: {
          provider: IntegrationProvider.PAYSTACK,
          status: IntegrationStatus.ACTIVE,
          credentials: {
            create: {
              encryptedToken: "enc_demo_paystack_token",
              refreshToken: "demo_refresh_token",
            },
          },
          syncLogs: {
            create: {
              status: IntegrationSyncStatus.SUCCESS,
            },
          },
        },
      },
    },
  });

  const channel = await prisma.marketingChannel.create({
    data: {
      organizationId: organization.id,
      name: "Meta Paid Social",
      type: MarketingChannelType.PAID_SOCIAL,
    },
  });

  const campaignA = await prisma.marketingCampaign.create({
    data: {
      organizationId: organization.id,
      channelId: channel.id,
      name: "Q2 Loan Acquisition",
      status: CampaignStatus.ACTIVE,
      startDate: new Date("2026-04-01"),
    },
  });

  const campaignB = await prisma.marketingCampaign.create({
    data: {
      organizationId: organization.id,
      channelId: channel.id,
      name: "Merchant Wallet Activation",
      status: CampaignStatus.ACTIVE,
      startDate: new Date("2026-04-03"),
    },
  });

  await prisma.marketingMetric.createMany({
    data: [
      {
        organizationId: organization.id,
        campaignId: campaignA.id,
        impressions: 120000,
        clicks: 3600,
        cost: 850000.0,
        conversions: 420,
        date: new Date("2026-04-04"),
      },
      {
        organizationId: organization.id,
        campaignId: campaignB.id,
        impressions: 78000,
        clicks: 2100,
        cost: 520000.0,
        conversions: 280,
        date: new Date("2026-04-05"),
      },
    ],
  });

  const plan = await prisma.plan.upsert({
    where: { tier: PlanTier.Growth },
    update: {},
    create: {
      name: "Growth",
      tier: PlanTier.Growth,
      priceMonthly: 150000,
      priceYearly: 1500000,
      currency: CurrencyCode.NGN,
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.MONTHLY,
      startDate: new Date("2026-04-01"),
    },
  });

  const customer = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      email: "customer@demo-fintech.ng",
      acquisitionChannel: "paid-social",
    },
  });

  await prisma.revenueEvent.createMany({
    data: [
      {
        organizationId: organization.id,
        customerId: customer.id,
        subscriptionId: subscription.id,
        amount: 45000,
        currency: CurrencyCode.NGN,
        eventType: RevenueEventType.SUBSCRIPTION_STARTED,
        timestamp: new Date("2026-04-04T10:00:00Z"),
      },
      {
        organizationId: organization.id,
        customerId: customer.id,
        subscriptionId: subscription.id,
        amount: 45000,
        currency: CurrencyCode.NGN,
        eventType: RevenueEventType.SUBSCRIPTION_RENEWED,
        timestamp: new Date("2026-04-05T10:00:00Z"),
      },
    ],
  });

  console.log("Seed complete");
  console.log(`Organization: ${organization.name} (${organization.id})`);
  console.log(`Campaigns: ${campaignA.name}, ${campaignB.name}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
