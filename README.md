# Revenew OS

AI-powered revenue intelligence platform for Nigerian fintech, SaaS, logistics, and e-commerce companies.

## CI Quality Gates

- UI Crawler QA Gate workflow: [.github/workflows/ui-crawler-qa-gate.yml](.github/workflows/ui-crawler-qa-gate.yml)
- Recommended required status checks on main branch:
  - UI Crawler QA Gate / qa-gate-staging
  - UI Crawler QA Gate / qa-gate-production

Badge template (replace OWNER and REPO):

```markdown
![UI Crawler QA Gate](https://github.com/OWNER/REPO/actions/workflows/ui-crawler-qa-gate.yml/badge.svg)
```

## Overview

Revenew OS is a comprehensive growth intelligence SaaS that helps businesses:

- Track customer acquisition cost (CAC) and lifetime value (LTV)
- Forecast revenue with ML-powered models
- Manage pricing and retention strategies
- Orchestrate growth campaigns via AI agents
- Integrate with 20+ marketing, payment, CRM, and analytics platforms

## Architecture

This is a Turborepo-based monorepo with:

- **Next.js Web**: Growth Command Center UI
- **NestJS API**: Backend service and webhooks
- **Python FastAPI**: AI agents and ML models
- **Shared Packages**: Database (Prisma), analytics engine, and types

## Quick Start

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

# Start local stack
docker-compose up -d

# Run migrations
npm run db:migrate

# Start development servers
npm run dev
```

The stack will be available at:

- Web: <http://localhost:3000>
- API: <http://localhost:3001>
- Agents: <http://localhost:8000>

## Structure

```text
apps/
  ├── web/          # Next.js frontend
  ├── api/          # NestJS backend
  └── agents/       # Python FastAPI agents

packages/
  ├── database/     # Prisma ORM & schema
  ├── analytics/    # Shared metrics engine
  └── shared/       # Types & constants

integrations/     # Third-party connectors
infrastructure/   # Docker, AWS, monitoring
```

## Development

```bash
# Development mode (all services)
npm run dev

# Build all packages
npm run build

# Run tests
npm run test

# Lint code
npm run lint
```

## Analytics CI

- GitHub Actions runs the analytics smoke audit on every push.
- GitHub Actions runs the richer analytics audit and stress audit nightly.
- You can trigger both jobs manually with `workflow_dispatch` from the Actions tab.

## Deployment

See [docs/deployment.md](docs/deployment.md) for AWS, Docker, and production instructions.

## License

Proprietary - Revenew Technologies
