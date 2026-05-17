"""
ReceiptIQ — Akıllı Chat Servisi

İki katmanlı bağlam stratejisi:
  1. DB ANALİTİK: Kullanıcının tüm harcama özeti (bu ay, geçen ay, kategori toplamları)
     — "bu ay en çok neye harcadım", "toplam giderim ne" gibi soruları karşılar
  2. RAG (Qdrant): Soruyla en alakalı bireysel fişler
     — "Migros'a ne zaman gittim", "yakıt fişim var mıydı" gibi soruları karşılar

Her iki bağlam GPT-4o'ya birlikte verilir.
"""

from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """Sen ReceiptIQ'nun akıllı kişisel finans asistanısın.
Kullanıcının fiş ve işlem verilerini analiz ederek sorularını yanıtlarsın.
Aynı zamanda samimi ve yardımsever bir asistansın; selamlaşma ve genel sohbete de doğal şekilde katılırsın.

Kurallar:
- Her zaman Türkçe yanıt ver
- Kısa ve net ol (2-5 cümle yeterli)
- Selamlama veya genel sorularda sıcak ve samimi yanıt ver, ardından finansal konulara nazikçe yönlendir
- Finansal sorularda sana verilen GERÇEK verilere dayan; tahmin veya varsayım yapma
- Tutar bilgilerinde ₺ sembolü kullan
- Tarih bilgilerini Türkçe formatla (15 Ocak 2026 gibi)
- Kategori adları Türkçe göster (food→Gıda, transport→Ulaşım vb.)
- Finansal veri yoksa "Bu konuda henüz yeterli veri bulunamadı." de
- Kullanıcıya bütçesini aşıyorsa veya fazla harcıyorsa nazikçe uyar
"""

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


def _label(cat: str) -> str:
    return CATEGORY_LABELS.get(cat, cat)


