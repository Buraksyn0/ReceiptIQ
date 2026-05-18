"""
ReceiptIQ — Kategori Sınıflandırıcı Servisi

Önce anahtar kelime tabanlı kural motoru çalışır (yüksek güven).
Eşleşme bulunamazsa ML pipeline devreye girer (fallback).

Kullanım:
    from app.services.classifier import predict_category
    category_id, confidence = predict_category(ocr_text)
"""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

_MODEL_PATH = Path(__file__).parent.parent / "ml" / "category_clf.pkl"

# ---------------------------------------------------------------------------
# Anahtar kelime kuralları — önce mağaza adı, sonra ürün/içerik aranır.
# Her kategori için eşleşen kelime sayısına göre skor hesaplanır.
# ---------------------------------------------------------------------------
_RULES: dict[str, list[str]] = {
    "food": [
        # Zincir restoranlar
        "burger king", "mcdonald", "kfc", "popeyes", "domino", "pizza hut",
        "little caesar", "sbarro", "subway", "shake shack",
        # Kafe/kahve
        "starbucks", "gloria jean", "cafe nero", "kahve dünyası", "caribou",
        "mandabatmaz", "simit sarayı", "simit sarayi",
        # Türk lokantaları
        "köfteci", "kofteci", "kebap", "kebapçı", "kebapci",
        "döner", "doner", "lahmacun", "pide salonu", "pideci",
        "balık", "balik", "çorba", "corba", "mantı", "manti",
        "börek", "borek", "pastane", "fırın", "firin",
        # Ürünler
        "whopper", "big mac", "tavuk burger", "dürüm", "durum",
        "menü", "menu", "içecek", "icecek", "americano", "latte",
        "kapuçino", "espresso", "türk kahvesi", "çay bardak",
        "servis ücreti", "masa", "paket servis",
    ],
    "market": [
        # Büyük marketler
        "migros", "bim market", "a101", "şok market", "sok market",
        "carrefour", "metro gross", "macro center", "hakmar",
        "onur market", "file market", "özdilek market", "kipa",
        "tansas", "groseri", "uyum market",
        # Ürünler
        "ekmek", "süt", "peynir", "yoğurt", "yogurt", "tereyağ",
        "tavuk but", "kıyma", "yumurta", "makarna", "pirinç",
        "zeytinyağı", "domates", "salatalık", "soğan", "sarımsak",
        "deterjan", "çamaşır suyu", "bulaşık", "tuvalet kağıdı",
        "market alışverişi", "kg fiyat", "adet fiyat",
    ],
    "transport": [
        # Toplu taşıma
        "istanbulkart", "istanbul kart", "ankara kart", "izmir kart",
        "bursakart", "marmaray", "metro iett", "iett",
        # Otobüs/tren
        "metro turizm", "kamil koç", "ulusoy", "pamukkale",
        "flixbus", "tcdd", "yht", "intercity",
        # Havayolu
        "türk hava", "thy", "pegasus", "sunexpress", "anadolujet",
        "corendon",
        # Taksi/araç
        "uber", "bitaksi", "indrive", "in drive", "taxi", "taksi",
        "careem",
        # Ürünler
        "bilet", "uçuş", "seyahat", "transfer",
    ],
    "fuel": [
        "shell", "bp türkiye", "total energie", "opet", "petrol ofisi",
        "po", "aytemiz", "lukoil", "alpet", "emo petrol",
        "motorin", "benzin", "kurşunsuz", "dizel", "lpg",
        "yakıt", "akaryakıt", "pompa",
    ],
    "health": [
        # Eczane
        "eczane", "eczanesi",
        "bağcı eczane", "güven eczane", "sağlık eczane",
        # Hastane/klinik
        "hastane", "klinik", "poliklinik", "muayene",
        "acibadem", "memorial", "medicana", "medipol",
        "doktor", "dr.", "uzm. dr",
        # Ürünler
        "ilaç", "ilac", "hap", "kapsül", "şurup", "merhem",
        "vitamin", "takviye", "maske", "eldiven", "serum",
        "recete", "reçete", "sgk",
    ],
    "personal_care": [
        "gratis", "watsons", "rossmann", "eve beauty",
        "kuaför", "kuafor", "berber", "güzellik salonu", "guzellik",
        "hamam", "spa", "masaj",
        "şampuan", "sampuan", "saç kremi", "deodorant", "parfüm",
        "makyaj", "ruj", "fondöten", "rimel", "oje",
        "tıraş", "tras", "aftershave",
    ],
    "clothing": [
        "zara", "h&m", "hm mağaza", "lc waikiki", "lcw",
        "mavi jeans", "koton", "defacto", "de facto",
        "columbia", "nike turkey", "adidas", "puma",
        "ipekyol", "boyner", "vakko", "pierre cardin",
        "pantolon", "gömlek", "t-shirt", "kazak", "mont",
        "ayakkabı", "bot", "çanta", "cüzdan", "kemer",
        "iç çamaşır", "çorap",
    ],
    "shopping": [
        "teknosa", "mediamarkt", "media markt", "vatan bilgisayar",
        "apple store", "iphone", "samsung", "xiaomi",
        "ikea", "koçtaş", "bauhaus", "decathlon",
        "d&r", "kitabevi", "toy", "oyuncak",
        "laptop", "tablet", "kulaklık", "şarj", "kablo",
        "televizyon", "buzdolabı", "çamaşır makinesi",
        "koltuk", "masa", "sandalye", "yatak",
        "fatura", "garantı", "garanti belgesi",
    ],
    "education": [
        "üniversite", "universite", "okul", "dershane",
        "kurs merkezi", "eğitim merkezi", "egitim merkezi",
        "kitap", "ders kitabı", "sınav", "sinav",
        "udemy", "coursera", "btech", "bilsemat",
        "kalem", "defter", "silgi", "cetvel", "çanta okul",
    ],
    "entertainment": [
        "sinema", "cinema", "cinemaxı", "cinemaximum",
        "biletix", "passo", "konser", "tiyatro", "müze",
        "netflix", "spotify", "youtube premium", "disney",
        "playstation", "xbox", "steam",
        "bowling", "go kart", "paintball", "escape room",
        "eğlence", "eglence merkezi",
    ],
    "subscriptions": [
        "netflix", "spotify", "apple one", "icloud",
        "google one", "youtube premium", "disney plus",
        "amazon prime", "exxen", "gain tv", "blutv",
        "abonelik", "aylık ücret", "subscription",
        "internet paketi", "telefon faturası",
        "turkcell", "vodafone", "türk telekom", "bimcell",
    ],
    "rent": [
        "kira", "aidat", "yönetim", "elektrik faturası",
        "doğalgaz", "dogalgaz", "igdaş", "igdas", "başkent doğalgaz",
        "su faturası", "iski", "aski", "saski",
        "tedaş", "tedas", "elektrik", "fatura ödeme",
        "sigorta", "konut sigortası",
    ],
    "salary": [
        "maaş", "maas", "ücret ödemesi", "havale", "eft",
        "bordro", "prim", "ikramiye", "freelance ödeme",
    ],
    "sports": [
        "decathlon", "intersport", "sport toto",
        "spor salonu", "gym", "fitness", "pilates",
        "yüzme havuzu", "tenis kulübü", "futbol sahası",
        "spor ekipman", "dumbbell", "protein tozu",
    ],
}


