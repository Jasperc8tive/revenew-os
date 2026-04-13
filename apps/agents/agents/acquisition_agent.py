"""
Acquisition agent — analyses CAC, LTV/CAC ratio, and channel efficiency.
"""

from __future__ import annotations

from collections import defaultdict

from connectors.db_connector import DBConnector
from models.revenue_model import RevenueModel
from utils.data_loader import (
    load_marketing_metrics,
    load_new_customers,
    load_revenue_events,
)
from utils.insight_formatter import format_agent_result, format_error, safe_float

from agents.base_agent import BaseAgent


class AcquisitionAgent(BaseAgent):
    agent_type = "ACQUISITION"

    def analyze(self, organization_id: str) -> dict:
        try:
            new_customers = load_new_customers(organization_id, self.db, days=90)
            marketing = load_marketing_metrics(organization_id, self.db, days=90)
            revenue_events = load_revenue_events(organization_id, self.db, days=365)

            revenue_metrics = RevenueModel().compute_metrics(revenue_events)

            total_spend = sum(safe_float(m.get("spend")) for m in marketing)
            new_customer_count = len(new_customers) or 1
            cac = self._safe_divide(total_spend, new_customer_count)

            ltv = revenue_metrics["ltv_estimate"]
            ltv_cac_ratio = self._safe_divide(ltv, cac) if cac > 0 else 0.0

            channel_breakdown = [
                {
                    "channel": m.get("channel_name"),
                    "type": m.get("channel_type"),
                    "spend": round(safe_float(m.get("spend")), 2),
                    "conversions": int(m.get("conversions") or 0),
                    "cpc": round(
                        self._safe_divide(
                            safe_float(m.get("spend")),
                            int(m.get("clicks") or 0) or 1,
                        ),
                        2,
                    ),
                    "ctr_pct": round(
                        self._safe_divide(
                            int(m.get("clicks") or 0),
                            int(m.get("impressions") or 0) or 1,
                        )
                        * 100,
                        2,
                    ),
                }
                for m in marketing
            ]

            channel_counts: dict[str, int] = defaultdict(int)
            for c in new_customers:
                ch = c.get("acquisition_channel") or "unknown"
                channel_counts[ch] += 1

            if ltv_cac_ratio < 1:
                recommendation = (
                    "CAC exceeds LTV — acquisition is loss-making. Pause low-performing channels "
                    "immediately and audit spend allocation before scaling further."
                )
                confidence = 0.88
            elif ltv_cac_ratio < 3:
                recommendation = (
                    "LTV/CAC ratio is below the healthy 3× threshold. Rebalance budget toward "
                    "channels with the lowest CPC and highest conversion rates."
                )
                confidence = 0.8
            else:
                recommendation = (
                    "Acquisition efficiency is strong. Scale spend in top-performing channels "
                    "while maintaining CAC guardrails."
                )
                confidence = 0.75

            metrics = {
                "new_customers_90d": len(new_customers),
                "total_marketing_spend_90d": round(total_spend, 2),
                "cac": round(cac, 2),
                "ltv_estimate": round(ltv, 2),
                "ltv_cac_ratio": round(ltv_cac_ratio, 2),
                "arpu": revenue_metrics["arpu"],
                "channel_performance": channel_breakdown,
                "top_acquisition_channels": sorted(
                    [{"channel": k, "customers": v} for k, v in channel_counts.items()],
                    key=lambda x: x["customers"],
                    reverse=True,
                )[:5],
            }

            return format_agent_result(
                self.agent_type, organization_id, metrics, recommendation, confidence
            )

        except Exception as exc:
            return format_error(self.agent_type, organization_id, str(exc))
