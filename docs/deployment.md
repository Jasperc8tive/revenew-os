<!-- markdownlint-disable -->

# Deployment Guide

## Development Environment

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Docker & Docker Compose

### Setup
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start services
docker-compose up -d

# Run migrations
npm run db:migrate

# Start development
npm run dev
```

## Production Deployment

### AWS ECS Deployment

1. **Build Docker images**
```bash
docker build -f infrastructure/docker/Dockerfile.web -t revenew-web:latest .
docker build -f infrastructure/docker/Dockerfile.api -t revenew-api:latest .
docker build -f infrastructure/docker/Dockerfile.agents -t revenew-agents:latest .
```

2. **Push to ECR**
```bash
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account_id>.dkr.ecr.us-west-2.amazonaws.com
docker tag revenew-web:latest <account_id>.dkr.ecr.us-west-2.amazonaws.com/revenew-web:latest
docker push <account_id>.dkr.ecr.us-west-2.amazonaws.com/revenew-web:latest
```

3. **Deploy with Terraform**
```bash
cd infrastructure/aws
terraform init
terraform plan
terraform apply
```

4. **Database migrations**
```bash
npm run db:migrate -- --env production
```

### Infrastructure Stack

- **Compute**: AWS ECS with Fargate
- **Database**: Amazon RDS PostgreSQL
- **Cache**: Amazon ElastiCache Redis
- **CDN**: CloudFront
- **Load Balancer**: Application Load Balancer
- **Monitoring**: CloudWatch + Grafana

### Environment Variables

Required for production:
- `DATABASE_URL` - RDS endpoint
- `REDIS_URL` - ElastiCache endpoint
- `JWT_SECRET` - Secure random string
- API keys for all integrations (see `.env.example`)

### Monitoring & Observability

1. **Metrics**: Prometheus (infrastructure/monitoring/prometheus.yml)
2. **Logs**: CloudWatch or ELK stack
3. **Dashboards**: Grafana (infrastructure/monitoring/grafana/)
4. **Tracing**: Optional OpenTelemetry integration

### SSL/TLS

- Use AWS Certificate Manager
- Configure in ALB listener
- Auto-renewal enabled

### Backup & Disaster Recovery

- Daily RDS automated backups
- 30-day retention
- Cross-region replication enabled
- Test recovery monthly

### Scaling

- Auto-scaling groups for ECS tasks
- Horizontal scaling based on CPU/memory
- Database read replicas for analytics queries
- Redis cluster for cache scaling

### Health Checks

- ALB health checks: `/api/health`
- ECS container health: Port 3001 (API)
- Application monitoring via CloudWatch

### Zero-Downtime Deployments

1. Update task definition
2. Blue-green deployment via ECS
3. Gradual traffic shift
4. Automatic rollback on failures

### Release Ownership & On-Call Coverage

Every production rollout must have the following roles assigned before the deployment window opens:

| Responsibility | Required owner | Responsibility during rollout |
|----------------|----------------|-------------------------------|
| Release commander | Engineering lead for the release | Owns the go/no-go call, tracks checklist completion, coordinates rollback if needed |
| Database owner | Backend engineer shipping the migration | Runs `npx prisma migrate deploy`, validates schema health, and approves database rollback decisions |
| API owner | Backend/API on-call engineer | Monitors API health, logs, queue behavior, and analytics endpoint correctness |
| Web owner | Frontend engineer for the release | Verifies dashboard and verification UI smoke flows after deploy |
| Platform owner | Infrastructure/platform engineer | Monitors ECS, RDS, Redis, load balancer health, and executes infra rollback if required |
| Product/comms owner | Product or delivery lead | Confirms customer impact posture and communicates release status if rollback is triggered |

Minimum coverage rules for the first production rollout of any new analytics or reliability feature:

- A primary on-call engineer must be active for the full deployment window and for the first 60 minutes after release.
- A secondary on-call engineer must be reachable for escalation during the same window.
- The release commander and database owner cannot both be absent during migration execution.
- If any required owner is unavailable, the rollout is automatically a no-go.

Pre-release assignment record:

- [ ] Release commander assigned
- [ ] Database owner assigned
- [ ] API owner assigned
- [ ] Web owner assigned
- [ ] Platform owner assigned
- [ ] Product/comms owner assigned
- [ ] Primary on-call confirmed
- [ ] Secondary on-call confirmed
- [ ] Deployment window start/end documented
- [ ] Rollback decision channel agreed (`Slack`, `Teams`, or incident bridge)

Rollback authority:

- The release commander can initiate application rollback immediately on failed smoke tests or elevated error rate.
- The database owner can halt migration rollout or request restore-from-snapshot when schema/data integrity is in doubt.
- The platform owner can revert to the previous ECS task definition or infrastructure revision without waiting for feature-level diagnosis.

---

## Billing & Webhook Production Runbook

### Pre-Deploy Checklist (Billing)

Before releasing any version that includes billing or payment changes:

- [ ] Run `npm run db:migrate` (or `npx prisma migrate deploy` inside `packages/database`) **before** starting new API containers — the `webhook_events` table must exist before `PaymentService` starts handling requests.
- [ ] Confirm `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are set in the production environment.
- [ ] Verify provider dashboard webhook URLs point to `https://<your-domain>/webhooks/billing/:provider` (e.g. `/webhooks/billing/paystack`).

