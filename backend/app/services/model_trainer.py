"""
ReceiptIQ — Model Yeniden Eğitim Servisi

Kullanıcı feedback verilerini (kategori düzeltmeleri) sentetik eğitim verisiyle
birleştirerek ML modelini yeniden eğitir.

Akış:
    1. category_feedback tablosundan kullanıcı düzeltmeleri çekilir
    2. Sentetik veriyle birleştirilir (feedback verisi 3x ağırlıklandırılır)
    3. TF-IDF + LogReg pipeline yeniden eğitilir
    4. Yeni model .pkl olarak kaydedilir
    5. Classifier cache temizlenir → sonraki çağrılarda yeni model kullanılır
"""

from __future__ import annotations
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent / "ml" / "category_clf.pkl"

CATEGORIES = [
    "food", "market", "shopping", "transport", "entertainment",
    "rent", "salary", "education", "sports", "clothing",
    "fuel", "health", "personal_care", "subscriptions", "other",
]


async def retrain_with_feedback(db) -> dict:
    """
    Feedback verileriyle modeli yeniden eğitir.

    Returns:
        {"status": "ok", "feedback_count": N, "accuracy": 0.xx}
    """
    try:
        import joblib
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.model_selection import cross_val_score
        from sqlalchemy import select
        from app.models.category_feedback import CategoryFeedback
    except ImportError as e:
        log.error("Eksik paket: %s", e)
        return {"status": "error", "detail": str(e)}

    # 1. Feedback verilerini çek
    result = await db.execute(
        select(CategoryFeedback).where(
            CategoryFeedback.ocr_text.isnot(None)
        )
    )
    feedbacks = result.scalars().all()
    feedback_count = len(feedbacks)
    log.info("Feedback verisi: %d kayıt", feedback_count)

    # 2. Sentetik eğitim verisi üret
    texts, labels = _generate_synthetic_data(samples_per_class=60)

    # 3. Feedback verisini 3x ağırlıkla ekle (kullanıcı düzeltmeleri daha değerli)
    for fb in feedbacks:
        if fb.ocr_text and fb.selected_category in CATEGORIES:
            for _ in range(3):
                texts.append(fb.ocr_text)
                labels.append(fb.selected_category)

    log.info("Toplam eğitim örneği: %d", len(texts))

    # 4. Pipeline eğit
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 2),
            min_df=2,
            max_features=8000,
            sublinear_tf=True,
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            C=5.0,
            solver="lbfgs",
        )),
    ])

    # Çapraz doğrulama (en az 5 sınıf ve 50 örnek varsa)
    accuracy = None
    if len(set(labels)) >= 5 and len(texts) >= 50:
        try:
            from sklearn.model_selection import StratifiedKFold
            cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
            scores = cross_val_score(pipeline, texts, labels, cv=cv, scoring="accuracy")
            accuracy = round(float(scores.mean()), 3)
        except Exception as e:
            log.warning("CV başarısız: %s", e)

    pipeline.fit(texts, labels)

    # 5. Modeli kaydet
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    log.info("Model kaydedildi: %s", MODEL_PATH)

    # 6. Classifier cache'i temizle → yeni model yüklensin
    try:
        from app.services.classifier import _load_pipeline
        _load_pipeline.cache_clear()
        log.info("Classifier cache temizlendi")
    except Exception as e:
        log.warning("Cache temizlenemedi: %s", e)

    return {
        "status": "ok",
        "feedback_count": feedback_count,
        "total_samples": len(texts),
        "accuracy": accuracy,
    }


