"""
Revenue metrics model — computes MRR, ARR, ARPU, and LTV estimates
from raw revenue events.
"""

from __future__ import annotations

from collections import defaultdict

from utils.insight_formatter import safe_float


class RevenueModel:
    """Computes key revenue metrics from a list of revenue events."""

    def compute_metrics(self, revenue_events: list[dict]) -> dict:
        """
        Parameters
        ----------
        revenue_events : list of dicts with keys:
            customer_id, type, amount, currency, occurred_at

        Returns
        -------
        dict with MRR, ARR, ARPU, LTV estimates, and event-type breakdown.
        """
        if not revenue_events:
            return self._empty()

        by_type: dict[str, float] = defaultdict(float)
        by_customer: dict[str, float] = defaultdict(float)
        total_revenue = 0.0
        refunds = 0.0

        for ev in revenue_events:
            amount = safe_float(ev.get("amount"))
            ev_type = ev.get("type", "UNKNOWN")
            cid = ev.get("customer_id", "")

            by_type[ev_type] += amount

            if ev_type == "REFUND":
                refunds += amount
            else:
                total_revenue += amount
                by_customer[cid] += amount

        customer_count = len(by_customer) or 1
        arpu = total_revenue / customer_count

        # MRR estimate: subscription revenue (non-refund, non-one-time) / months in window
        subscription_revenue = by_type.get("SUBSCRIPTION_STARTED", 0) + by_type.get(
            "SUBSCRIPTION_RENEWED", 0
        )
        mrr_estimate = subscription_revenue / 12 if subscription_revenue else total_revenue / 12

        # Simple LTV estimate: ARPU × avg retention (assumed 12 months if unknown)
        ltv_estimate = arpu * 12

        return {
            "total_revenue": round(total_revenue, 2),
            "total_refunds": round(refunds, 2),
            "net_revenue": round(total_revenue - refunds, 2),
            "mrr_estimate": round(mrr_estimate, 2),
            "arr_estimate": round(mrr_estimate * 12, 2),
            "unique_paying_customers": len(by_customer),
            "arpu": round(arpu, 2),
            "ltv_estimate": round(ltv_estimate, 2),
            "by_event_type": {k: round(v, 2) for k, v in by_type.items()},
        }

    @staticmethod
    def _empty() -> dict:
        return {
            "total_revenue": 0.0,
            "total_refunds": 0.0,
            "net_revenue": 0.0,
            "mrr_estimate": 0.0,
            "arr_estimate": 0.0,
            "unique_paying_customers": 0,
            "arpu": 0.0,
            "ltv_estimate": 0.0,
            "by_event_type": {},
        }
