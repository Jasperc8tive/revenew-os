"""
Feature engineering pipeline — transforms raw data dicts into
flat numeric feature vectors suitable for ML models.
"""

from __future__ import annotations

from datetime import datetime, timezone

from utils.insight_formatter import safe_float


def prepare_features(data: dict) -> dict:
    """
    Transform raw data loaded by data_pipeline.load_data() into
    numeric features for downstream models.

    Returns a dict of feature name → scalar value.
    """
    now = datetime.now(timezone.utc)

    customers = data.get("customers", [])
    events = data.get("customer_events", [])
    revenue = data.get("revenue_events", [])
    subs = data.get("subscriptions", [])
    deals = data.get("deals", [])
    monthly = data.get("monthly_revenue", [])

    # ── Customer features ─────────────────────────────────────────────────────
    total_customers = len(customers)

    last_event_by_customer: dict[str, datetime] = {}
    for ev in events:
        cid = ev.get("customer_id", "")
        ts = ev.get("timestamp")
        if ts:
            if hasattr(ts, "tzinfo") and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if cid not in last_event_by_customer or ts > last_event_by_customer[cid]:
                last_event_by_customer[cid] = ts

    inactive_30 = sum(
        1
        for c in customers
        if c["id"] not in last_event_by_customer
        or (now - last_event_by_customer[c["id"]]).days >= 30
    )

    # ── Revenue features ──────────────────────────────────────────────────────
    total_revenue = sum(safe_float(e.get("amount")) for e in revenue if e.get("type") != "REFUND")
    refunds = sum(safe_float(e.get("amount")) for e in revenue if e.get("type") == "REFUND")
    upgrades = sum(1 for e in revenue if e.get("type") == "UPGRADE")
    downgrades = sum(1 for e in revenue if e.get("type") == "DOWNGRADE")

    revenue_amounts = [safe_float(r.get("revenue")) for r in monthly if r.get("revenue")]
    growth_rate = 0.0
    if len(revenue_amounts) >= 2:
        first, last = revenue_amounts[0], revenue_amounts[-1]
        growth_rate = ((last - first) / first * 100) if first else 0.0

    # ── Subscription features ─────────────────────────────────────────────────
    active_subs = sum(1 for s in subs if s.get("status") == "ACTIVE")
    canceled_subs = sum(1 for s in subs if s.get("status") == "CANCELED")
    total_subs = len(subs) or 1
    churn_rate = canceled_subs / total_subs

    # ── Pipeline features ─────────────────────────────────────────────────────
    total_deal_value = sum(safe_float(d.get("value")) for d in deals)
    won_deals = sum(1 for d in deals if d.get("stage") == "WON")
    closed_deals = sum(1 for d in deals if d.get("stage") in ("WON", "LOST"))
    win_rate = won_deals / closed_deals if closed_deals else 0.0

    return {
        "total_customers": total_customers,
        "inactive_customers_30d": inactive_30,
        "inactive_rate": inactive_30 / total_customers if total_customers else 0.0,
        "total_revenue": total_revenue,
        "total_refunds": refunds,
        "net_revenue": total_revenue - refunds,
        "revenue_growth_rate_pct": growth_rate,
        "upgrades": upgrades,
        "downgrades": downgrades,
        "expansion_ratio": upgrades / max(downgrades, 1),
        "active_subscriptions": active_subs,
        "churn_rate": churn_rate,
        "retention_rate": 1.0 - churn_rate,
        "total_pipeline_value": total_deal_value,
        "win_rate": win_rate,
        "total_deals": len(deals),
    }
