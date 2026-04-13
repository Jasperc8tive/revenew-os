"""
FastAPI router for agent execution endpoints.
Mounted onto the main app in main.py.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from agents.acquisition_agent import AcquisitionAgent
from agents.forecasting_agent import ForecastingAgent
from agents.growth_agent import GrowthAgent
from agents.marketing_agent import MarketingAgent
from agents.pipeline_agent import PipelineAgent
from agents.pricing_agent import PricingAgent
from agents.retention_agent import RetentionAgent

router = APIRouter(prefix="/agents", tags=["agents"])

AGENT_REGISTRY = {
    "RETENTION": RetentionAgent,
    "ACQUISITION": AcquisitionAgent,
    "FORECASTING": ForecastingAgent,
    "MARKETING": MarketingAgent,
    "PIPELINE": PipelineAgent,
    "PRICING": PricingAgent,
    "GROWTH": GrowthAgent,
}

VALID_AGENT_TYPES = sorted(AGENT_REGISTRY.keys())


class AgentRunRequest(BaseModel):
    agent_type: str = Field(
        ...,
        description=f"One of: {', '.join(VALID_AGENT_TYPES)}",
    )
    organization_id: str = Field(..., min_length=1)


class AgentRunResponse(BaseModel):
    agent_type: str
    organization_id: str
    status: str
    analyzed_at: str
    confidence: float | None = None
    metrics: dict | None = None
    recommendation: str | None = None
    error: str | None = None


@router.post("/run", response_model=AgentRunResponse, status_code=200)
async def run_agent(request: Request, body: AgentRunRequest) -> dict:
    """Trigger a named agent for an organisation and return the analysis result."""
    agent_type = body.agent_type.strip().upper()

    if agent_type not in AGENT_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"Unknown agent_type '{agent_type}'",
                "valid_types": VALID_AGENT_TYPES,
            },
        )

    db = request.app.state.db
    agent_cls = AGENT_REGISTRY[agent_type]
    agent = agent_cls(db)

    result = agent.analyze(body.organization_id)

    # If the agent caught an internal error, surface it as HTTP 500
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result)

    return result


@router.get("/types")
async def list_agent_types() -> dict:
    """Return all available agent type identifiers."""
    return {"agent_types": VALID_AGENT_TYPES}
