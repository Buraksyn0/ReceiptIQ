"""
ReceiptIQ — Analytics Endpoint'leri

GET /analytics/forecast        → Bu ay tahmini harcama
GET /analytics/anomalies       → Kullanıcının anormal fişleri
GET /analytics/weekly-summary  → Bu hafta ve geçen hafta özeti
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api import deps
from app.models.user import User
from app.models.receipt import Receipt
from app.models.budget import Budget

log = logging.getLogger(__name__)
router = APIRouter()

TR_MONTHS = [
    "", "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
]

CATEGORY_LABELS = {
    "food": "Gıda",
    "market": "Market",
    "shopping": "Alışveriş",
    "transport": "Ulaşım",
    "entertainment": "Eğlence",
    "rent": "Kira/Fatura",
    "salary": "Maaş/Gelir",
    "education": "Eğitim",
    "sports": "Spor",
    "clothing": "Giyim",
    "fuel": "Yakıt",
    "health": "Sağlık",
    "personal_care": "Kişisel Bakım",
    "subscriptions": "Abonelik",
    "other": "Diğer",
}

def _cat_label(cat: str) -> str:
    return CATEGORY_LABELS.get(cat, cat.capitalize() if cat else "Diğer")


@router.get("/monthly")
async def get_monthly(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Son 6 ayın aylık harcama toplamlarını döner.

    Response:
        {
            "months": [
                {
                    "year": 2026, "month": 4, "label": "Nis",
                    "total": 1250.50,
                    "mom_change": 12.3   # bir önceki aya göre % değişim (None = ilk ay)
                },
                ...
            ],
            "current_month_label": "May"
        }
    """
    now = datetime.now(timezone.utc)
    current_year, current_month = now.year, now.month

    # Son 7 ayı sorgula (6 ay için MoM hesabı yapabilmek adına 1 ay fazla çek)
    monthly_data = {}
    for offset in range(6, -1, -1):  # 6 ay önce → bu ay
        year, month = _month_offset(current_year, current_month, -offset)
        result = await db.execute(
            select(func.sum(Receipt.total_amount)).where(
                Receipt.user_id == current_user.id,
                Receipt.total_amount > 0,
                Receipt.receipt_type == "expense",
                func.extract("year", Receipt.receipt_date) == year,
                func.extract("month", Receipt.receipt_date) == month,
            )
        )
        total = float(result.scalar() or 0)
        monthly_data[(year, month)] = total

    # Son 6 ayı (bu ay dahil) al, MoM % hesapla
    keys = list(monthly_data.keys())
    months_out = []
    for i in range(1, 7):  # index 1..6 → son 6 ay
        year, month = keys[i]
        total = monthly_data[(year, month)]
        prev_total = monthly_data[keys[i - 1]]

        if prev_total > 0:
            mom = round(((total - prev_total) / prev_total) * 100, 1)
        else:
            mom = None

        months_out.append({
            "year": year,
            "month": month,
            "label": TR_MONTHS[month],
            "total": round(total, 2),
            "mom_change": mom,
        })

    return {
        "months": months_out,
        "current_month_label": TR_MONTHS[current_month],
    }