async def _build_analytics_context(db: AsyncSession, user_id: uuid.UUID) -> str:
    """
    DB'den kullanıcının harcama özetini çeker.
    Bu ay, geçen ay ve kategori bazında toplamları döner.
    """
    from app.models.receipt import Receipt

    now = datetime.now(timezone.utc)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Geçen ayın başı ve sonu
    if now.month == 1:
        last_month_start = now.replace(year=now.year - 1, month=12, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        last_month_start = now.replace(month=now.month - 1, day=1, hour=0, minute=0, second=0, microsecond=0)

    # --- Bu ay özeti ---
    this_month_result = await db.execute(
        select(
            Receipt.receipt_type,
            func.sum(Receipt.total_amount).label("total"),
        )
        .where(
            Receipt.user_id == user_id,
            Receipt.receipt_date >= this_month_start,
        )
        .group_by(Receipt.receipt_type)
    )
    this_month_rows = this_month_result.all()

    this_income = sum(float(r.total) for r in this_month_rows if r.receipt_type == "income")
    this_expense = sum(float(r.total) for r in this_month_rows if r.receipt_type != "income")

    # --- Bu ay kategori bazında gider ---
    cat_result = await db.execute(
        select(
            Receipt.category,
            func.sum(Receipt.total_amount).label("total"),
        )
        .where(
            Receipt.user_id == user_id,
            Receipt.receipt_date >= this_month_start,
            Receipt.receipt_type == "expense",
        )
        .group_by(Receipt.category)
        .order_by(func.sum(Receipt.total_amount).desc())
    )
    cat_rows = cat_result.all()

    # --- Geçen ay özeti ---
    last_month_result = await db.execute(
        select(func.sum(Receipt.total_amount))
        .where(
            Receipt.user_id == user_id,
            Receipt.receipt_date >= last_month_start,
            Receipt.receipt_date < this_month_start,
            Receipt.receipt_type == "expense",
        )
    )
    last_month_expense = float(last_month_result.scalar() or 0)

    # --- Son 5 işlem ---
    recent_result = await db.execute(
        select(Receipt)
        .where(Receipt.user_id == user_id)
        .order_by(Receipt.receipt_date.desc())
        .limit(5)
    )
    recent = recent_result.scalars().all()

    # --- Bağlam metni oluştur ---
    lines = ["=== KULLANICI FİNANS ÖZETİ ===\n"]

    month_name = now.strftime("%B %Y")
    lines.append(f"📅 Bu ay ({month_name}):")
    lines.append(f"  • Toplam gider: ₺{this_expense:,.2f}")
    lines.append(f"  • Toplam gelir: ₺{this_income:,.2f}")
    lines.append(f"  • Net bakiye: ₺{this_income - this_expense:,.2f}")

    if last_month_expense > 0:
        diff = this_expense - last_month_expense
        sign = "+" if diff >= 0 else ""
        lines.append(f"\n📊 Geçen aya göre gider farkı: {sign}₺{diff:,.2f}")

    if cat_rows:
        lines.append(f"\n🏷️ Bu ay kategori bazında giderler:")
        for row in cat_rows:
            label = _label(row.category or "other")
            lines.append(f"  • {label}: ₺{float(row.total):,.2f}")
        top_cat = _label(cat_rows[0].category or "other")
        lines.append(f"\n🔝 En fazla harcanan kategori: {top_cat} (₺{float(cat_rows[0].total):,.2f})")

    if recent:
        lines.append(f"\n🧾 Son işlemler:")
        for r in recent:
            date_str = r.receipt_date.strftime("%d.%m.%Y") if r.receipt_date else "?"
            label = _label(r.category or "other")
            tip = "Gelir" if r.receipt_type == "income" else "Gider"
            lines.append(f"  • {date_str} | {r.merchant_name or 'Bilinmiyor'} | {label} | ₺{float(r.total_amount or 0):,.2f} ({tip})")

    return "\n".join(lines)


def _format_rag_context(receipts: list[dict]) -> str:
    """RAG'dan gelen bireysel fişleri formatla."""
    if not receipts:
        return ""
    lines = ["\n=== İLGİLİ FİŞLER (Vektör Arama) ===\n"]
    for i, r in enumerate(receipts, 1):
        lines.append(f"{i}. {r.get('merchant_name', 'Bilinmiyor')}")
        if r.get("category"):
            lines.append(f"   Kategori: {_label(r['category'])}")
        if r.get("amount"):
            lines.append(f"   Tutar: ₺{r['amount']}")
        if r.get("date"):
            lines.append(f"   Tarih: {r['date']}")
        if r.get("text"):
            lines.append(f"   Fiş metni: {r['text'][:200]}")
        lines.append("")
    return "\n".join(lines)


def _build_sources_text(relevant: list[dict]) -> str:
    """RAG'dan dönen fişleri kaynak satırlarına dönüştür."""
    if not relevant:
        return ""

    MONTHS_TR = [
        "", "Oca", "Şub", "Mar", "Nis", "May", "Haz",
        "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
    ]

    def fmt_date(raw: str) -> str:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return f"{dt.day} {MONTHS_TR[dt.month]} {dt.year}"
        except Exception:
            return raw

    lines = ["||SOURCES||"]
    for r in relevant:
        merchant = r.get("merchant_name") or "Bilinmiyor"
        date_str = fmt_date(r.get("date") or "") if r.get("date") else "?"
        amount = r.get("amount")
        amount_str = f" · ₺{amount}" if amount else ""
        lines.append(f"{merchant} ({date_str}{amount_str})")
    return "\n".join(lines)


async def chat_with_receipts(
    db: AsyncSession,
    user_id: uuid.UUID,
    question: str,
) -> str:
    """
    Kullanıcının sorusuna DB analitik + RAG + GPT-4o ile yanıt üretir.
    Yanıta ilgili fişler kaynak olarak eklenir.
    """
    # 1. DB'den gerçek analitik özet
    analytics_context = await _build_analytics_context(db, user_id)

    # 2. RAG: soruyla alakalı bireysel fişler (opsiyonel, hata olursa atla)
    rag_context = ""
    relevant_receipts = []
    try:
        from app.services.embedder import embed_text
        from app.services.vector_store import search_receipts

        query_vector = embed_text(question)
        if query_vector is not None:
            relevant_receipts = search_receipts(user_id=user_id, query_vector=query_vector, limit=4)
            rag_context = _format_rag_context(relevant_receipts)
    except Exception as e:
        log.warning("RAG arama başarısız (devam ediliyor): %s", e)

    # 3. GPT-4o'ya sor
    full_context = analytics_context + rag_context

    try:
        from openai import AsyncOpenAI
        from app.core.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{full_context}\n\nKullanıcı sorusu: {question}"},
            ],
            temperature=0.3,
            max_tokens=600,
        )
        answer = response.choices[0].message.content or "Yanıt üretilemedi."

        # 4. Kaynak fişleri yanıta ekle
        if relevant_receipts:
            sources_text = _build_sources_text(relevant_receipts)
            answer = f"{answer}\n{sources_text}"

        return answer

    except Exception as e:
        log.error("GPT chat hatası: %s", e)
        return "Şu an yanıt üretemiyorum, lütfen tekrar dene."


