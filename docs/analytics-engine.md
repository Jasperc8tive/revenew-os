<!-- markdownlint-disable -->

# Analytics Engine

## Overview

The analytics engine is a shared package calculating critical SaaS metrics in real-time.

## Core Metrics

### Customer Acquisition Cost (CAC)
```
CAC = Total Marketing Spend / New Customers Acquired
```
- Calculated per channel, campaign, and time period
- Aggregated monthly and yearly
- Used by acquisition and marketing agents

### Lifetime Value (LTV)
```
LTV = Average Revenue Per User × Gross Margin / Churn Rate
```
- Calculated per cohort
- Segmented by product/plan
- Used by retention and pricing agents

### Churn Rate
```
Churn = Churned Customers / Started Customers
```
- Calculated monthly and annually
- Segmented by reason, cohort, plan
- Used by retention agent

### Revenue Metrics
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Net Revenue Retention (NRR)
- Net New Revenue

### Conversion Metrics
- Funnel conversion rates
- Attribution by source
- Channel efficiency

## Implementation

Located in `packages/analytics/src/`:

- `cac.ts` - Customer acquisition cost calculations
- `ltv.ts` - Lifetime value calculations
- `churn.ts` - Churn rate analysis
- `revenue.ts` - Revenue aggregation
- `forecasting.ts` - Predictive analytics

## Data Sources

- Marketing platforms: spend and clicks
- Payment processors: transactions and refunds
- CRM: customer lifecycle events
- Analytics: user events and behaviors
- Custom integrations: domain-specific data

## Performance

- Results cached in Redis
- Incremental updates on new data
- Batch calculations nightly
- Real-time charts using aggregated data

## Customization

Metrics can be customized per organization:
- Attribution model
- Revenue recognition rules
- Churn definitions
- Segments and filters