@router.get("/categories")
async def get_categories(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Kullanıcının tüm zamanki gider kategorisi dağılımını döner.

    Response:
        [{ "category": "market", "total": 1200.50, "count": 15, "percentage": 35.2 }, ...]
    """
    result = await db.execute(
        select(Receipt.category, func.sum(Receipt.total_amount), func.count(Receipt.id))
        .where(
            Receipt.user_id == current_user.id,
            Receipt.total_amount > 0,
            Receipt.receipt_type == "expense",
        )
        .group_by(Receipt.category)
        .order_by(func.sum(Receipt.total_amount).desc())
    )
    rows = result.all()

    grand_total = sum(float(r[1]) for r in rows) or 1
    return [
        {
            "category": r[0],
            "total": round(float(r[1]), 2),
            "count": r[2],
            "percentage": round((float(r[1]) / grand_total) * 100, 1),
        }
        for r in rows
    ]


@router.get("/forecast")
async def get_forecast(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Bu ay için tahmini toplam harcama döner.

    Yöntem: Son 3 ayın ortalaması (simple moving average)
    - Veri yetersizse (< 1 ay) None döner
    - Tahmini mevcut aya orantılar (ay içinde kaçıncı gündeyiz)

    Response:
        {
            "forecast_amount": 1250.50,   # Bu ay tahmini ₺
            "current_month_spent": 430.20, # Bu ay şimdiye kadar harcanan
            "based_on_months": 3,          # Kaç aylık veriye dayanıyor
            "confidence": "medium"         # low / medium / high
        }
    """
    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month
    day_of_month = now.day
    days_in_month = _days_in_month(current_year, current_month)

    # Bu ay harcanan
    current_month_result = await db.execute(
        select(func.sum(Receipt.total_amount)).where(
            Receipt.user_id == current_user.id,
            Receipt.total_amount > 0,
            func.extract("year", Receipt.receipt_date) == current_year,
            func.extract("month", Receipt.receipt_date) == current_month,
        )
    )
    current_month_spent = float(current_month_result.scalar() or 0)

    # Son 3 ayın aylık toplamları
    monthly_totals = []
    for offset in range(1, 4):  # 1, 2, 3 ay önce
        year, month = _month_offset(current_year, current_month, -offset)
        result = await db.execute(
            select(func.sum(Receipt.total_amount)).where(
                Receipt.user_id == current_user.id,
                Receipt.total_amount > 0,
                func.extract("year", Receipt.receipt_date) == year,
                func.extract("month", Receipt.receipt_date) == month,
            )
        )
        total = float(result.scalar() or 0)
        if total > 0:
            monthly_totals.append(total)

    if not monthly_totals:
        # Geçmiş veri yok — bu ayın harcamasından projeksiyon yap
        if current_month_spent > 0 and day_of_month > 0:
            projected = (current_month_spent / day_of_month) * days_in_month
            return {
                "forecast_amount": round(projected, 2),
                "current_month_spent": round(current_month_spent, 2),
                "based_on_months": 0,
                "confidence": "low",
            }
        return {
            "forecast_amount": None,
            "current_month_spent": round(current_month_spent, 2),
            "based_on_months": 0,
            "confidence": "low",
        }

    # Moving average
    avg_monthly = sum(monthly_totals) / len(monthly_totals)

    # Bu ayki gerçek veriye göre hibrit tahmin:
    # Ağırlık: kalan gün oranına göre geçmiş ort. + bu ay şimdiye kadar
    elapsed_ratio = day_of_month / days_in_month
    remaining_ratio = 1 - elapsed_ratio

    # Tahmin = bu ay harcanan + (kalan günler için geçmiş ort.'dan projeksiyon)
    forecast = current_month_spent + (avg_monthly * remaining_ratio)

    # Güven seviyesi
    if len(monthly_totals) >= 3:
        confidence = "high"
    elif len(monthly_totals) == 2:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "forecast_amount": round(forecast, 2),
        "current_month_spent": round(current_month_spent, 2),
        "based_on_months": len(monthly_totals),
        "confidence": confidence,
    }


