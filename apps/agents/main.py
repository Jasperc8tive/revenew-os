from fastapi import FastAPI
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="../../.env")

app = FastAPI(
    title="Revenew OS - AI Agents Service",
    description="FastAPI service for AI-powered growth agents",
    version="0.1.0",
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "agents"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Revenew OS - AI Agents Engine",
        "version": "0.1.0",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "redoc": "/redoc",
        }
    }

@app.post("/agents/run")
async def run_agent(agent_type: str, organization_id: str):
    """Trigger AI agent execution"""
    return {
        "status": "pending",
        "agent_type": agent_type,
        "organization_id": organization_id,
        "message": "Agent execution queued"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENTS_PORT", 8000))
    host = os.getenv("AGENTS_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)

