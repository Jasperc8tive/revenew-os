"""
Data ingestion pipeline — loads all data domains for an organisation in one call.
"""

from __future__ import annotations

from connectors.db_connector import DBConnector
from utils.data_loader import (
    load_customer_events,
    load_customers,
    load_deals,
    load_marketing_metrics,
    load_monthly_revenue,
    load_revenue_events,
    load_subscriptions,
)


def load_data(org_id: str, db: DBConnector) -> dict:
    """Load and normalise all data sources for *org_id* into a single dict."""
    return {
        "customers": load_customers(org_id, db),
        "customer_events": load_customer_events(org_id, db, days=90),
        "revenue_events": load_revenue_events(org_id, db, days=365),
        "monthly_revenue": load_monthly_revenue(org_id, db, months=12),
        "subscriptions": load_subscriptions(org_id, db),
        "deals": load_deals(org_id, db),
        "marketing_metrics": load_marketing_metrics(org_id, db, days=30),
    }
