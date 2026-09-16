"""
detect_anomaly (IQR yöntemi) için unit testler — DB/HTTP yok, saf fonksiyon.
"""
from app.services.anomaly_detector import detect_anomaly


def test_insufficient_samples_never_flags_anomaly():
    """5'ten az geçmiş veri varsa, tutar ne kadar aşırı olursa olsun anomali sayılmamalı."""
    is_anomaly, score = detect_anomaly(10000, [10, 20])
    assert is_anomaly is False
    assert score == 0.0


def test_value_within_normal_range_is_not_anomaly():
    """
    Geçmiş: [95, 100, 102, 105, 110] -> Q1=100, Q3=105, IQR=5
    Normal aralık: [92.5, 112.5]. 103 bu aralıkta -> anomali değil.
    """
    historical = [95, 100, 102, 105, 110]
    is_anomaly, score = detect_anomaly(103, historical)
    assert is_anomaly is False
    assert score == 0.143  # max(0, (103 - 102.5) / 3.5), elle hesaplandı


def test_extreme_value_is_flagged_as_anomaly():
    """Aynı geçmiş veriyle, üst sınırın (112.5) çok üzerinde bir tutar anomali olmalı."""
    historical = [95, 100, 102, 105, 110]
    is_anomaly, score = detect_anomaly(300, historical)
    assert is_anomaly is True
    assert score == 37.5  # (300 - 112.5) / 5, elle hesaplandı
