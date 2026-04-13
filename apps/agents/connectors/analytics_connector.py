"""
Analytics connector — queries pre-aggregated metric snapshots and
daily/weekly/monthly metric tables from the Revenew OS database.
"""

from __future__ import annotations

from connectors.db_connector import DBConnector


class AnalyticsConnector:
    """Fetches data from the analytics metric tables."""

    def __init__(self, db: DBConnector) -> None:
        self.db = db

    def get_daily_metrics(self, org_id: str, days: int = 30) -> list[dict]:
        return self.db.execute(
            """
            SELECT *
            FROM daily_metrics
            WHERE organization_id = :org_id
              AND date >= NOW() - INTERVAL ':days days'
            ORDER BY date ASC
            """,
            {"org_id": org_id, "days": days},
        )

    def get_monthly_metrics(self, org_id: str, months: int = 12) -> list[dict]:
        return self.db.execute(
            """
            SELECT *
            FROM monthly_metrics
            WHERE organization_id = :org_id
              AND month >= NOW() - INTERVAL ':months months'
            ORDER BY month ASC
            """,
            {"org_id": org_id, "months": months},
        )

    def get_verified_snapshots(self, org_id: str, limit: int = 10) -> list[dict]:
        return self.db.execute(
            """
            SELECT *
            FROM verified_metric_snapshots
            WHERE organization_id = :org_id
            ORDER BY captured_at DESC
            LIMIT :limit
            """,
            {"org_id": org_id, "limit": limit},
        )
