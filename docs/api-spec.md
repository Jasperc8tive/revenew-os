<!-- markdownlint-disable -->

# API Specification

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://api.revenew.io/api`

## Authentication

All endpoints require JWT bearer token in Authorization header:

```http
Authorization: Bearer <jwt_token>
```

## Core Endpoints

### Auth Endpoints

- `POST /auth/register` - Register new account
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token

### Organizations

- `GET /organizations` - List user's organizations
- `POST /organizations` - Create new organization
- `GET /organizations/:id` - Get organization details
- `PATCH /organizations/:id` - Update organization

### Users

- `GET /users/me` - Get current user
- `PATCH /users/me` - Update current user
- `GET /organizations/:orgId/users` - List org users
- `POST /organizations/:orgId/users` - Invite user

### Analytics & Metrics

- `GET /analytics/metrics` - Get all organization metrics
- `GET /analytics/metrics/:metricId` - Get specific metric
- `GET /analytics/revenue` - Revenue aggregation
- `GET /analytics/churn` - Churn analysis
- `GET /analytics/cac` - Customer acquisition cost
- `GET /analytics/ltv` - Lifetime value

### Integrations

- `GET /integrations` - List available integrations
- `GET /integrations/:org/connected` - List connected integrations
- `POST /integrations/:org/connect` - Connect integration
- `DELETE /integrations/:org/:id` - Disconnect integration

### AI Agents & Recommendations
- `GET /agents/status` - Agent execution status
- `POST /agents/run` - Trigger agent execution
- `GET /recommendations` - Get AI recommendations
- `GET /recommendations/:id` - Get recommendation details

### Webhooks
- `POST /webhooks` - Create webhook
- `GET /webhooks` - List webhooks
- `DELETE /webhooks/:id` - Delete webhook

## Response Standards

All responses follow JSON format:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2026-04-06T10:30:00Z"
}
```

## Error Codes
- 400: Bad request
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 500: Internal server error

## Rate Limiting
- 100 requests per minute per user
- 1000 requests per minute per organization