SAVINGS_SYSTEM_PROMPT = """Sen ReceiptIQ'nun kişisel tasarruf danışmanısın.
Kullanıcının tasarruf hedefi ve finansal verilerini analiz ederek yardımcı olursun.
Aynı zamanda samimi ve yardımsever bir asistansın; selamlaşma ve genel sohbete de doğal şekilde katılırsın.

Kurallar:
- Her zaman Türkçe yanıt ver
- Kısa, net ve motive edici ol (2-4 cümle)
- Selamlama veya genel sorularda sıcak yanıt ver, ardından tasarruf hedefine nazikçe yönlendir
- Tasarruf sorularında sana verilen GERÇEK verilere dayan
- Tutar bilgilerinde ₺ sembolü kullan
- Pratik ve uygulanabilir tavsiyeler ver
- Kullanıcıyı hedefe ulaşması için teşvik et
- Veri yoksa "Bu konuda henüz yeterli veri bulunamadı." de
"""


async def _build_savings_context(db: AsyncSession, user_id: uuid.UUID) -> str:
    """Kullanıcının aktif tasarruf hedefi ve ilerleme bağlamını oluşturur."""
    from datetime import datetime, timezone
    from collections import defaultdict
    from app.models.savings_goal import SavingsGoal
    from app.models.receipt import Receipt
    from sqlalchemy import select

    result = await db.execute(
        select(SavingsGoal).where(
            SavingsGoal.user_id == user_id,
            SavingsGoal.is_active == True,
        ).order_by(SavingsGoal.created_at.desc()).limit(1)
    )
    goal = result.scalars().first()

    if not goal:
        return "=== TASARRUF HEDEFİ ===\nKullanıcının aktif bir tasarruf hedefi yok.\n"

    receipts_result = await db.execute(
        select(Receipt).where(
            Receipt.user_id == user_id,
            Receipt.receipt_date >= goal.created_at,
        )
    )
    receipts = receipts_result.scalars().all()

    income = sum(float(r.total_amount) for r in receipts if r.receipt_type == "income")
    expense = sum(float(r.total_amount) for r in receipts if r.receipt_type == "expense")
    saved = max(income - expense, 0)
    target = float(goal.target_amount)
    progress = min(round((saved / target) * 100, 1), 100) if target > 0 else 0
    remaining = max(target - saved, 0)

    # Aylık ortalama
    monthly_map: dict = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for r in receipts:
        if r.receipt_date:
            key = r.receipt_date.strftime("%Y-%m")
            if r.receipt_type == "income":
                monthly_map[key]["income"] += float(r.total_amount)
            else:
                monthly_map[key]["expense"] += float(r.total_amount)

    monthly_nets = [v["income"] - v["expense"] for v in monthly_map.values()]
    positive = [n for n in monthly_nets if n > 0]
    avg_monthly = round(sum(positive) / len(positive), 2) if positive else 0

    estimated = round(remaining / avg_monthly, 1) if avg_monthly > 0 and remaining > 0 else None

    lines = ["=== TASARRUF HEDEFİ DURUMU ===\n"]
    lines.append(f"Hedef adı: {goal.title}")
    lines.append(f"Hedef tutar: ₺{target:,.2f}")
    lines.append(f"Biriktirilen: ₺{saved:,.2f}")
    lines.append(f"Kalan: ₺{remaining:,.2f}")
    lines.append(f"İlerleme: %{progress}")
    lines.append(f"Aylık ortalama tasarruf: ₺{avg_monthly:,.2f}" if avg_monthly > 0 else "Henüz yeterli aylık veri yok.")
    if estimated is not None:
        lines.append(f"Bu hızla tahmini hedefe ulaşma süresi: {estimated} ay")
    if goal.deadline:
        now = datetime.now(timezone.utc)
        days_left = (goal.deadline.replace(tzinfo=timezone.utc) - now).days
        months_left = max(days_left / 30, 0.1)
        req = round(remaining / months_left, 2) if remaining > 0 else 0
        lines.append(f"Son tarih: {goal.deadline.strftime('%d.%m.%Y')} ({max(days_left, 0)} gün kaldı)")
        lines.append(f"Hedefe ulaşmak için gereken aylık tasarruf: ₺{req:,.2f}")
    lines.append(f"\nGenel finans özeti:")
    lines.append(f"  • Hedef başlangıcından bu yana toplam gelir: ₺{income:,.2f}")
    lines.append(f"  • Hedef başlangıcından bu yana toplam gider: ₺{expense:,.2f}")

    return "\n".join(lines)


