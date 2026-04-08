-- CreateEnum
CREATE TYPE "DataQualityEventType" AS ENUM ('VALIDATION', 'ANOMALY');

-- CreateEnum
CREATE TYPE "DataQualitySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DataQualitySource" AS ENUM ('INGESTION', 'ANALYTICS', 'INTEGRATION_MONITORING');

-- AlterTable
ALTER TABLE "agent_insights" ADD COLUMN     "confidenceScore" DECIMAL(6,4),
ADD COLUMN     "dataPoints" INTEGER,
ADD COLUMN     "dataWindowEnd" TIMESTAMP(3),
ADD COLUMN     "dataWindowStart" TIMESTAMP(3),
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "explanationAction" TEXT,
ADD COLUMN     "explanationWhat" TEXT,
ADD COLUMN     "explanationWhy" TEXT,
ADD COLUMN     "suppressionReason" TEXT,
ADD COLUMN     "traceId" TEXT;

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "assumptions" JSONB,
ADD COLUMN     "confidenceScore" DECIMAL(6,4),
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "priority" INTEGER,
ADD COLUMN     "rationale" TEXT,
ADD COLUMN     "traceId" TEXT;

-- CreateTable
CREATE TABLE "data_quality_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT,
    "dedupeKey" TEXT,
    "eventType" "DataQualityEventType" NOT NULL,
    "severity" "DataQualitySeverity" NOT NULL,
    "source" "DataQualitySource" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_quality_events_organizationId_idx" ON "data_quality_events"("organizationId");

-- CreateIndex
CREATE INDEX "data_quality_events_integrationId_idx" ON "data_quality_events"("integrationId");

-- CreateIndex
CREATE INDEX "data_quality_events_eventType_idx" ON "data_quality_events"("eventType");

-- CreateIndex
CREATE INDEX "data_quality_events_severity_idx" ON "data_quality_events"("severity");

-- CreateIndex
CREATE INDEX "data_quality_events_source_idx" ON "data_quality_events"("source");

-- CreateIndex
CREATE INDEX "data_quality_events_occurredAt_idx" ON "data_quality_events"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "data_quality_events_organizationId_code_dedupeKey_key" ON "data_quality_events"("organizationId", "code", "dedupeKey");

-- CreateIndex
CREATE INDEX "agent_insights_traceId_idx" ON "agent_insights"("traceId");

-- CreateIndex
CREATE INDEX "recommendations_traceId_idx" ON "recommendations"("traceId");

-- AddForeignKey
ALTER TABLE "data_quality_events" ADD CONSTRAINT "data_quality_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_events" ADD CONSTRAINT "data_quality_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "customer_events_customer_id_timestamp_idx" RENAME TO "customer_events_customerId_timestamp_idx";

-- RenameIndex
ALTER INDEX "customer_events_organization_id_event_type_timestamp_idx" RENAME TO "customer_events_organizationId_eventType_timestamp_idx";

-- RenameIndex
ALTER INDEX "customer_events_organization_id_timestamp_idx" RENAME TO "customer_events_organizationId_timestamp_idx";

-- RenameIndex
ALTER INDEX "marketing_metrics_campaign_id_date_idx" RENAME TO "marketing_metrics_campaignId_date_idx";

-- RenameIndex
ALTER INDEX "marketing_metrics_organization_id_campaign_id_date_idx" RENAME TO "marketing_metrics_organizationId_campaignId_date_idx";

-- RenameIndex
ALTER INDEX "marketing_metrics_organization_id_date_idx" RENAME TO "marketing_metrics_organizationId_date_idx";

-- RenameIndex
ALTER INDEX "revenue_events_organization_id_customer_id_timestamp_idx" RENAME TO "revenue_events_organizationId_customerId_timestamp_idx";

-- RenameIndex
ALTER INDEX "revenue_events_organization_id_event_type_timestamp_idx" RENAME TO "revenue_events_organizationId_eventType_timestamp_idx";

-- RenameIndex
ALTER INDEX "revenue_events_organization_id_timestamp_idx" RENAME TO "revenue_events_organizationId_timestamp_idx";

-- RenameIndex
ALTER INDEX "revenue_events_subscription_id_idx" RENAME TO "revenue_events_subscriptionId_idx";