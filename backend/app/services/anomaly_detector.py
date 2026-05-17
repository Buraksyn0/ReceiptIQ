"""
ReceiptIQ — Anomali Tespiti Servisi (IQR Yöntemi)

Kullanıcının aynı kategorideki geçmiş harcamalarına bakarak
yeni fişin anormal olup olmadığını tespit eder.

Yöntem: IQR (Interquartile Range)
  - Q1 (25. yüzdelik) ve Q3 (75. yüzdelik) hesapla
  - IQR = Q3 - Q1
  - Alt sınır = Q1 - 1.5 * IQR
  - Üst sınır = Q3 + 1.5 * IQR
  - Yeni tutar bu sınırların dışındaysa anomali

Minimum veri: En az 5 fiş olmadan anomali tespiti yapma
(az veriyle yanlış pozitif üretmemek için)
"""

from __future__ import annotations
import logging
import statistics
from decimal import Decimal
from typing import Optional

log = logging.getLogger(__name__)

MIN_SAMPLES = 5  # Anomali tespiti için gereken minimum fiş sayısı


def detect_anomaly(
    new_amount: Decimal | float,
    historical_amounts: list[float],
) -> tuple[bool, float]:
    """
    Yeni tutarın anormal olup olmadığını tespit eder.

    Args:
        new_amount: Yeni fişin tutarı
        historical_amounts: Aynı kategorideki geçmiş tutarlar (yeni fiş HARİÇ)

    Returns:
        (is_anomaly: bool, anomaly_score: float)
        anomaly_score: 0.0 = normal, 1.0+ = anomali (ne kadar büyükse o kadar anormal)
    """
    amount = float(new_amount)

    if len(historical_amounts) < MIN_SAMPLES:
        log.debug(
            "Yetersiz veri: %d örnek var, %d gerekli",
            len(historical_amounts),
            MIN_SAMPLES,
        )
        return False, 0.0

    try:
        sorted_amounts = sorted(historical_amounts)
        n = len(sorted_amounts)

        # Q1 ve Q3 hesapla
        q1_idx = n // 4
        q3_idx = (3 * n) // 4
        q1 = sorted_amounts[q1_idx]
        q3 = sorted_amounts[q3_idx]

        iqr = q3 - q1

        # IQR 0 ise (tüm değerler aynı) — std kullan
        if iqr == 0:
            try:
                std = statistics.stdev(historical_amounts)
                if std == 0:
                    return False, 0.0
                mean = statistics.mean(historical_amounts)
                z_score = abs(amount - mean) / std
                is_anomaly = z_score > 3.0
                return is_anomaly, round(z_score / 3.0, 3)
            except Exception:
                return False, 0.0

        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        if amount < lower or amount > upper:
            # Kaç IQR uzakta olduğunu hesapla (normalize skor)
            if amount > upper:
                score = (amount - upper) / iqr
            else:
                score = (lower - amount) / iqr
            is_anomaly = True
        else:
            # Üst sınıra olan uzaklığı normalize et (0-1 arası)
            score = max(0.0, (amount - (q3 - 0.5 * iqr)) / (0.5 * iqr + 1))
            is_anomaly = False

        return is_anomaly, round(score, 3)

    except Exception as e:
        log.error("Anomali hesaplama hatası: %s", e)
        return False, 0.0


async def check_receipt_anomaly(
    db,
    user_id,
    receipt_id,
    category: str,
    amount: Optional[Decimal],
) -> tuple[bool, float]:
    """
    Veritabanından geçmiş fişleri çekip anomali kontrolü yapar.

    Args:
        db: AsyncSession
        user_id: UUID
        receipt_id: Yeni fişin UUID'si (geçmişten HARİÇ tutmak için)
        category: Fişin kategorisi
        amount: Fişin tutarı

    Returns:
        (is_anomaly: bool, anomaly_score: float)
    """
    if amount is None or float(amount) <= 0:
        return False, 0.0

    from sqlalchemy import select
    from app.models.receipt import Receipt

    # Aynı kategorideki geçmiş fişlerin tutarlarını al (yeni fiş hariç)
    result = await db.execute(
        select(Receipt.total_amount).where(
            Receipt.user_id == user_id,
            Receipt.category == category,
            Receipt.id != receipt_id,
            Receipt.total_amount.isnot(None),
            Receipt.total_amount > 0,
        )
    )
    rows = result.scalars().all()
    historical = [float(r) for r in rows]

    log.info(
        "Anomali kontrolü: kategori=%s, geçmiş=%d fiş, yeni=%.2f",
        category,
        len(historical),
        float(amount),
    )

    return detect_anomaly(amount, historical)