FINANCIAL_SCORE_SYSTEM_PROMPT = """Sen ReceiptIQ'nun kişisel finansal sağlık danışmanısın.
Kullanıcının finansal skor verilerini, harcama alışkanlıklarını ve bütçe durumunu analiz ederek yardımcı olursun.
Aynı zamanda samimi ve yardımsever bir asistansın; selamlaşma ve genel sohbete de doğal şekilde katılırsın.

Kurallar:
- Her zaman Türkçe yanıt ver
- Kısa, net ve motive edici ol (2-5 cümle)
- Selamlama veya genel sorularda sıcak yanıt ver, ardından finansal sağlık konularına nazikçe yönlendir
- Finansal sorularda sana verilen GERÇEK skor ve faktör verilerine dayan
- Tutar bilgilerinde ₺ sembolü kullan
- Skoru artırmak için somut, uygulanabilir adımlar öner
- Kullanıcıyı olumsuz yargılama, yapıcı ol
- Finansal terminolojiyi basit Türkçeyle açıkla
- Veri yoksa "Bu konuda henüz yeterli veri bulunamadı." de
"""


async def _build_financial_score_context(db: AsyncSession, user_id: uuid.UUID) -> str:
    """Finansal skor hesaplayıp bağlam metni oluşturur."""
    from datetime import timedelta
    from app.models.receipt import Receipt
    from app.models.budget import Budget
    from app.models.savings_goal import SavingsGoal

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Son 30 günün fişleri
    res = await db.execute(
        select(Receipt).where(
            Receipt.user_id == user_id,
            Receipt.created_at >= thirty_days_ago,
        )
    )
    recent = res.scalars().all()

    total_receipts = len(recent)
    income_30 = sum(float(r.total_amount or 0) for r in recent if r.receipt_type == "income")
    expense_30 = sum(float(r.total_amount or 0) for r in recent if r.receipt_type == "expense")
    anomaly_count = sum(1 for r in recent if r.is_anomaly)

    # Bütçeler
    budget_res = await db.execute(select(Budget).where(Budget.user_id == user_id))
    budgets = budget_res.scalars().all()

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end = (month_start + timedelta(days=32)).replace(day=1)

    from sqlalchemy import func as sqlfunc
    budget_lines = []
    for b in budgets:
        spent_res = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Receipt.total_amount), 0)).where(
                Receipt.user_id == user_id,
                Receipt.category == b.category,
                Receipt.receipt_type == "expense",
                Receipt.receipt_date >= month_start,
                Receipt.receipt_date < month_end,
            )
        )
        spent = float(spent_res.scalar() or 0)
        pct = round(spent / b.limit_amount * 100) if b.limit_amount > 0 else 0
        status = "✅" if pct <= 85 else "⚠️" if pct <= 100 else "❌ AŞILDI"
        budget_lines.append(
            f"  • {b.category}: ₺{spent:,.2f} / ₺{b.limit_amount:,.2f} limit (%{pct}) {status}"
        )

    # Tasarruf hedefi
    goal_res = await db.execute(
        select(SavingsGoal).where(
            SavingsGoal.user_id == user_id,
            SavingsGoal.is_active == True,
        )
    )
    goal = goal_res.scalars().first()

    all_res = await db.execute(select(Receipt).where(Receipt.user_id == user_id))
    all_receipts = all_res.scalars().all()
    total_income_all = sum(float(r.total_amount or 0) for r in all_receipts if r.receipt_type == "income")
    total_expense_all = sum(float(r.total_amount or 0) for r in all_receipts if r.receipt_type == "expense")
    saved_amount = max(total_income_all - total_expense_all, 0)

    lines = ["=== FİNANSAL SAĞLIK BAĞLAMI ===\n"]

    lines.append("📊 Son 30 Günlük Özet:")
    lines.append(f"  • Toplam fiş sayısı: {total_receipts}")
    lines.append(f"  • Gelir: ₺{income_30:,.2f}")
    lines.append(f"  • Gider: ₺{expense_30:,.2f}")
    if expense_30 > 0:
        ratio = round(income_30 / expense_30 * 100)
        lines.append(f"  • Gelir/Gider oranı: %{ratio}")
    lines.append(f"  • Anormal harcama sayısı: {anomaly_count}")

    if budget_lines:
        lines.append("\n💰 Bu Ay Bütçe Durumu:")
        lines.extend(budget_lines)
    else:
        lines.append("\n💰 Tanımlı bütçe yok.")

    if goal:
        target = float(goal.target_amount)
        progress = min(round(saved_amount / target * 100, 1), 100) if target > 0 else 0
        remaining = max(target - saved_amount, 0)
        lines.append(f"\n🏆 Tasarruf Hedefi: {goal.title}")
        lines.append(f"  • Hedef: ₺{target:,.2f} | Biriktirilen: ₺{saved_amount:,.2f}")
        lines.append(f"  • İlerleme: %{progress} | Kalan: ₺{remaining:,.2f}")
    else:
        lines.append("\n🏆 Aktif tasarruf hedefi yok.")

    lines.append(f"\n💳 Tüm zamanlar: Toplam gelir ₺{total_income_all:,.2f}, Toplam gider ₺{total_expense_all:,.2f}")

    return "\n".join(lines)


