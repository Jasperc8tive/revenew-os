"""
Revenew OS — AI Agents Service

FastAPI application entry point.  Manages the database connection pool
across the lifespan of the process and mounts the agent router.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env relative to *this file* so the path works both locally and in Docker.
# Checks for a local .env first, then falls back to the monorepo root .env.
for _candidate in [
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
]:
    if _candidate.exists():
        load_dotenv(dotenv_path=_candidate)
        break

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from api.routes import router as agents_router  # noqa: E402
from connectors.db_connector import DBConnector  # noqa: E402


# ── Lifespan: open / close the DB pool once per process ──────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.db = DBConnector()
    except RuntimeError as exc:
        # DATABASE_URL not set — start degraded rather than crashing so
        # /health can report the problem clearly.
        app.state.db = None
        print(f"[agents] WARNING: {exc}")
    yield
    if app.state.db is not None:
        app.state.db.close()


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Revenew OS — AI Agents Service",
    description=(
        "Runs growth intelligence agents (retention, acquisition, "
        "forecasting, marketing, pipeline, pricing, growth) against org data."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(agents_router)


# ── Utility endpoints ─────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health_check():
    db_ok = getattr(app.state, "db", None) is not None
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={
            "status": "healthy" if db_ok else "degraded",
            "service": "agents",
            "db_connected": db_ok,
        },
    )


@app.get("/", tags=["ops"])
async def root():
    return {
        "service": "Revenew OS — AI Agents Engine",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "health": "GET /health",
            "run_agent": "POST /agents/run",
            "list_types": "GET /agents/types",
        },
    }


# ── Dev runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AGENTS_PORT", "8000"))
    host = os.getenv("AGENTS_HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