@router.get("/anomalies")
async def get_anomalies(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Kullanıcının anomali olarak işaretlenmiş fişlerini döner (en yeniden eskiye).

    Response: [{ id, merchant_name, category, total_amount, receipt_date, anomaly_score }, ...]
    """
    result = await db.execute(
        select(Receipt)
        .where(
            Receipt.user_id == current_user.id,
            Receipt.is_anomaly == True,
        )
        .order_by(Receipt.receipt_date.desc().nullslast())
    )
    anomalies = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "merchant_name": r.merchant_name,
            "category": r.category,
            "total_amount": float(r.total_amount) if r.total_amount else None,
            "receipt_date": r.receipt_date.isoformat() if r.receipt_date else None,
            "anomaly_score": r.anomaly_score,
        }
        for r in anomalies
    ]


@router.get("/weekly-summary")
async def get_weekly_summary(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Bu hafta (Pzt-Paz) ve geçen haftanın harcama özetini döner.

    Response:
        {
            "this_week": {
                "total": 1250.50,
                "start_date": "2026-05-11",
                "end_date": "2026-05-17",
                "transaction_count": 12
            },
            "last_week": {
                "total": 980.00,
                "start_date": "2026-05-04",
                "end_date": "2026-05-10",
                "transaction_count": 9
            },
            "change_percent": 27.6,      # pozitif = daha fazla harcandı
            "top_categories": [
                { "category": "market", "total": 450.0, "percentage": 36.0 },
                ...
            ],
            "budget_status": {           # None if no budgets
                "total_limit": 3000.0,
                "total_spent": 1250.50,
                "percentage": 41.7
            }
        }
    """
    now = datetime.now(timezone.utc)

    # Bu haftanın başı (Pazartesi 00:00)
    days_since_monday = now.weekday()  # 0=Pzt, 6=Paz
    this_week_start = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    this_week_end = this_week_start + timedelta(days=7)

    # Geçen haftanın başı/sonu
    last_week_start = this_week_start - timedelta(days=7)
    last_week_end = this_week_start

    async def _week_stats(start, end):
        result = await db.execute(
            select(func.sum(Receipt.total_amount), func.count(Receipt.id))
            .where(
                Receipt.user_id == current_user.id,
                Receipt.receipt_type == "expense",
                Receipt.total_amount > 0,
                Receipt.receipt_date >= start,
                Receipt.receipt_date < end,
            )
        )
        row = result.one()
        return float(row[0] or 0), int(row[1] or 0)

    this_total, this_count = await _week_stats(this_week_start, this_week_end)
    last_total, last_count = await _week_stats(last_week_start, last_week_end)

    # Değişim yüzdesi
    if last_total > 0:
        change_percent = round(((this_total - last_total) / last_total) * 100, 1)
    else:
        change_percent = None

    # Bu haftanın kategori dağılımı (top 3)
    cat_result = await db.execute(
        select(Receipt.category, func.sum(Receipt.total_amount))
        .where(
            Receipt.user_id == current_user.id,
            Receipt.receipt_type == "expense",
            Receipt.total_amount > 0,
            Receipt.receipt_date >= this_week_start,
            Receipt.receipt_date < this_week_end,
        )
        .group_by(Receipt.category)
        .order_by(func.sum(Receipt.total_amount).desc())
        .limit(3)
    )
    cat_rows = cat_result.all()
    top_categories = [
        {
            "category": row[0],
            "total": round(float(row[1]), 2),
            "percentage": round((float(row[1]) / this_total) * 100, 1) if this_total > 0 else 0,
        }
        for row in cat_rows
    ]

    # Bütçe durumu (bu ayki — spent dinamik hesaplanır)
    budget_result = await db.execute(
        select(
            func.sum(Budget.limit_amount),
            func.coalesce(func.sum(Receipt.total_amount), 0.0),
        )
        .outerjoin(
            Receipt,
            (Budget.category == Receipt.category)
            & (Budget.user_id == Receipt.user_id)
            & (Receipt.receipt_type == "expense")
            & (func.extract("year", Receipt.receipt_date) == now.year)
            & (func.extract("month", Receipt.receipt_date) == now.month),
        )
        .where(Budget.user_id == current_user.id)
    )
    brow = budget_result.one()
    total_limit = float(brow[0] or 0)
    total_spent_budget = float(brow[1] or 0)

    budget_status = None
    if total_limit > 0:
        budget_status = {
            "total_limit": round(total_limit, 2),
            "total_spent": round(total_spent_budget, 2),
            "percentage": round((total_spent_budget / total_limit) * 100, 1),
        }

    return {
        "this_week": {
            "total": round(this_total, 2),
            "start_date": this_week_start.date().isoformat(),
            "end_date": (this_week_end - timedelta(days=1)).date().isoformat(),
            "transaction_count": this_count,
        },
        "last_week": {
            "total": round(last_total, 2),
            "start_date": last_week_start.date().isoformat(),
            "end_date": (last_week_end - timedelta(days=1)).date().isoformat(),
            "transaction_count": last_count,
        },
        "change_percent": change_percent,
        "top_categories": top_categories,
        "budget_status": budget_status,
    }


@router.get("/financial-score")
async def get_financial_score(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Kullanıcının finansal sağlık skorunu hesaplar (0–100).

    Faktörler:
      1. Bütçe Uyumu          → max 30 puan
      2. Tasarruf Hedefi      → max 25 puan
      3. Harcama Düzenliliği  → max 20 puan  (anomali oranı)
      4. Gelir/Gider Dengesi  → max 15 puan
      5. Takip Aktifliği      → max 10 puan
    """
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # ── Son 30 günün fişleri ────────────────────────────────────────────────
    res = await db.execute(
        select(Receipt).where(
            Receipt.user_id == current_user.id,
            Receipt.created_at >= thirty_days_ago,
        )
    )
    recent_receipts = res.scalars().all()

    total_receipts = len(recent_receipts)
    income_30 = sum(float(r.total_amount or 0) for r in recent_receipts if r.receipt_type == "income")
    expense_30 = sum(float(r.total_amount or 0) for r in recent_receipts if r.receipt_type == "expense")
    anomaly_count = sum(1 for r in recent_receipts if r.is_anomaly)

    # ── Bu ayın bütçeleri ───────────────────────────────────────────────────
    budgets_res = await db.execute(
        select(Budget).where(Budget.user_id == current_user.id)
    )
    budgets = budgets_res.scalars().all()

    # Her bütçe için bu ay harcanan
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end = (month_start + timedelta(days=32)).replace(day=1)

    budget_usages = []
    for b in budgets:
        spent_res = await db.execute(
            select(func.coalesce(func.sum(Receipt.total_amount), 0)).where(
                Receipt.user_id == current_user.id,
                Receipt.category == b.category,
                Receipt.receipt_type == "expense",
                Receipt.receipt_date >= month_start,
                Receipt.receipt_date < month_end,
            )
        )
        spent = float(spent_res.scalar() or 0)
        pct = (spent / b.limit_amount * 100) if b.limit_amount > 0 else 0
        budget_usages.append(pct)

    # ── Tasarruf hedefi ─────────────────────────────────────────────────────
    from app.models.savings_goal import SavingsGoal
    goal_res = await db.execute(
        select(SavingsGoal).where(
            SavingsGoal.user_id == current_user.id,
            SavingsGoal.is_active == True,
        )
    )
    active_goal = goal_res.scalars().first()

    # Tüm zamanların toplam gelir - gider = birikmiş tutar
    all_res = await db.execute(
        select(Receipt).where(Receipt.user_id == current_user.id)
    )
    all_receipts = all_res.scalars().all()
    total_income_all = sum(float(r.total_amount or 0) for r in all_receipts if r.receipt_type == "income")
    total_expense_all = sum(float(r.total_amount or 0) for r in all_receipts if r.receipt_type == "expense")
    saved_amount = max(total_income_all - total_expense_all, 0)

    # ── FAKTÖR 1: Bütçe Uyumu (max 30) ────────────────────────────────────
    if budget_usages:
        avg_usage = sum(budget_usages) / len(budget_usages)
        over_budget_count = sum(1 for u in budget_usages if u > 100)
        if avg_usage <= 70 and over_budget_count == 0:
            budget_score = 30
        elif avg_usage <= 85 and over_budget_count == 0:
            budget_score = 22
        elif avg_usage <= 100 and over_budget_count == 0:
            budget_score = 15
        elif over_budget_count <= 1:
            budget_score = 8
        else:
            budget_score = 0
        budget_pct = round(avg_usage)
        if avg_usage <= 70:
            budget_desc = f"Bütçenin %{budget_pct}'ini kullandın, harika gidiyorsun!"
        elif avg_usage <= 85:
            budget_desc = f"Bütçenin %{budget_pct}'ini kullandın, dikkatli olman iyi olur."
        elif avg_usage <= 100:
            budget_desc = f"Bütçenin %{budget_pct}'ini kullandın, sınıra yaklaşıyorsun."
        else:
            budget_desc = f"Bütçen %{budget_pct - 100} oranında aşıldı."
    else:
        budget_score = 15  # Bütçe tanımlı değil → nötr
        budget_pct = 0
        budget_desc = "Henüz bütçe tanımlamadın. Bütçe oluşturarak skoru artırabilirsin."

    # ── FAKTÖR 2: Tasarruf Hedefi (max 25) ────────────────────────────────
    if active_goal:
        target = float(active_goal.target_amount)
        progress_pct = min((saved_amount / target * 100) if target > 0 else 0, 100)

        # Süre bazlı beklenti hesabı
        if active_goal.deadline:
            total_days = max((active_goal.deadline - active_goal.created_at).days, 1)
            elapsed_days = (now - active_goal.created_at.replace(tzinfo=timezone.utc)).days
            expected_pct = min((elapsed_days / total_days * 100), 100)
            ratio = (progress_pct / expected_pct) if expected_pct > 0 else 1.0
        else:
            ratio = progress_pct / 50  # Deadline yok → %50 hedef

        if ratio >= 1.0:
            savings_score = 25
            savings_desc = f"Hedefe %{round(progress_pct)} ulaştın, planın önünde!"
        elif ratio >= 0.75:
            savings_score = 18
            savings_desc = f"Hedefe %{round(progress_pct)} ulaştın, biraz daha hız kazanabilirsin."
        elif ratio >= 0.5:
            savings_score = 12
            savings_desc = f"Hedefe %{round(progress_pct)} ulaştın, planın gerisinde kalıyorsun."
        else:
            savings_score = 5
            savings_desc = f"Hedefe %{round(progress_pct)} ulaştın, tasarruflarını artırman gerekiyor."
        savings_pct = round(progress_pct)
    else:
        savings_score = 12  # Hedef yok → nötr
        savings_desc = "Aktif bir tasarruf hedefiniz yok. Hedef belirleyerek skoru artırabilirsin."
        savings_pct = 0

    # ── FAKTÖR 3: Harcama Düzenliliği (max 20) ────────────────────────────
    if total_receipts > 0:
        anomaly_rate = anomaly_count / total_receipts
        if anomaly_rate == 0:
            consistency_score = 20
            consistency_desc = "Son 30 günde hiç anormal harcama yok, süper!"
        elif anomaly_rate < 0.05:
            consistency_score = 15
            consistency_desc = f"{anomaly_count} küçük anormallik var ama genel tablo iyi."
        elif anomaly_rate < 0.10:
            consistency_score = 10
            consistency_desc = f"{anomaly_count} anormal harcama tespit edildi, gözden geçir."
        elif anomaly_rate < 0.20:
            consistency_score = 5
            consistency_desc = f"{anomaly_count} anormal harcama var, harcama alışkanlıklarını incele."
        else:
            consistency_score = 0
            consistency_desc = f"Son 30 günde {anomaly_count} anormal harcama var, dikkat et!"
        consistency_pct = round((1 - anomaly_rate) * 100)
    else:
        consistency_score = 10  # Veri yok → nötr
        consistency_desc = "Henüz yeterli veri yok. Fiş ekledikçe bu skor oluşacak."
        consistency_pct = 100

    # ── FAKTÖR 4: Gelir/Gider Dengesi (max 15) ────────────────────────────
    if expense_30 > 0:
        income_ratio = income_30 / expense_30 if expense_30 > 0 else 1.0
        if income_ratio >= 1.0:
            balance_score = 15
            balance_desc = "Gelirin gideri karşılıyor, finansal denge yerinde."
        elif income_ratio >= 0.75:
            balance_score = 10
            balance_desc = f"Gelirin giderin %{round(income_ratio * 100)}'ini karşılıyor."
        elif income_ratio >= 0.5:
            balance_score = 5
            balance_desc = "Giderler geliri önemli ölçüde aşıyor, dikkat et."
        else:
            balance_score = 0
            balance_desc = "Gelir-gider dengesi kritik seviyede, acil önlem al."
        balance_pct = min(round(income_ratio * 100), 100)
    elif income_30 > 0:
        balance_score = 15
        balance_desc = "Gelir var, gider kaydedilmemiş."
        balance_pct = 100
    else:
        balance_score = 7  # Veri yok → nötr
        balance_desc = "Gelir/gider verisi henüz yeterli değil."
        balance_pct = 50

    # ── FAKTÖR 5: Takip Aktifliği (max 10) ────────────────────────────────
    if total_receipts >= 20:
        activity_score = 10
        activity_desc = f"Son 30 günde {total_receipts} fiş girdin, mükemmel takip!"
    elif total_receipts >= 10:
        activity_score = 7
        activity_desc = f"Son 30 günde {total_receipts} fiş girdin, iyi gidiyorsun."
    elif total_receipts >= 5:
        activity_score = 5
        activity_desc = f"Son 30 günde {total_receipts} fiş girdin, daha düzenli takip faydalı olur."
    elif total_receipts >= 1:
        activity_score = 2
        activity_desc = f"Son 30 günde sadece {total_receipts} fiş var, daha sık kayıt tut."
    else:
        activity_score = 0
        activity_desc = "Son 30 günde hiç fiş girilmemiş."
    activity_pct = min(round(total_receipts / 20 * 100), 100)

    # ── TOPLAM SKOR & HARF NOTU ────────────────────────────────────────────
    total_score = budget_score + savings_score + consistency_score + balance_score + activity_score

    if total_score >= 85:
        grade, grade_label, grade_color = "A", "Mükemmel", "#2ECC71"
    elif total_score >= 70:
        grade, grade_label, grade_color = "B", "İyi", "#00A878"
    elif total_score >= 55:
        grade, grade_label, grade_color = "C", "Orta", "#FF9800"
    elif total_score >= 40:
        grade, grade_label, grade_color = "D", "Geliştirilebilir", "#FF7043"
    else:
        grade, grade_label, grade_color = "F", "Dikkat Gerekiyor", "#FF5252"

    # ── İYİLEŞTİRME ÖNERİLERİ ─────────────────────────────────────────────
    tips = []
    if budget_score < 22 and budget_usages:
        over = [b for b in budgets if budget_usages[budgets.index(b)] > 85]
        if over:
            tips.append(f"{_cat_label(over[0].category)} kategorisinde bütçeni aştın veya sınıra yaklaştın.")
    if budget_score == 15 and not budget_usages:
        tips.append("Bütçe oluştur — harcamalarını kategori bazında kontrol altına al.")
    if savings_score < 18 and active_goal:
        tips.append("Tasarruf hedefinize ulaşmak için aylık harcamalarını kısmayı dene.")
    if savings_score == 12 and not active_goal:
        tips.append("Bir tasarruf hedefi belirle — küçük bir hedefle başlamak bile skoru artırır.")
    if consistency_score < 15 and anomaly_count > 0:
        tips.append(f"Analize göre {anomaly_count} olağandışı harcaman var. Fişlere göz at.")
    if balance_score < 10 and expense_30 > 0:
        tips.append("Giderler geliri aşıyor. Gereksiz harcamaları kısarak dengeyi kur.")
    if activity_score < 7:
        tips.append("Fişlerini düzenli kaydetmek hem skoru yükseltir hem de bütçeni daha iyi kontrol etmeni sağlar.")
    if not tips:
        tips.append("Finansal sağlığın çok iyi görünüyor! Aynı alışkanlıkları sürdür.")

    return {
        "total_score": total_score,
        "grade": grade,
        "grade_label": grade_label,
        "grade_color": grade_color,
        "calculated_at": now.isoformat(),
        "factors": [
            {
                "id": "budget",
                "label": "Bütçe Uyumu",
                "score": budget_score,
                "max_score": 30,
                "percentage": budget_pct,
                "description": budget_desc,
                "icon": "wallet-outline",
                "color": "#008080",
            },
            {
                "id": "savings",
                "label": "Tasarruf Hedefi",
                "score": savings_score,
                "max_score": 25,
                "percentage": savings_pct,
                "description": savings_desc,
                "icon": "trophy-outline",
                "color": "#2ECC71",
            },
            {
                "id": "consistency",
                "label": "Harcama Düzenliliği",
                "score": consistency_score,
                "max_score": 20,
                "percentage": consistency_pct,
                "description": consistency_desc,
                "icon": "pulse-outline",
                "color": "#9B59B6",
            },
            {
                "id": "balance",
                "label": "Gelir/Gider Dengesi",
                "score": balance_score,
                "max_score": 15,
                "percentage": balance_pct,
                "description": balance_desc,
                "icon": "scale-outline",
                "color": "#3498DB",
            },
            {
                "id": "activity",
                "label": "Takip Aktifliği",
                "score": activity_score,
                "max_score": 10,
                "percentage": activity_pct,
                "description": activity_desc,
                "icon": "checkmark-circle-outline",
                "color": "#F39C12",
            },
        ],
        "tips": tips,
    }


# ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

def _days_in_month(year: int, month: int) -> int:
    import calendar
    return calendar.monthrange(year, month)[1]


def _month_offset(year: int, month: int, offset: int) -> tuple[int, int]:
    """Ay offseti hesapla (negatif = geçmiş)."""
    total = (year * 12 + month - 1) + offset
    return total // 12, total % 12 + 1



@router.post("/ml/retrain")
async def retrain_model(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    ML kategori modelini kullanıcı feedback verisiyle yeniden eğitir.
    Tüm kullanıcıların feedback'i kullanılır (genel model iyileştirmesi).
    """
    from app.services.model_trainer import retrain_with_feedback
    result = await retrain_with_feedback(db)
    return result
