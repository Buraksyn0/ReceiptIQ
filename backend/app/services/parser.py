"""
Türkçe Fiş / Fatura Parser

OCR'dan gelen ham metni regex ile temizleyip yapısal veriye çevirir:
- merchant_name: ilk anlamlı satır (genelde mağaza/firma adı)
- total_amount: TOPLAM / GENEL TOPLAM / TOPLAM TUTAR satırlarındaki tutar
- receipt_date: TR tarih formatları (dd.MM.yyyy, dd/MM/yyyy, dd-MM-yyyy)
- vat_amount: KDV satırları (opsiyonel)
- items: Algılanabilen ürün satırları (best-effort)

Bu parser deterministik regex tabanlıdır; ileride ML ile (NER) geliştirebiliriz.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional


@dataclass
class ParsedReceipt:
    merchant_name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    receipt_date: Optional[datetime] = None
    vat_amount: Optional[Decimal] = None
    currency: str = "TRY"
    items: list[dict] = field(default_factory=list)
    raw_text: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        # Decimal/datetime'i JSON'a uygun stringe çevir
        if self.total_amount is not None:
            d["total_amount"] = str(self.total_amount)
        if self.vat_amount is not None:
            d["vat_amount"] = str(self.vat_amount)
        if self.receipt_date is not None:
            d["receipt_date"] = self.receipt_date.isoformat()
        return d


# === Regex sözlüğü ===

# Tarih formatları:
#   25.04.2026, 25/04/2026, 25-04-2026, 25.04.26
_DATE_RE = re.compile(
    r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b"
)

# Tutar:
#   1.234,56  veya  1234.56  veya  156,75 TL  veya  ₺156,75
# Önce sembol/anahtar kelime ile, sonra düz sayı arıyoruz
_AMOUNT_RE = re.compile(
    r"(?:₺|TL|TRY)?\s*"
    r"(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})"
    r"\s*(?:₺|TL|TRY)?",
    re.IGNORECASE,
)

# Tutar SATIRI: sadece tutar içeren satır — *, +, =, -, ₺ öneki olabilir.
# .76.00 gibi OCR artifact'larını eler (başındaki . ile başlayan satırlar eşleşmez).
_AMOUNT_LINE_RE = re.compile(
    r"^[*+=\-₺\s]*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s*(?:₺|TL|TRY)?$",
    re.IGNORECASE,
)

# "TOPLAM" anahtar kelime varyantları (yüksek öncelik)
# OCR sık sık M→N hatası yapar: "TOPLAM" → "TOPLAN"
_TOTAL_KEYWORDS = (
    "GENEL TOPLAM",
    "GENEL TOPLAN",   # OCR M→N hatası
    "TOPLAM TUTAR",
    "TOPLAN TUTAR",   # OCR M→N hatası
    "TUTAR",
    "TOPLAM",
    "TOPLAN",         # OCR M→N hatası
)

# KDV
_VAT_KEYWORDS = (
    "TOPLAM KDV",
    "KDV TOPLAMI",
    "TOPKDV",
    "KDV",
    "VAT",
)

# Satıcı adayları için göz ardı edilecek başlangıçlar
_MERCHANT_BLACKLIST = (
    "FIŞ",
    "FATURA",
    "TARIH",
    "TARİH",
    "SAAT",
    "NO:",
    "VKN",
    "TCKN",
    "ADRES",
    "TEL:",
    "EKRAN",
    "HESAP",
    "KASA",
    "SATIŞ",
)

# Türk şirket suffix'leri — bu kalıplardan biri geçen satır büyük ihtimalle firma adı
_COMPANY_SUFFIX_RE = re.compile(
    r"\b(A\.?Ş\.?|A\.?S\.?|LTD\.?|LİMİTED|TAAH\.?|TAAHHÜT|"
    r"SAN\.?|TİC\.?|PAZ\.?|İNŞ\.?|İNS\.?|NAK\.?|ORG\.?|"
    r"GIDA|MARKET|MAĞAZA|RESTORAN|CAFE|KAFE|PETROL|OTO|TEKSTİL)\b",
    re.IGNORECASE | re.UNICODE,
)


def _to_decimal(amount_str: str) -> Optional[Decimal]:
    """'1.234,56' veya '1,234.56' formatlarını Decimal'a çevirir."""
    if not amount_str:
        return None
    s = amount_str.strip().replace(" ", "")

    # Türkçe format: binlik '.', ondalık ','
    # İngilizce format: binlik ',', ondalık '.'
    if "," in s and "." in s:
        # Hangi karakter sona daha yakınsa o ondalık ayırıcı
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        # Sadece virgül varsa ondalık say
        s = s.replace(",", ".")
    # else: nokta zaten ondalık ya da bütünleyici

    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _parse_date(text: str) -> Optional[datetime]:
    """Metin içinden ilk geçerli TR tarihini bulur."""
    from datetime import datetime as dt
    current_year = dt.now().year
    for match in _DATE_RE.finditer(text):
        day, month, year = match.groups()
        if len(year) == 2:
            year = "20" + year  # 26 → 2026
        year_int = int(year)
        # OCR hatası: 7024 → 2024 gibi yanlış ilk rakam düzeltme
        if year_int > current_year + 5:
            year_int = int("2" + str(year_int)[1:])
        try:
            return datetime(year_int, int(month), int(day))
        except (ValueError, TypeError):
            continue
    return None


