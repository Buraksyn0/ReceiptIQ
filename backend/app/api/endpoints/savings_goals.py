from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from collections import defaultdict

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.models.user import User
from app.models.savings_goal import SavingsGoal
from app.models.receipt import Receipt
from app.schemas.savings_goal import SavingsGoalCreate, SavingsGoalUpdate, SavingsGoalOut

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MILESTONES = [25, 50, 75, 100]


async def _send_milestone_push(push_token: str, title: str, body: str) -> None:
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                EXPO_PUSH_URL,
                json=[{"to": push_token, "title": title, "body": body, "sound": "default"}],
                headers={"Content-Type": "application/json"},
            )
    except Exception:
        pass

router = APIRouter()


async def _get_owned(goal_id: UUID, db: AsyncSession, user: User) -> SavingsGoal:
    result = await db.execute(
        select(SavingsGoal).where(
            SavingsGoal.id == goal_id,
            SavingsGoal.user_id == user.id,
        )
    )
    obj = result.scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    return obj


@router.get("/active", response_model=Optional[SavingsGoalOut])
async def get_active_goal(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının aktif tasarruf hedefini döner. Yoksa null."""
    result = await db.execute(
        select(SavingsGoal).where(
            SavingsGoal.user_id == current_user.id,
            SavingsGoal.is_active == True,
        ).order_by(SavingsGoal.created_at.desc()).limit(1)
    )
    return result.scalars().first()


@router.get("/", response_model=List[SavingsGoalOut])
async def list_goals(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm tasarruf hedeflerini listele."""
    result = await db.execute(
        select(SavingsGoal)
        .where(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=SavingsGoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: SavingsGoalCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Yeni tasarruf hedefi oluştur. Varsa mevcut aktif hedefi pasife alır."""
    # Mevcut aktif hedefi pasife al
    result = await db.execute(
        select(SavingsGoal).where(
            SavingsGoal.user_id == current_user.id,
            SavingsGoal.is_active == True,
        )
    )
    existing = result.scalars().all()
    for g in existing:
        g.is_active = False
        db.add(g)

    obj = SavingsGoal(**data.model_dump(), user_id=current_user.id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{goal_id}", response_model=SavingsGoalOut)
async def update_goal(
    goal_id: UUID,
    data: SavingsGoalUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Tasarruf hedefini güncelle."""
    obj = await _get_owned(goal_id, db, current_user)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Tasarruf hedefini sil."""
    obj = await _get_owned(goal_id, db, current_user)
    await db.delete(obj)
    await db.commit()
    return None


@router.get("/progress")
async def get_goal_progress(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Aktif hedef + zengin istatistikler:
    - saved_amount, progress_percent
    - monthly_savings: son 6 ay bazında aylık net tasarruf
    - avg_monthly_savings: aylık ortalama tasarruf
    - estimated_months: bu hızla hedefe ulaşmak için tahmini ay
    - on_track: son tarihe göre rota durumu (ahead / on_track / behind / no_deadline)
    - required_monthly: son tarihe ulaşmak için gereken aylık tasarruf
    """
    # Aktif hedefi al
    result = await db.execute(
        select(SavingsGoal).where(
            SavingsGoal.user_id == current_user.id,
            SavingsGoal.is_active == True,
        ).order_by(SavingsGoal.created_at.desc()).limit(1)
    )
    goal = result.scalars().first()

    if not goal:
        return {"goal": None, "saved_amount": 0, "progress_percent": 0,
                "monthly_savings": [], "avg_monthly_savings": 0,
                "estimated_months": None, "on_track": "no_deadline", "required_monthly": None}

    # Hedef oluşturulduğundan bu yana tüm fişler
    receipts_result = await db.execute(
        select(Receipt).where(
            Receipt.user_id == current_user.id,
            Receipt.receipt_date >= goal.created_at,
        )
    )
    receipts = receipts_result.scalars().all()

    # Toplam tasarruf
    income = sum(float(r.total_amount) for r in receipts if r.receipt_type == "income")
    expense = sum(float(r.total_amount) for r in receipts if r.receipt_type == "expense")
    saved_amount = max(income - expense, 0)

    target = float(goal.target_amount)
    progress_percent = min(round((saved_amount / target) * 100, 1), 100) if target > 0 else 0

    # --- Aylık tasarruf dökümü (son 6 ay) ---
    monthly_map: dict[str, dict] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for r in receipts:
        key = r.receipt_date.strftime("%Y-%m") if r.receipt_date else None
        if not key:
            continue
        if r.receipt_type == "income":
            monthly_map[key]["income"] += float(r.total_amount)
        else:
            monthly_map[key]["expense"] += float(r.total_amount)

    # Son 6 ayı sırala
    now = datetime.utcnow()
    months = []
    for i in range(5, -1, -1):
        d = now.replace(day=1) - timedelta(days=1)
        for _ in range(i):
            d = d.replace(day=1) - timedelta(days=1)
        key = now.replace(day=1).strftime("%Y-%m") if i == 0 else None
        # Daha basit: doğrudan hesapla
        month_date = datetime(now.year, now.month, 1) - timedelta(days=30 * i)
        mk = month_date.strftime("%Y-%m")
        net = monthly_map[mk]["income"] - monthly_map[mk]["expense"]
        months.append({
            "month": mk,
            "label": month_date.strftime("%b"),
            "net": round(net, 2),
        })

    # Aylık ortalama (sadece pozitif aylar)
    positive_months = [m["net"] for m in months if m["net"] > 0]
    avg_monthly = round(sum(positive_months) / len(positive_months), 2) if positive_months else 0

    # Tahmini ay
    remaining = max(target - saved_amount, 0)
    estimated_months = None
    if avg_monthly > 0 and remaining > 0:
        estimated_months = round(remaining / avg_monthly, 1)
    elif remaining == 0:
        estimated_months = 0

    # Rota durumu
    on_track = "no_deadline"
    required_monthly = None
    if goal.deadline:
        days_left = (goal.deadline.replace(tzinfo=None) - datetime.utcnow()).days
        months_left = max(days_left / 30, 0.1)
        required_monthly = round(remaining / months_left, 2) if remaining > 0 else 0

        if remaining == 0:
            on_track = "completed"
        elif avg_monthly <= 0:
            on_track = "behind"
        elif avg_monthly >= required_monthly * 0.9:
            on_track = "on_track" if avg_monthly <= required_monthly * 1.1 else "ahead"
        else:
            on_track = "behind"

    # --- Milestone bildirimleri ---
    prev_milestone = goal.notified_milestone
    new_milestone = prev_milestone
    for m in MILESTONES:
        if progress_percent >= m and m > prev_milestone:
            new_milestone = m

    if new_milestone > prev_milestone and current_user.push_token:
        emoji_map = {25: "🎯", 50: "🔥", 75: "💪", 100: "🏆"}
        msg_map = {
            25: f"'{goal.title}' hedefinin %25'ine ulaştın!",
            50: f"'{goal.title}' hedefinin yarısına geldin!",
            75: f"'{goal.title}' hedefinin %75'ini tamamladın!",
            100: f"'{goal.title}' hedefine ulaştın! Tebrikler!",
        }
        await _send_milestone_push(
            current_user.push_token,
            f"{emoji_map[new_milestone]} Tasarruf Hedefi",
            msg_map[new_milestone],
        )
        goal.notified_milestone = new_milestone
        db.add(goal)
        await db.commit()

    return {
        "goal": SavingsGoalOut.model_validate(goal),
        "saved_amount": saved_amount,
        "progress_percent": progress_percent,
        "monthly_savings": months,
        "avg_monthly_savings": avg_monthly,
        "estimated_months": estimated_months,
        "on_track": on_track,
        "required_monthly": required_monthly,
    }
