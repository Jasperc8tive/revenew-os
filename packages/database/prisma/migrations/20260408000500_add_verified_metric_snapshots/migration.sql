-- CreateEnum
CREATE TYPE "VerifiedMetricWindow" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "verified_metric_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "windowType" "VerifiedMetricWindow" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "metricValue" DECIMAL(18,4) NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "sourceTables" JSONB NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "dataQualityFlags" JSONB,
    "inputs" JSONB,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verified_metric_snapshots_organizationId_metricKey_windowType_wi_key" ON "verified_metric_snapshots"("organizationId", "metricKey", "windowType", "windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "verified_metric_snapshots_organizationId_windowType_windowSta_idx" ON "verified_metric_snapshots"("organizationId", "windowType", "windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "verified_metric_snapshots_metricKey_idx" ON "verified_metric_snapshots"("metricKey");

-- CreateIndex
CREATE INDEX "verified_metric_snapshots_verifiedAt_idx" ON "verified_metric_snapshots"("verifiedAt");

-- AddForeignKey
ALTER TABLE "verified_metric_snapshots" ADD CONSTRAINT "verified_metric_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
