-- Analytics performance indexes

-- MarketingMetric indexes
CREATE INDEX "marketing_metrics_organization_id_date_idx"
ON "marketing_metrics"("organizationId", "date");

CREATE INDEX "marketing_metrics_campaign_id_date_idx"
ON "marketing_metrics"("campaignId", "date");

CREATE INDEX "marketing_metrics_organization_id_campaign_id_date_idx"
ON "marketing_metrics"("organizationId", "campaignId", "date");

-- CustomerEvent indexes
CREATE INDEX "customer_events_organization_id_timestamp_idx"
ON "customer_events"("organizationId", "timestamp");

CREATE INDEX "customer_events_organization_id_event_type_timestamp_idx"
ON "customer_events"("organizationId", "eventType", "timestamp");

CREATE INDEX "customer_events_customer_id_timestamp_idx"
ON "customer_events"("customerId", "timestamp");

-- RevenueEvent indexes
CREATE INDEX "revenue_events_subscription_id_idx"
ON "revenue_events"("subscriptionId");

CREATE INDEX "revenue_events_organization_id_timestamp_idx"
ON "revenue_events"("organizationId", "timestamp");

CREATE INDEX "revenue_events_organization_id_event_type_timestamp_idx"
ON "revenue_events"("organizationId", "eventType", "timestamp");

CREATE INDEX "revenue_events_organization_id_customer_id_timestamp_idx"
ON "revenue_events"("organizationId", "customerId", "timestamp");