### Database Migration Order

```bash
# 1. Run from repo root — applies all pending migrations
cd packages/database
npx prisma migrate deploy

# 2. Regenerate Prisma client (already bundled in the API Docker image if built after migration)
npx prisma generate
```

> **Important**: Always migrate before deploying a new API image. The `webhook_events` table is required at startup.

### Webhook Idempotency

Each incoming webhook is deduplicated via the `webhook_events` table using a `(provider, eventId)` unique constraint.

| Status | Meaning |
|--------|---------|
| `RECEIVED` | Webhook accepted, processing in progress |
| `PROCESSED` | Successfully handled; replay returns `{ idempotent: true }` without re-processing |
| `FAILED` | Processing threw an error; safe to retry from provider dashboard |

**Retry behaviour**: If a provider retries a webhook that previously reached `PROCESSED`, the API returns HTTP 200 with `{ processed: true, idempotent: true }` immediately — no duplicate charges or state changes occur.

**Failure recovery**: Webhooks in `FAILED` status were not fully processed. Re-send them from the provider dashboard (Paystack → Logs, Flutterwave → Webhooks, Stripe → Developers → Webhooks). They will be re-processed because the record status is not `PROCESSED`.

### Webhook Signature Verification

All three providers require signature headers. A missing or invalid signature returns HTTP 400. Ensure provider secrets match exactly:

| Provider | Secret env var | Header name | Algorithm |
|----------|---------------|-------------|-----------|
| Paystack | `PAYSTACK_SECRET_KEY` | `x-paystack-signature` | HMAC-SHA512 |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY` | `verif-hash` | HMAC-SHA256 |
| Stripe | `STRIPE_WEBHOOK_SECRET` | `stripe-signature` | HMAC-SHA256 |

### Monitoring Webhook Health

Query the `webhook_events` table for operational visibility:

```sql
-- Recent failed webhooks
SELECT provider, event_type, reference, created_at
FROM webhook_events
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 50;

-- Idempotent replay rate (last 24h)
SELECT provider, COUNT(*) AS replays
FROM webhook_events
WHERE status = 'PROCESSED'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;
```

Set a CloudWatch / Grafana alert if `FAILED` webhook count exceeds threshold (recommended: alert at > 5 failures in a 10-minute window).

### Billing Plan Gating

Feature access is enforced in `BillingAccessService`. If a plan check blocks a customer unexpectedly:

1. Confirm `Subscription.planTier` in the database matches the expected tier.
2. Check that `BILLING_PLAN_PRICES` constants are consistent with what was recorded at subscribe time.
3. Use `GET /billing/plans` to verify which features are available on each tier.
