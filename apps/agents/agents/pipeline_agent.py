"""
Pipeline agent — analyses sales pipeline health, stage distribution, and velocity.
"""

from __future__ import annotations

from collections import defaultdict

from connectors.db_connector import DBConnector
from utils.data_loader import load_deals
from utils.insight_formatter import format_agent_result, format_error, safe_float

from agents.base_agent import BaseAgent

STAGE_ORDER = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]


class PipelineAgent(BaseAgent):
    agent_type = "PIPELINE"

    def analyze(self, organization_id: str) -> dict:
        try:
            deals = load_deals(organization_id, self.db)

            if not deals:
                return format_agent_result(
                    self.agent_type,
                    organization_id,
                    {"message": "No deals found in the pipeline"},
                    "Create pipeline stages and add deals to start tracking sales velocity.",
                    confidence=0.5,
                )

            stage_totals: dict[str, dict] = defaultdict(lambda: {"count": 0, "value": 0.0})
            total_value = 0.0
            weighted_value = 0.0

            for deal in deals:
                stage = deal.get("stage") or deal.get("stage_type") or "UNKNOWN"
                value = safe_float(deal.get("value"))
                prob = safe_float(deal.get("probability")) / 100.0

                stage_totals[stage]["count"] += 1
                stage_totals[stage]["value"] += value
                total_value += value
                weighted_value += value * prob

            active_stages = {k: v for k, v in stage_totals.items() if k not in ("WON", "LOST")}
            bottleneck = (
                max(active_stages, key=lambda k: active_stages[k]["count"])
                if active_stages
                else None
            )

            won = stage_totals.get("WON", {})
            total_closed = (
                stage_totals.get("WON", {}).get("count", 0)
                + stage_totals.get("LOST", {}).get("count", 0)
            )
            win_rate = self._safe_divide(won.get("count", 0), total_closed) if total_closed else 0.0
            avg_deal_size = self._safe_divide(total_value, len(deals))

            stage_breakdown = [
                {
                    "stage": stage,
                    "deal_count": data["count"],
                    "total_value": round(data["value"], 2),
                }
                for stage, data in sorted(
                    stage_totals.items(),
                    key=lambda x: STAGE_ORDER.index(x[0]) if x[0] in STAGE_ORDER else 99,
                )
            ]

            if win_rate < 0.1 and total_closed > 5:
                recommendation = (
                    "Win rate is critically low. Review qualification criteria — most lost deals "
                    "are likely entering the pipeline under-qualified. Tighten BANT scoring."
                )
                confidence = 0.85
            elif bottleneck and active_stages.get(bottleneck, {}).get("count", 0) > len(deals) * 0.4:
                recommendation = (
                    f"Pipeline is bottlenecked at the '{bottleneck}' stage. "
                    "Set stage-exit SLAs and schedule weekly deal hygiene reviews."
                )
                confidence = 0.82
            else:
                recommendation = (
                    "Pipeline flow looks healthy. Focus on increasing average deal size through "
                    "upsell conversations during the proposal and negotiation stages."
                )
                confidence = 0.7

            metrics = {
                "total_deals": len(deals),
                "total_pipeline_value": round(total_value, 2),
                "weighted_pipeline_value": round(weighted_value, 2),
                "avg_deal_size": round(avg_deal_size, 2),
                "win_rate": round(win_rate, 4),
                "bottleneck_stage": bottleneck,
                "stage_breakdown": stage_breakdown,
            }

            return format_agent_result(
                self.agent_type, organization_id, metrics, recommendation, confidence
            )

        except Exception as exc:
            return format_error(self.agent_type, organization_id, str(exc))
