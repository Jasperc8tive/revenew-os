CREATE TABLE "webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "reference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_provider_eventId_key" ON "webhook_events"("provider", "eventId");
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events"("provider");
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");
CREATE INDEX "webhook_events_createdAt_idx" ON "webhook_events"("createdAt");
