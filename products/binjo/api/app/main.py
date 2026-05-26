"""
BINJO API — Voice Farm Management Backend

FastAPI application entry point. This is the Phase 2 backend that handles:
- Voice recording upload + STT processing (Whisper)
- AI structured parsing (Claude)
- Farm log CRUD
- Weather auto-fill (기상청 API)
- 영농일지 PDF export
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Startup/shutdown lifecycle.
    Runs once when the app starts, and once when it stops.
    """
    # Startup: verify critical connections
    print("BINJO API starting...")
    yield
    # Shutdown: cleanup
    print("BINJO API shutting down...")


app = FastAPI(
    title="BINJO API",
    description="Voice-first farm management backend",
    version="0.1.0",
    lifespan=lifespan,
    # Disable docs in production for security
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
)

# CORS — allow Next.js frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all v1 routes under /api/v1
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check for Railway/monitoring."""
    return {"status": "ok", "service": "binjo-api"}