def _keyword_classify(text: str) -> Tuple[Optional[str], float]:
    """Anahtar kelime tabanlı sınıflandırma."""
    normalized = text.lower()

    scores: dict[str, int] = {}
    for category, keywords in _RULES.items():
        count = sum(1 for kw in keywords if kw in normalized)
        if count > 0:
            scores[category] = count

    if not scores:
        return None, 0.0

    best = max(scores, key=lambda k: scores[k])
    total = sum(scores.values())
    confidence = min(0.95, 0.5 + (scores[best] / max(total, 1)) * 0.45)
    return best, round(confidence, 3)


@lru_cache(maxsize=1)
def _load_pipeline():
    if not _MODEL_PATH.exists():
        return None
    try:
        import joblib
        return joblib.load(_MODEL_PATH)
    except Exception as exc:
        logger.error("Model yüklenemedi: %s", exc)
        return None


def _ml_classify(text: str) -> Tuple[Optional[str], float]:
    """ML pipeline fallback."""
    pipeline = _load_pipeline()
    if pipeline is None:
        return None, 0.0
    try:
        proba = pipeline.predict_proba([text])[0]
        class_idx = proba.argmax()
        category = pipeline.classes_[class_idx]
        confidence = float(proba[class_idx])
        # ML modeline düşük güven eşiği — gerçek veriyle düzgün eğitilmedi
        if confidence < 0.6:
            return None, 0.0
        return category, confidence
    except Exception as exc:
        logger.error("ML tahmin başarısız: %s", exc)
        return None, 0.0


def predict_category(text: str) -> Tuple[Optional[str], float]:
    """
    1. Önce anahtar kelime motoru — hızlı ve güvenilir.
    2. Eşleşme yoksa ML fallback.
    3. İkisi de boş dönerse (None, 0.0).
    """
    if not text or not text.strip():
        return None, 0.0

    category, confidence = _keyword_classify(text)
    if category:
        logger.debug("Kural motoru: %s (%.2f)", category, confidence)
        return category, confidence

    category, confidence = _ml_classify(text)
    if category:
        logger.debug("ML fallback: %s (%.2f)", category, confidence)
        return category, confidence

    return None, 0.0
