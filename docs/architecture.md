# Revenew OS Architecture

## System Overview

Revenew OS is a distributed SaaS platform following a three-tier architecture:

### Tier 1: Frontend (Next.js)

- Server-side rendering (SSR) and static site generation (SSG)
- Real-time dashboards and data visualization
- User authentication and authorization
- Integration management UI

### Tier 2: Backend (NestJS)

- RESTful API endpoints
- Business logic and data orchestration
- Webhook management
- Authentication & authorization
- Database ORM via Prisma

### Tier 3: AI Agents (Python FastAPI)

- ML model inference
- Revenue forecasting
- Customer churn prediction
- Growth recommendations
- Async job processing

## Data Flow

1. User interacts with Next.js frontend
2. Frontend calls NestJS API endpoints
3. API orchestrates data from multiple integrations
4. Python agents process ML models asynchronously
5. Results cached in Redis for performance
6. Real-time updates via WebSockets

## Integrations Layer

20+ connectors for:

- Marketing platforms (Google Ads, Meta, TikTok, LinkedIn, Twitter)
- Payment processors (Paystack, Flutterwave, Stripe, Monnify, Interswitch)
- CRM systems (HubSpot, Salesforce, Zoho, Pipedrive)
- Analytics (Google Analytics, Mixpanel, Amplitude, PostHog)
- Messaging (Twilio, Termii, SendGrid, Mailchimp)
- Data warehouses (Snowflake, BigQuery, Redshift, Databricks)

## Database Schema

PostgreSQL with Prisma ORM.
See `packages/database/prisma/schema.prisma` for schema definition.

Key entities:

- Organizations (multi-tenant)
- Users & Roles
- Integrations & Credentials
- Metrics & Dashboards
- AI Agent Results
- Audit Logs

## Caching & Performance

- Redis for session management
- Query result caching
- Async job queue processing
