"""
Pricing agent — analyses plan mix, upgrade/downgrade rates, and pricing health.
"""

from __future__ import annotations

from collections import defaultdict

from connectors.db_connector import DBConnector
from utils.data_loader import load_revenue_events, load_subscriptions
from utils.insight_formatter import format_agent_result, format_error, safe_float

from agents.base_agent import BaseAgent


class PricingAgent(BaseAgent):
    agent_type = "PRICING"

    def analyze(self, organization_id: str) -> dict:
        try:
            subscriptions = load_subscriptions(organization_id, self.db)
            revenue_events = load_revenue_events(organization_id, self.db, days=180)

            plan_counts: dict[str, int] = defaultdict(int)
            plan_revenue: dict[str, float] = defaultdict(float)

            for sub in subscriptions:
                plan = sub.get("plan_name") or sub.get("plan_tier") or "unknown"
                plan_counts[plan] += 1
                plan_revenue[plan] += safe_float(sub.get("price_monthly"))

            upgrades = sum(1 for e in revenue_events if e.get("type") == "UPGRADE")
            downgrades = sum(1 for e in revenue_events if e.get("type") == "DOWNGRADE")
            total_subs = len(subscriptions) or 1

            upgrade_rate = self._safe_divide(upgrades, total_subs)
            downgrade_rate = self._safe_divide(downgrades, total_subs)
            expansion_ratio = self._safe_divide(upgrades, downgrades or 1)

            total_mrr = sum(plan_revenue.values())
            arps = self._safe_divide(total_mrr, total_subs)

            plan_breakdown = [
                {
                    "plan": plan,
                    "subscriber_count": count,
                    "monthly_revenue": round(plan_revenue[plan], 2),
                    "revenue_share_pct": round(
                        self._safe_divide(plan_revenue[plan], total_mrr) * 100, 2
                    ),
                }
                for plan, count in sorted(plan_counts.items(), key=lambda x: x[1], reverse=True)
            ]

            if downgrade_rate > upgrade_rate and downgrades > 3:
                recommendation = (
                    "Downgrades are outpacing upgrades — a sign of plan-value mismatch. "
                    "Survey recently downgraded customers to identify missing value drivers."
                )
                confidence = 0.83
            elif arps < 50 and total_subs > 10:
                recommendation = (
                    "Average revenue per subscription is low. Test a price increase on new "
                    "sign-ups or introduce a higher tier with premium features."
                )
                confidence = 0.76
            elif expansion_ratio > 2:
                recommendation = (
                    "Strong upgrade momentum. Formalise an upsell playbook and automate "
                    "upgrade prompts at usage milestones."
                )
                confidence = 0.78
            else:
                recommendation = (
                    "Pricing appears stable. Run cohort-based pricing sensitivity analysis "
                    "to find the optimal price point for each customer segment."
                )
                confidence = 0.68

            metrics = {
                "total_subscriptions": total_subs,
                "upgrades_180d": upgrades,
                "downgrades_180d": downgrades,
                "upgrade_rate": round(upgrade_rate, 4),
                "downgrade_rate": round(downgrade_rate, 4),
                "expansion_ratio": round(expansion_ratio, 2),
                "avg_revenue_per_subscription": round(arps, 2),
                "total_monthly_revenue": round(total_mrr, 2),
                "plan_breakdown": plan_breakdown,
            }

            return format_agent_result(
                self.agent_type, organization_id, metrics, recommendation, confidence
            )

        except Exception as exc:
            return format_error(self.agent_type, organization_id, str(exc))
