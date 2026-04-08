-- Create enums
CREATE TYPE "CopilotRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'PAUSED');
CREATE TYPE "AlertMetric" AS ENUM ('CAC', 'LTV', 'CHURN', 'REVENUE');
CREATE TYPE "AlertOperator" AS ENUM ('GT', 'LT', 'CHANGE_PCT');
CREATE TYPE "AlertEventStatus" AS ENUM ('SENT', 'FAILED');
CREATE TYPE "CompetitorSignalType" AS ENUM ('TRAFFIC', 'HIRING', 'AD_SPEND', 'PRODUCT_LAUNCH', 'OTHER');

-- Create table: industry_benchmarks
CREATE TABLE "industry_benchmarks" (
  "id" TEXT NOT NULL,
  "industry" "Industry" NOT NULL,
  "metric" "AlertMetric" NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "median" DECIMAL(18, 4) NOT NULL,
  "p25" DECIMAL(18, 4) NOT NULL,
  "p75" DECIMAL(18, 4) NOT NULL,
  "sampleCount" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "industry_benchmarks_pkey" PRIMARY KEY ("id")
);

-- Create table: copilot_conversations
CREATE TABLE "copilot_conversations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "copilot_conversations_pkey" PRIMARY KEY ("id")
);

-- Create table: copilot_messages
CREATE TABLE "copilot_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" "CopilotRole" NOT NULL,
  "content" TEXT NOT NULL,
  "contextSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

-- Create table: experiments
CREATE TABLE "experiments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "hypothesis" TEXT NOT NULL,
  "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "targetMetric" "AlertMetric" NOT NULL,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- Create table: experiment_variants
CREATE TABLE "experiment_variants" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isControl" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);

-- Create table: experiment_results
CREATE TABLE "experiment_results" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "metricValue" DECIMAL(18, 4) NOT NULL,
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "experiment_results_pkey" PRIMARY KEY ("id")
);

-- Create table: alert_rules
CREATE TABLE "alert_rules" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "metric" "AlertMetric" NOT NULL,
  "operator" "AlertOperator" NOT NULL,
  "threshold" DECIMAL(18, 4) NOT NULL,
  "channels" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- Create table: alert_events
CREATE TABLE "alert_events" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metricValue" DECIMAL(18, 4) NOT NULL,
  "status" "AlertEventStatus" NOT NULL,
  "deliveryDetails" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- Create table: competitors
CREATE TABLE "competitors" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "industry" "Industry",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- Create table: competitor_signals
CREATE TABLE "competitor_signals" (
  "id" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "signalType" "CompetitorSignalType" NOT NULL,
  "value" TEXT NOT NULL,
  "unit" TEXT,
  "source" TEXT,
  "date" DATE NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "competitor_signals_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "industry_benchmarks_industry_metric_periodStart_periodEnd_key" ON "industry_benchmarks"("industry", "metric", "periodStart", "periodEnd");
CREATE INDEX "industry_benchmarks_industry_metric_idx" ON "industry_benchmarks"("industry", "metric");
CREATE INDEX "industry_benchmarks_periodStart_periodEnd_idx" ON "industry_benchmarks"("periodStart", "periodEnd");

CREATE INDEX "copilot_conversations_organizationId_idx" ON "copilot_conversations"("organizationId");
CREATE INDEX "copilot_conversations_createdAt_idx" ON "copilot_conversations"("createdAt");

CREATE INDEX "copilot_messages_conversationId_idx" ON "copilot_messages"("conversationId");
CREATE INDEX "copilot_messages_createdAt_idx" ON "copilot_messages"("createdAt");

CREATE INDEX "experiments_organizationId_idx" ON "experiments"("organizationId");
CREATE INDEX "experiments_status_idx" ON "experiments"("status");
CREATE INDEX "experiments_createdAt_idx" ON "experiments"("createdAt");

CREATE UNIQUE INDEX "experiment_variants_experimentId_name_key" ON "experiment_variants"("experimentId", "name");
CREATE INDEX "experiment_variants_experimentId_idx" ON "experiment_variants"("experimentId");

CREATE UNIQUE INDEX "experiment_results_variantId_periodStart_periodEnd_key" ON "experiment_results"("variantId", "periodStart", "periodEnd");
CREATE INDEX "experiment_results_variantId_idx" ON "experiment_results"("variantId");
CREATE INDEX "experiment_results_periodStart_periodEnd_idx" ON "experiment_results"("periodStart", "periodEnd");

CREATE INDEX "alert_rules_organizationId_idx" ON "alert_rules"("organizationId");
CREATE INDEX "alert_rules_active_idx" ON "alert_rules"("active");
CREATE INDEX "alert_rules_metric_idx" ON "alert_rules"("metric");

CREATE INDEX "alert_events_ruleId_idx" ON "alert_events"("ruleId");
CREATE INDEX "alert_events_firedAt_idx" ON "alert_events"("firedAt");
CREATE INDEX "alert_events_status_idx" ON "alert_events"("status");

CREATE UNIQUE INDEX "competitors_organizationId_name_key" ON "competitors"("organizationId", "name");
CREATE INDEX "competitors_organizationId_idx" ON "competitors"("organizationId");

CREATE INDEX "competitor_signals_competitorId_idx" ON "competitor_signals"("competitorId");
CREATE INDEX "competitor_signals_signalType_idx" ON "competitor_signals"("signalType");
CREATE INDEX "competitor_signals_date_idx" ON "competitor_signals"("date");

-- Add foreign keys
ALTER TABLE "copilot_conversations"
ADD CONSTRAINT "copilot_conversations_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copilot_messages"
ADD CONSTRAINT "copilot_messages_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "copilot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiments"
ADD CONSTRAINT "experiments_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiment_variants"
ADD CONSTRAINT "experiment_variants_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiment_results"
ADD CONSTRAINT "experiment_results_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "experiment_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alert_rules"
ADD CONSTRAINT "alert_rules_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alert_events"
ADD CONSTRAINT "alert_events_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competitors"
ADD CONSTRAINT "competitors_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competitor_signals"
ADD CONSTRAINT "competitor_signals_competitorId_fkey"
FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
