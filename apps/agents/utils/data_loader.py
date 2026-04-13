"""
Data loading utilities — thin SQL wrappers that return plain dicts.
All table and column names match the Prisma @@map() definitions.
"""

from __future__ import annotations

from connectors.db_connector import DBConnector


def load_customers(org_id: str, db: DBConnector) -> list[dict]:
    return db.execute(
        """
        SELECT id, email, first_seen, acquisition_channel, created_at
        FROM customers
        WHERE organization_id = :org_id
        ORDER BY first_seen DESC
        """,
        {"org_id": org_id},
    )


def load_new_customers(org_id: str, db: DBConnector, days: int = 90) -> list[dict]:
    return db.execute(
        """
        SELECT id, email, first_seen, acquisition_channel
        FROM customers
        WHERE organization_id = :org_id
          AND first_seen >= NOW() - CAST(:days || ' days' AS INTERVAL)
        ORDER BY first_seen DESC
        """,
        {"org_id": org_id, "days": days},
    )


def load_customer_events(
    org_id: str, db: DBConnector, days: int = 90
) -> list[dict]:
    return db.execute(
        """
        SELECT customer_id, event_type, timestamp
        FROM customer_events
        WHERE organization_id = :org_id
          AND timestamp >= NOW() - CAST(:days || ' days' AS INTERVAL)
        ORDER BY timestamp DESC
        """,
        {"org_id": org_id, "days": days},
    )


def load_revenue_events(
    org_id: str, db: DBConnector, days: int = 365
) -> list[dict]:
    return db.execute(
        """
        SELECT id, customer_id, type, amount, currency, occurred_at
        FROM revenue_events
        WHERE organization_id = :org_id
          AND occurred_at >= NOW() - CAST(:days || ' days' AS INTERVAL)
        ORDER BY occurred_at ASC
        """,
        {"org_id": org_id, "days": days},
    )


def load_monthly_revenue(org_id: str, db: DBConnector, months: int = 12) -> list[dict]:
    """Aggregate revenue by month, excluding refunds."""
    return db.execute(
        """
        SELECT
            DATE_TRUNC('month', occurred_at) AS month,
            SUM(amount)                       AS revenue,
            COUNT(*)                          AS event_count
        FROM revenue_events
        WHERE organization_id = :org_id
          AND type != 'REFUND'
          AND occurred_at >= NOW() - CAST(:months || ' months' AS INTERVAL)
        GROUP BY DATE_TRUNC('month', occurred_at)
        ORDER BY month ASC
        """,
        {"org_id": org_id, "months": months},
    )


def load_subscriptions(org_id: str, db: DBConnector) -> list[dict]:
    return db.execute(
        """
        SELECT s.id, s.status, s.billing_interval, s.created_at, s.updated_at,
               p.name AS plan_name, p.tier AS plan_tier,
               p.price_monthly, p.price_yearly, p.currency
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.organization_id = :org_id
        ORDER BY s.created_at DESC
        """,
        {"org_id": org_id},
    )


def load_deals(org_id: str, db: DBConnector) -> list[dict]:
    return db.execute(
        """
        SELECT d.id, d.value, d.stage, d.probability, d.close_date, d.created_at,
               ds.name AS stage_name, ds.type AS stage_type, ds.sequence
        FROM deals d
        JOIN deal_stages ds ON d.stage_id = ds.id
        WHERE d.organization_id = :org_id
        ORDER BY d.created_at DESC
        """,
        {"org_id": org_id},
    )


def load_marketing_metrics(
    org_id: str, db: DBConnector, days: int = 30
) -> list[dict]:
    return db.execute(
        """
        SELECT
            mc.name   AS channel_name,
            mc.type   AS channel_type,
            SUM(mm.impressions) AS impressions,
            SUM(mm.clicks)      AS clicks,
            SUM(mm.cost)        AS spend,
            SUM(mm.conversions) AS conversions
        FROM marketing_metrics mm
        JOIN marketing_campaigns camp ON mm.campaign_id = camp.id
        JOIN marketing_channels mc   ON camp.channel_id = mc.id
        WHERE mc.organization_id = :org_id
          AND mm.date >= NOW() - CAST(:days || ' days' AS INTERVAL)
        GROUP BY mc.name, mc.type
        ORDER BY spend DESC
        """,
        {"org_id": org_id, "days": days},
    )


def load_inactive_customers(
    org_id: str, db: DBConnector, inactive_days: int = 30
) -> int:
    """Return count of customers with no events in the last N days."""
    return db.execute_scalar(
        """
        SELECT COUNT(DISTINCT c.id)
        FROM customers c
        LEFT JOIN customer_events e
               ON e.customer_id = c.id
              AND e.timestamp >= NOW() - CAST(:inactive_days || ' days' AS INTERVAL)
        WHERE c.organization_id = :org_id
          AND e.id IS NULL
        """,
        {"org_id": org_id, "inactive_days": inactive_days},
    ) or 0
