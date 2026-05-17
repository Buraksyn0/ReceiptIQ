from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.api import deps
from app.models.user import User
from app.models.budget import Budget
from app.models.receipt import Receipt
from app.schemas.budget import (
    BudgetCreate,
    BudgetUpdate,
    Budget as BudgetSchema,
    BudgetWithSpent,
)

router = APIRouter()


async def _get_owned_budget(
    budget_id: int, db: AsyncSession, user: User
) -> Budget:
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    budget = result.scalars().first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.get("/", response_model=List[BudgetWithSpent])
async def get_budgets(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Bütçeleri ilgili kategoride harcanan toplamla birlikte döner."""
    query = (
        select(
            Budget,
            func.coalesce(func.sum(Receipt.total_amount), 0.0).label("spent_amount"),
        )
        .outerjoin(
            Receipt,
            (Budget.category == Receipt.category)
            & (Budget.user_id == Receipt.user_id)
            & (Receipt.receipt_type == "expense"),
        )
        .where(Budget.user_id == current_user.id)
        .group_by(Budget.id)
    )

    result = await db.execute(query)
    rows = result.all()

    budgets_with_spent = []
    for budget_obj, spent in rows:
        budget_dict = budget_obj.__dict__.copy()
        budget_dict.pop("_sa_instance_state", None)
        budget_dict["spent_amount"] = float(spent) if spent is not None else 0.0
        budgets_with_spent.append(budget_dict)

    return budgets_with_spent


@router.post("/", response_model=BudgetSchema, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_in: BudgetCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    new_budget = Budget(**budget_in.model_dump(), user_id=current_user.id)
    db.add(new_budget)
    await db.commit()
    await db.refresh(new_budget)
    return new_budget


@router.put("/{budget_id}", response_model=BudgetSchema)
@router.patch("/{budget_id}", response_model=BudgetSchema)
async def update_budget(
    budget_id: int,
    budget_in: BudgetUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    budget = await _get_owned_budget(budget_id, db, current_user)
    update_data = budget_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    budget = await _get_owned_budget(budget_id, db, current_user)
    await db.delete(budget)
    await db.commit()
    return None


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_budgets(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm bütçelerini sil."""
    await db.execute(
        delete(Budget).where(Budget.user_id == current_user.id)
    )
    await db.commit()
    return None
