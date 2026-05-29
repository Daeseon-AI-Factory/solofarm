"""Top-level v1 router — mounts each endpoint module."""

from fastapi import APIRouter

from app.api.v1.endpoints import workflows

api_router = APIRouter()
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
