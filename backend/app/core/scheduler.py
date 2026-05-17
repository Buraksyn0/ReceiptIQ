"""
Cron job'lar:
  1. Her gece 00:00 UTC — vadesi gelen tekrarlayan işlemleri işle
  2. Her Pazar 19:00 UTC — haftalık özet push bildirimi gönder
"""
import calendar
import logging
from datetime import datetime, timedelta, timezone
from collections import defaultdict

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, func

from app.db.session import AsyncSessionLocal
from app.models.recurring import RecurringTransaction
from app.models.receipt import Receipt
from app.models.user import User

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _next_date_after(current: datetime, frequency: str) -> datetime:
    """Bir sonraki tekrar tarihini hesaplar."""
    if frequency == "daily":
        return current + timedelta(days=1)
    elif frequency == "weekly":
        return current + timedelta(weeks=1)
    elif frequency == "yearly":
        return current.replace(year=current.year + 1)
    else:  # monthly
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(current.day, max_day)
        return current.replace(year=year, month=month, day=day)


async def _send_push_notifications(user_items: dict[str, list]) -> None:
    """
    Expo Push API'ye toplu bildirim gönderir.
    user_items: {push_token: [item_name, ...]}
    """
    messages = []
    for token, names in user_items.items():
        if not token or not token.startswith("ExponentPushToken"):
            continue
        if len(names) == 1:
            title = "Otomatik Ödeme İşlendi 💳"
            body = f"{names[0]} ödemeni otomatik olarak kaydettik."
        else:
            title = f"{len(names)} Otomatik Ödeme İşlendi 💳"
            body = ", ".join(names[:3])
            if len(names) > 3:
                body += f" ve {len(names) - 3} diğeri"

        messages.append({
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": {"type": "recurring"},
        })

    if not messages:
        return

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json"},
            )
            logger.info(f"[Scheduler] Push gönderildi: {resp.status_code} — {len(messages)} bildirim")
    except Exception as e:
        logger.error(f"[Scheduler] Push hatası: {e}")


async def process_all_recurring():
    """Vadesi gelen tüm tekrarlayan işlemleri işle ve bildirim gönder."""
    now = datetime.utcnow()
    processed = 0
    # push_token → işlem adları listesi
    user_notifications: dict[str, list] = defaultdict(list)

    async with AsyncSessionLocal() as db:
        try:
            # Vadesi gelmiş aktif tekrarlar
            result = await db.execute(
                select(RecurringTransaction).where(
                    RecurringTransaction.is_active == True,
                    RecurringTransaction.next_date <= now,
                )
            )
            due_items = result.scalars().all()

            if not due_items:
                logger.info("[Scheduler] Vadesi gelen tekrar yok.")
                return

            # Kullanıcı tokenlarını tek seferde çek
            user_ids = list({item.user_id for item in due_items})
            users_result = await db.execute(
                select(User.id, User.push_token).where(User.id.in_(user_ids))
            )
            token_map = {str(row.id): row.push_token for row in users_result}

            for item in due_items:
                new_receipt = Receipt(
                    user_id=item.user_id,
                    merchant_name=item.merchant_name,
                    total_amount=item.amount,
                    category=item.category,
                    receipt_type=item.receipt_type,
                    receipt_date=now,
                    text_content="Otomatik tekrarlayan işlem",
                )
                db.add(new_receipt)
                item.next_date = _next_date_after(item.next_date, item.frequency)
                db.add(item)
                processed += 1

                token = token_map.get(str(item.user_id))
                if token:
                    user_notifications[token].append(item.merchant_name)

            await db.commit()
            logger.info(f"[Scheduler] {processed} tekrarlayan işlem otomatik işlendi.")

        except Exception as e:
            await db.rollback()
            logger.error(f"[Scheduler] Hata: {e}")
            return

    # DB commit sonrası push gönder
    await _send_push_notifications(user_notifications)


async def retrain_ml_model():
    """Her Pazartesi 02:00 UTC — feedback verisiyle ML modelini yeniden eğit."""
    async with AsyncSessionLocal() as db:
        try:
            from app.services.model_trainer import retrain_with_feedback
            result = await retrain_with_feedback(db)
            logger.info(
                "[Scheduler] ML retrain: %d feedback, accuracy=%s",
                result.get("feedback_count", 0),
                result.get("accuracy"),
            )
        except Exception as e:
            logger.error(f"[Scheduler] ML retrain hatası: {e}")


