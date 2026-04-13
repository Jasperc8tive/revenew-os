"""
Heuristic churn scoring model.

Risk tiers are derived from recency of last customer activity:
  HIGH   — no events in 60+ days, or an explicit CHURN event recorded
  MEDIUM — no events in 30–59 days
  LOW    — active within the last 30 days
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


class ChurnModel:
    """Scores customers by churn risk using activity recency."""

    HIGH_INACTIVE_DAYS = 60
    MEDIUM_INACTIVE_DAYS = 30

    def score(
        self,
        customers: list[dict],
        events: list[dict],
    ) -> dict:
        """
        Parameters
        ----------
        customers : list of customer dicts (id, first_seen, ...)
        events    : list of event dicts   (customer_id, event_type, timestamp)

        Returns
        -------
        dict with aggregate risk counts and per-customer risk list.
        """
        now = datetime.now(timezone.utc)

        # Build last-event index and explicit-churn set
        last_event: dict[str, datetime] = {}
        churned_ids: set[str] = set()

        for ev in events:
            cid = ev["customer_id"]
            ts = ev["timestamp"]
            if hasattr(ts, "tzinfo") and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)

            if ev.get("event_type") == "CHURN":
                churned_ids.add(cid)

            if cid not in last_event or ts > last_event[cid]:
                last_event[cid] = ts

        risk_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
        scored: list[dict] = []

        for c in customers:
            cid = c["id"]
            if cid in churned_ids:
                risk = "HIGH"
            elif cid not in last_event:
                # Never had an event — treat as high risk
                risk = "HIGH"
            else:
                days_inactive = (now - last_event[cid]).days
                if days_inactive >= self.HIGH_INACTIVE_DAYS:
                    risk = "HIGH"
                elif days_inactive >= self.MEDIUM_INACTIVE_DAYS:
                    risk = "MEDIUM"
                else:
                    risk = "LOW"

            risk_counts[risk] += 1
            scored.append({"customer_id": cid, "risk": risk})

        total = len(customers) or 1
        return {
            "total_customers": len(customers),
            "high_risk_count": risk_counts["HIGH"],
            "medium_risk_count": risk_counts["MEDIUM"],
            "low_risk_count": risk_counts["LOW"],
            "high_risk_pct": round(risk_counts["HIGH"] / total, 4),
            "scored_customers": scored,
        }
