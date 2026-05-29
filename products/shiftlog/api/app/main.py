"""
ShiftLog API entrypoint — FastAPI app with workflow inference endpoint.

This is the cafe-first MVP backend. It exposes one core flow:
1. Owner posts raw evidence (text/voice transcripts/photo descriptions).
2. Server calls core.workflow.inference, which calls Claude.
3. Server returns the structured WorkflowDefinition + clarifying questions.

No DB yet, no auth yet — the inference itself is the load-bearing PoC.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings

logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("shiftlog")

app = FastAPI(
    title="ShiftLog API",
    description="Workflow inference + execution for SMB owners. Cafe-first.",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Cheap liveness check — no upstream calls."""
    return {"status": "ok", "service": "shiftlog-api"}


app.include_router(api_router, prefix="/api/v1")