async def chat_with_financial_score(
    db: AsyncSession,
    user_id: uuid.UUID,
    question: str,
) -> str:
    """
    Finansal skor bağlamıyla GPT-4o'ya sor.
    """
    score_context = await _build_financial_score_context(db, user_id)
    analytics_context = await _build_analytics_context(db, user_id)
    full_context = score_context + "\n\n" + analytics_context

    try:
        from openai import AsyncOpenAI
        from app.core.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": FINANCIAL_SCORE_SYSTEM_PROMPT},
                {"role": "user", "content": f"{full_context}\n\nKullanıcı sorusu: {question}"},
            ],
            temperature=0.4,
            max_tokens=500,
        )
        return response.choices[0].message.content or "Yanıt üretilemedi."

    except Exception as e:
        log.error("Financial score GPT chat hatası: %s", e)
        return "Şu an yanıt üretemiyorum, lütfen tekrar dene."


async def chat_with_savings_goal(
    db: AsyncSession,
    user_id: uuid.UUID,
    question: str,
) -> str:
    """
    Tasarruf hedefi bağlamıyla GPT-4o'ya sor.
    """
    savings_context = await _build_savings_context(db, user_id)
    analytics_context = await _build_analytics_context(db, user_id)
    full_context = savings_context + "\n\n" + analytics_context

    try:
        from openai import AsyncOpenAI
        from app.core.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SAVINGS_SYSTEM_PROMPT},
                {"role": "user", "content": f"{full_context}\n\nKullanıcı sorusu: {question}"},
            ],
            temperature=0.4,
            max_tokens=400,
        )
        return response.choices[0].message.content or "Yanıt üretilemedi."

    except Exception as e:
        log.error("Savings GPT chat hatası: %s", e)
        return "Şu an yanıt üretemiyorum, lütfen tekrar dene."