def _find_amount_after_keyword(
    text: str, keywords: tuple[str, ...], take_max: bool = False
) -> Optional[Decimal]:
    """
    Bir anahtar kelimeden sonra gelen tutarı yakalar.

    İki mod:
    1. Inline: keyword ile tutar aynı satırda → "GENEL TOPLAM  90,20"
    2. Nextline: keyword sonrası satırlarda tutar → keyword satırı, altındaki satır

    take_max=True  → penceredeki en büyük tutarı döner (TOPLAM için).
    take_max=False → penceredeki ilk tutarı döner (KDV için).
    """
    candidates: list[Decimal] = []
    upper = text.upper()

    for kw in keywords:
        for kw_match in re.finditer(re.escape(kw), upper):
            # --- Mod 1: aynı satırda inline tutar ---
            # Keyword'ün bulunduğu satırın geri kalanına bak
            inline_rest = text[kw_match.end() : kw_match.end() + 80]
            inline_line = inline_rest.split("\n")[0].strip()
            # Sadece tutar/boşluk/sembol içeriyorsa al
            inline_m = _AMOUNT_LINE_RE.match(inline_line)
            if inline_m:
                dec = _to_decimal(inline_m.group(1))
                if dec is not None and dec > 0:
                    candidates.append(dec)
                    if not take_max:
                        break
                    continue  # take_max: diğer eşleşmelere devam et

            # --- Mod 2: sonraki satırlarda tutar ---
            window = text[kw_match.end() : kw_match.end() + 120]
            for line in window.splitlines():
                m = _AMOUNT_LINE_RE.match(line.strip())
                if m:
                    dec = _to_decimal(m.group(1))
                    if dec is not None and dec > 0:
                        candidates.append(dec)
                        if not take_max:
                            break  # take_max=False: ilk tutarı bul, dur

        if candidates:
            break  # En öncelikli keyword bulunca daha düşük öncelikte arama yapma

    if not candidates:
        return None

    return max(candidates) if take_max else candidates[0]


def _find_merchant_name(lines: list[str]) -> Optional[str]:
    """
    Satıcı adı tahmini: ilk birkaç satırdaki en muhtemel adayı seç.

    1. Öncelik: Türk şirket suffix'i (A.Ş., TAAH., LTD. vb.) içeren satır
       — Google Vision çıktısında firma adı genelde 2-4. satırlarda gelir.
    2. Fallback: En az 6 karakter, sayısal değil, blacklist'e girmemiş,
       çoğunluğu harf olan ilk satır.
    """
    # 1. Şirket suffix'i olan satırı öncelikli al (ilk 10 satırda ara)
    for line in lines[:10]:
        stripped = line.strip()
        if _COMPANY_SUFFIX_RE.search(stripped):
            return stripped

    # 2. Fallback — minimum uzunluğu 6'ya çıkardık (kısa OCR gürültüsü elensin)
    for line in lines[:8]:
        stripped = line.strip()
        if len(stripped) < 6:
            continue
        if any(stripped.upper().startswith(b) for b in _MERCHANT_BLACKLIST):
            continue
        # Çoğunluk harf olmalı
        letters = sum(1 for c in stripped if c.isalpha())
        if letters / max(len(stripped), 1) < 0.5:
            continue
        return stripped
    return None


def _fallback_total(lines: list[str]) -> Optional[Decimal]:
    """
    Keyword tabanlı arama başarısız olursa devreye girer.

    Fişin alt yarısındaki tüm standalone tutar satırlarını toplar ve
    en büyük değeri toplam olarak döner.  Bu yaklaşım şunları yakalar:
    - "*170,00" gibi yıldız önekli toplam satırları
    - TOPLAM kelimesinin OCR tarafından tamamen bozulduğu durumlar
    """
    bottom = lines[max(0, len(lines) // 2):]
    candidates: list[Decimal] = []
    for line in bottom:
        m = _AMOUNT_LINE_RE.match(line)
        if m:
            dec = _to_decimal(m.group(1))
            if dec is not None and dec > 0:
                candidates.append(dec)
    return max(candidates) if candidates else None


def parse_receipt(raw_text: str) -> ParsedReceipt:
    """
    Ana parse fonksiyonu. Tüm regex işlemlerini bir araya getirir.
    """
    if not raw_text:
        return ParsedReceipt(raw_text="")

    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]

    merchant = _find_merchant_name(lines)
    total = _find_amount_after_keyword(raw_text, _TOTAL_KEYWORDS, take_max=True)

    # Keyword bulunamadıysa alt yarıdaki en büyük tutarı toplam say
    if total is None:
        total = _fallback_total(lines)

    vat = _find_amount_after_keyword(raw_text, _VAT_KEYWORDS, take_max=False)
    rdate = _parse_date(raw_text)

    return ParsedReceipt(
        merchant_name=merchant,
        total_amount=total,
        receipt_date=rdate,
        vat_amount=vat,
        currency="TRY",
        items=[],  # Faz 2'de zenginleştireceğiz
        raw_text=raw_text,
    )
