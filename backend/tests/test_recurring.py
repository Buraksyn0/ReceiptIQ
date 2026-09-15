"""
_next_date_after için unit testler — veritabanı/HTTP yok, fonksiyonu
doğrudan çağırıyoruz. Bu yüzden fonksiyonlar `async def` DEĞİL, düz `def`.
"""
from datetime import datetime

from app.api.endpoints.recurring import _next_date_after


def test_daily_adds_one_day():
    current = datetime(2026, 3, 10)
    result = _next_date_after(current, "daily")
    assert result == datetime(2026, 3, 11)


def test_weekly_adds_seven_days():
    current = datetime(2026, 3, 10)
    result = _next_date_after(current, "weekly")
    assert result == datetime(2026, 3, 17)


def test_monthly_handles_short_month_truncation():
    """31 Ocak + aylık -> Şubat'ta 31 gün yok, 28'e düşmeli (2026 artık yıl değil)."""
    current = datetime(2026, 1, 31)
    result = _next_date_after(current, "monthly")
    assert result == datetime(2026, 2, 28)


def test_monthly_rolls_over_to_next_year():
    """31 Aralık + aylık -> bir sonraki yılın Ocak ayına geçmeli."""
    current = datetime(2026, 12, 31)
    result = _next_date_after(current, "monthly")
    assert result == datetime(2027, 1, 31)


def test_yearly_leap_day_rollover():
    """
    29 Şubat (artık yıl) + yıllık -> 2029 artık yıl değil, bu tarih yok.
    28 Şubat 2029'a düşmeli (crash etmemeli).
    """
    current = datetime(2028, 2, 29)  # 2028 artık yıl
    result = _next_date_after(current, "yearly")
    assert result == datetime(2029, 2, 28)
