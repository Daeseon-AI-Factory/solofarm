"""
Financial transaction CRUD endpoints.

Transactions are the central ledger — every money movement (purchase, sale,
expense, subsidy) gets recorded here. Created manually, from receipt OCR,
from voice entry, or auto-generated when a sales order is delivered.
"""

import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.models.financial_transaction import FinancialTransaction
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _txn_to_response(txn: FinancialTransaction) -> TransactionResponse:
    """Convert a FinancialTransaction ORM object to a Pydantic response."""
    return TransactionResponse(
        id=str(txn.id),
        type=txn.type,
        category=txn.category,
        amount=int(txn.amount),
        description=txn.description,
        counterparty=txn.counterparty,
        transaction_date=txn.transaction_date,
        source=txn.source,
        source_id=str(txn.source_id) if txn.source_id else None,
        farm_log_id=str(txn.farm_log_id) if txn.farm_log_id else None,
        status=txn.status,
        confidence=float(txn.confidence) if txn.confidence is not None else None,
        receipt_image_url=txn.receipt_image_url,
        notes=txn.notes,
        created_at=txn.created_at,
        updated_at=txn.updated_at,
    )


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    type: str | None = Query(None, description="'income' or 'expense'"),
    category: str | None = Query(None),
    transaction_status: str | None = Query(None, alias="status"),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    """List transactions with optional filters (date range, type, category, status)."""
    farm_id = farmer.farm_id or farmer.id

    query = (
        select(FinancialTransaction)
        .where(FinancialTransaction.farm_id == farm_id)
        .order_by(FinancialTransaction.transaction_date.desc(), FinancialTransaction.created_at.desc())
    )
    count_query = (
        select(func.count(FinancialTransaction.id))
        .where(FinancialTransaction.farm_id == farm_id)
    )

    # Apply filters
    if date_from:
        query = query.where(FinancialTransaction.transaction_date >= date_from)
        count_query = count_query.where(FinancialTransaction.transaction_date >= date_from)
    if date_to:
        query = query.where(FinancialTransaction.transaction_date <= date_to)
        count_query = count_query.where(FinancialTransaction.transaction_date <= date_to)
    if type:
        query = query.where(FinancialTransaction.type == type)
        count_query = count_query.where(FinancialTransaction.type == type)
    if category:
        query = query.where(FinancialTransaction.category == category)
        count_query = count_query.where(FinancialTransaction.category == category)
    if transaction_status:
        query = query.where(FinancialTransaction.status == transaction_status)
        count_query = count_query.where(FinancialTransaction.status == transaction_status)

    result = await db.execute(query)
    transactions = result.scalars().all()
    total = (await db.execute(count_query)).scalar() or 0

    return TransactionListResponse(
        transactions=[_txn_to_response(t) for t in transactions],
        total=total,
    )


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Create a manual transaction — from form input or voice financial entry."""
    txn = FinancialTransaction(
        farm_id=farmer.farm_id or farmer.id,
        farmer_id=farmer.id,
        type=body.type,
        category=body.category,
        amount=body.amount,
        description=body.description,
        counterparty=body.counterparty,
        transaction_date=body.transaction_date,
        source=body.source,
        farm_log_id=UUID(body.farm_log_id) if body.farm_log_id else None,
        notes=body.notes,
        # Manual entries are auto-confirmed — the farmer entered it themselves
        status="confirmed",
        confidence=None,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)

    return _txn_to_response(txn)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Get a single transaction by ID."""
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.farm_id == farm_id,
        )
    )
    txn = result.scalar_one_or_none()

    if txn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "거래 내역을 찾을 수 없습니다"},
        )

    return _txn_to_response(txn)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    body: TransactionUpdate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Update a transaction — farmer corrects category, amount, etc."""
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.farm_id == farm_id,
        )
    )
    txn = result.scalar_one_or_none()

    if txn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "거래 내역을 찾을 수 없습니다"},
        )

    # Update only provided fields
    if body.type is not None:
        txn.type = body.type
    if body.category is not None:
        txn.category = body.category
    if body.amount is not None:
        txn.amount = body.amount
    if body.description is not None:
        txn.description = body.description
    if body.counterparty is not None:
        txn.counterparty = body.counterparty
    if body.transaction_date is not None:
        txn.transaction_date = body.transaction_date
    if body.farm_log_id is not None:
        txn.farm_log_id = UUID(body.farm_log_id)
    if body.notes is not None:
        txn.notes = body.notes

    await db.commit()
    await db.refresh(txn)

    return _txn_to_response(txn)


@router.put("/{transaction_id}/confirm", response_model=TransactionResponse)
async def confirm_transaction(
    transaction_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """Confirm a pending transaction — farmer verifies AI-parsed data is correct."""
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.farm_id == farm_id,
        )
    )
    txn = result.scalar_one_or_none()

    if txn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "거래 내역을 찾을 수 없습니다"},
        )

    if txn.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_CONFIRMED", "message": "이미 확인된 거래입니다"},
        )

    txn.status = "confirmed"
    await db.commit()
    await db.refresh(txn)

    return _txn_to_response(txn)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a transaction."""
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.farm_id == farm_id,
        )
    )
    txn = result.scalar_one_or_none()

    if txn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "거래 내역을 찾을 수 없습니다"},
        )

    await db.delete(txn)
    await db.commit()