def _generate_synthetic_data(samples_per_class: int = 60):
    """Sentetik fiş verisi üretir (train_classifier.py ile aynı mantık)."""
    import random
    random.seed(42)

    TEMPLATES = {
        "food": {
            "stores": ["BURGER KING", "MCDONALD'S", "STARBUCKS", "SIMIT SARAYI", "KFC", "CAFE NERO", "DÖNERCI"],
            "items": ["WHOPPER MENU", "LATTE", "ÇORBA", "DÖNER DÜRÜM", "SIMIT", "ÇAY", "SANDVIÇ"],
        },
        "market": {
            "stores": ["MİGROS", "BİM", "A101", "ŞOK MARKET", "CARREFOURSA", "FILE MARKET"],
            "items": ["EKMEK", "SÜT", "YOĞURT", "TAVUK", "YUMURTA", "MAKARNA", "DETERJAN"],
        },
        "shopping": {
            "stores": ["ZARA", "H&M", "LC WAIKIKI", "TEKNOSA", "MEDIAMARKT", "IKEA"],
            "items": ["LAPTOP", "TELEFON", "KOLTUK", "NEVRESIM", "TABLET", "KULALIK"],
        },
        "transport": {
            "stores": ["İSTANBUL KART", "UBER", "PEGASUS", "THY", "METRO İSTANBUL", "BİTAKSİ"],
            "items": ["OTOBÜs BİLETİ", "UÇAK BİLETİ", "TAKSİ ÜCRETİ", "METRO BİLETİ"],
        },
        "entertainment": {
            "stores": ["CİNEMAXİMUM", "NETFLIX", "SPOTIFY", "PLAYSTATION", "STEAM"],
            "items": ["SİNEMA BİLETİ", "ABONELİK", "OYUN SATINALMA", "KONSER BİLETİ"],
        },
        "rent": {
            "stores": ["AYEDAŞ", "BEDAŞ", "İGDAŞ", "TÜRK TELEKOM", "TURKCELL"],
            "items": ["ELEKTRİK FATURASI", "DOĞALGAZ FATURASI", "KİRA", "İNTERNET FATURASI"],
        },
        "salary": {
            "stores": ["BORDRO", "MAAŞ PUSULASI", "GELİR MAKBUZU"],
            "items": ["MAAŞ", "NET MAAŞ", "PRİM", "İKRAMİYE", "AVANS"],
        },
        "education": {
            "stores": ["D&R", "UDEMY", "DERSHANE", "ÖZEL DERS"],
            "items": ["KİTAP", "ONLİNE KURS", "ÖZEL DERS", "DENEME SINAVI"],
        },
        "sports": {
            "stores": ["DECATHLON", "SPOR SALONU", "GYM", "MACFIT", "SMARTFIT"],
            "items": ["AYLIK ÜYELİK", "PROTEİN TOZU", "FORMA", "SPOR AYAKKABISI"],
        },
        "clothing": {
            "stores": ["ZARA", "H&M", "KOTON", "DeFacto", "MANGO", "BERSHKA"],
            "items": ["TIŞÖRT", "PANTOLON", "ELBISE", "CEKET", "AYAKKABISI"],
        },
        "fuel": {
            "stores": ["SHELL", "BP", "TOTAL", "OPET", "PETROL OFİSİ"],
            "items": ["KURŞUNSUZ 95", "DİZEL", "LPG", "MOTORIN", "YIKAMA"],
        },
        "health": {
            "stores": ["ECZANE", "DEVLET HASTANESİ", "POLİKLİNİK", "DİŞ KLİNİĞİ"],
            "items": ["İLAÇ", "MUAYENE", "KAN TAHLİLİ", "VİTAMİN", "DİŞ TEDAVİSİ"],
        },
        "personal_care": {
            "stores": ["GRATİS", "WATSONS", "SEPHORA", "ROSSMANN"],
            "items": ["ŞAMPUAN", "PARFÜM", "YÜZ KREMI", "DEODORANT", "MAKYAJ"],
        },
        "subscriptions": {
            "stores": ["NETFLIX", "SPOTIFY", "YOUTUBE PREMIUM", "DISNEY PLUS", "CHATGPT"],
            "items": ["AYLIK PLAN", "YILLIK PLAN", "PREMİUM ÜYELİK", "OTOMATİK YENİLEME"],
        },
        "other": {
            "stores": ["PTT", "KARGO", "YURTİÇİ KARGO", "NOTER", "BELEDİYE"],
            "items": ["KARGO ÜCRETİ", "NOTER HAR", "VERGİ ÖDEMESİ", "BAĞIŞ"],
        },
    }

    texts, labels = [], []
    for cat, tmpl in TEMPLATES.items():
        for _ in range(samples_per_class):
            store = random.choice(tmpl["stores"])
            items = random.sample(tmpl["items"], k=min(3, len(tmpl["items"])))
            total = round(random.uniform(10, 500), 2)
            text = f"{store}\n" + "\n".join(f"{item}  *{round(random.uniform(5,200),2):.2f}" for item in items)
            text += f"\nTOPLAM  *{total:.2f}"
            texts.append(text)
            labels.append(cat)

    return texts, labels
