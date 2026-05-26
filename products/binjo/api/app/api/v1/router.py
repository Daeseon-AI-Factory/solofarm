"""
V1 API router — aggregates all endpoint modules.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import admin_orders, auth, export, farm_logs, fields, health, orders, payments, pesticides, receipts, reports, transactions, voice, weather

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])
api_router.include_router(farm_logs.router, prefix="/farm-logs", tags=["farm-logs"])
api_router.include_router(fields.router, prefix="/fields", tags=["fields"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["receipts"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(admin_orders.router, prefix="/admin/orders", tags=["admin-orders"])
api_router.include_router(pesticides.router, prefix="/pesticides", tags=["pesticides"])
api_router.include_router(health.router, tags=["health"])
