"""
parse_receipt (Türkçe fiş parser) için unit testler — DB/HTTP yok, saf fonksiyon.
"""
from app.services.parser import parse_receipt


def test_total_amount_prefers_toplam_over_nakit_change():
    """
    Regresyon testi: gerçek bir Android emulator testinde bulunan hata.

    Google Vision OCR, sağa hizalı etiket/tutar sütunlarını bazen ayrı
    bloklar halinde döndürüyor (önce tüm etiketler, sonra tüm tutarlar).
    Bu durumda TOPLAM anahtar kelimesinden sonraki pencere NAKİT (ödenen
    tutar) ve PARA ÜSTÜ satırlarını da kapsıyordu; NAKİT neredeyse her
    zaman TOPLAM'dan büyük olduğu için (para üstü verilir), take_max=True
    yanlışlıkla NAKİT'i toplam sanıyordu (343,42 yerine 350,00).
    """
    raw_text = (
        "MİGROS\n"
        "Bağdat Caddesi No:45\n"
        "Kadıköy / İstanbul\n"
        "FİŞ NO: 0047231\n"
        "19.09.2026\n"
        "18:15\n"
        "EKMEK\n"
        "SÜT 1LT\n"
        "12,50\n"
        "34,90\n"
        "YUMURTA 15'Lİ\n"
        "89,90\n"
        "DOMATES 1KG\n"
        "45,00\n"
        "PEYNİR 500GR\n"
        "129,90\n"
        "ARA TOPLAM\n"
        "KDV %10\n"
        "TOPLAM\n"
        "312,20\n"
        "31,22\n"
        "343,42\n"
        "NAKİT\n"
        "350,00\n"
        "PARA ÜSTÜ\n"
        "6,58\n"
        "TEŞEKKÜR EDERİZ"
    )

    result = parse_receipt(raw_text)

    assert result.merchant_name == "MİGROS"
    assert str(result.total_amount) == "343.42"


def test_inline_total_amount_on_same_line():
    """Basit durum: tutar, TOPLAM kelimesiyle aynı satırda."""
    raw_text = "STARBUCKS\nKAHVE\nTOPLAM  125,50\n"
    result = parse_receipt(raw_text)
    assert str(result.total_amount) == "125.50"


def test_receipt_date_extracted_from_dd_mm_yyyy():
    raw_text = "MARKET\n19.09.2026\nTOPLAM 50,00\n"
    result = parse_receipt(raw_text)
    assert result.receipt_date is not None
    assert result.receipt_date.day == 19
    assert result.receipt_date.month == 9
    assert result.receipt_date.year == 2026


def test_empty_text_returns_empty_receipt():
    result = parse_receipt("")
    assert result.merchant_name is None
    assert result.total_amount is None
    assert result.raw_text == ""