async def send_weekly_summary():
    """Her Pazar 19:00 UTC — haftalık özet push bildirimi gönder."""
    now = datetime.now(timezone.utc)

    # Bu haftanın başı (Pazartesi)
    days_since_monday = now.weekday()
    this_week_start = (now - timedelta(days=days_since_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    this_week_end = now  # Pazar akşamı bildirimi — haftanın sonu

    # Geçen hafta
    last_week_start = this_week_start - timedelta(days=7)
    last_week_end = this_week_start

    messages = []

    async with AsyncSessionLocal() as db:
        try:
            # Push token'ı olan tüm kullanıcılar
            users_result = await db.execute(
                select(User).where(User.push_token.isnot(None))
            )
            users = users_result.scalars().all()

            for user in users:
                if not user.push_token or not user.push_token.startswith("ExponentPushToken"):
                    continue

                # Bu haftanın toplam gideri
                this_result = await db.execute(
                    select(func.sum(Receipt.total_amount)).where(
                        Receipt.user_id == user.id,
                        Receipt.receipt_type == "expense",
                        Receipt.total_amount > 0,
                        Receipt.receipt_date >= this_week_start,
                        Receipt.receipt_date < this_week_end,
                    )
                )
                this_total = float(this_result.scalar() or 0)

                # Geçen haftanın toplam gideri
                last_result = await db.execute(
                    select(func.sum(Receipt.total_amount)).where(
                        Receipt.user_id == user.id,
                        Receipt.receipt_type == "expense",
                        Receipt.total_amount > 0,
                        Receipt.receipt_date >= last_week_start,
                        Receipt.receipt_date < last_week_end,
                    )
                )
                last_total = float(last_result.scalar() or 0)

                # Hiç harcama yoksa bildirim gönderme
                if this_total == 0 and last_total == 0:
                    continue

                # Bildirim metni
                if last_total > 0:
                    change = ((this_total - last_total) / last_total) * 100
                    if change > 0:
                        trend = f"geçen haftadan %{abs(change):.0f} fazla"
                    elif change < 0:
                        trend = f"geçen haftadan %{abs(change):.0f} az"
                    else:
                        trend = "geçen haftayla aynı"
                    body = f"Bu hafta {this_total:,.0f}₺ harcadın — {trend} 📊"
                else:
                    body = f"Bu hafta toplam {this_total:,.0f}₺ harcadın 📊"

                messages.append({
                    "to": user.push_token,
                    "title": "Haftalık Özet",
                    "body": body,
                    "sound": "default",
                    "data": {"type": "weekly_summary"},
                })

        except Exception as e:
            logger.error(f"[Scheduler] Haftalık özet hazırlanırken hata: {e}")
            return

    if not messages:
        logger.info("[Scheduler] Haftalık özet: gönderilecek bildirim yok.")
        return

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json"},
            )
            logger.info(f"[Scheduler] Haftalık özet push: {resp.status_code} — {len(messages)} kullanıcı")
    except Exception as e:
        logger.error(f"[Scheduler] Haftalık özet push hatası: {e}")


def start_scheduler():
    """Cron job'ları başlat."""
    # Tekrarlayan işlemler — her gece 00:00 UTC
    scheduler.add_job(
        process_all_recurring,
        trigger=CronTrigger(hour=0, minute=0, timezone="UTC"),
        id="process_recurring",
        name="Tekrarlayan işlemleri işle",
        replace_existing=True,
    )
    # Haftalık özet bildirimi — her Pazar 19:00 UTC (TR: 22:00)
    scheduler.add_job(
        send_weekly_summary,
        trigger=CronTrigger(day_of_week="sun", hour=19, minute=0, timezone="UTC"),
        id="weekly_summary",
        name="Haftalık özet bildirimi gönder",
        replace_existing=True,
    )
    # ML model yeniden eğitimi — her Pazartesi 02:00 UTC
    scheduler.add_job(
        retrain_ml_model,
        trigger=CronTrigger(day_of_week="mon", hour=2, minute=0, timezone="UTC"),
        id="ml_retrain",
        name="ML kategori modeli yeniden eğit",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] Başlatıldı — gece 00:00 tekrarlayan + Pazar 19:00 haftalık özet + Pazartesi 02:00 ML retrain.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[Scheduler] Durduruldu.")
