"""
ReceiptIQ — Kategori Sınıflandırıcı Servisi

OCR'dan gelen ham metni alır, eğitilmiş TF-IDF + LogReg pipeline ile
15 kategori arasından en olası olanı döner.

Kullanım:
    from app.services.classifier import predict_category
    category_id, confidence = predict_category(ocr_text)
    # category_id → "food" | "market" | "transport" | ... | "other"
    # confidence  → 0.0 - 1.0

Model:
    app/ml/category_clf.pkl — train_classifier.py ile üretilir
    Model yoksa (None, 0.0) döner, sistem graceful degradation ile devam eder.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Model dosyasının beklenen konumu
_MODEL_PATH = Path(__file__).parent.parent / "ml" / "category_clf.pkl"


@lru_cache(maxsize=1)
def _load_pipeline():
    """
    Pipeline'ı bir kez yükler, sonraki çağrılarda cache'den döner.
    Model yoksa None döner — uygulama yine de çalışır.
    """
    if not _MODEL_PATH.exists():
        logger.warning(
            "Kategori modeli bulunamadı: %s — suggested_category boş kalacak. "
            "Modeli eğitmek için: python scripts/train_classifier.py",
            _MODEL_PATH,
        )
        return None

    try:
        import joblib
        pipeline = joblib.load(_MODEL_PATH)
        logger.info("Kategori modeli yüklendi: %s", _MODEL_PATH)
        return pipeline
    except Exception as exc:
        logger.error("Model yüklenemedi: %s", exc)
        return None


def predict_category(text: str) -> Tuple[Optional[str], float]:
    """
    Ham OCR metninden kategori tahmini yapar.

    Returns:
        (category_id, confidence)
        category_id: "food", "market", "transport" vb. | None (model yoksa)
        confidence:  0.0 - 1.0 (modelin tahmin güveni)
    """
    if not text or not text.strip():
        return None, 0.0

    pipeline = _load_pipeline()
    if pipeline is None:
        return None, 0.0

    try:
        proba = pipeline.predict_proba([text])[0]
        class_idx = proba.argmax()
        category = pipeline.classes_[class_idx]
        confidence = float(proba[class_idx])
        return category, confidence
    except Exception as exc:
        logger.error("Kategori tahmini başarısız: %s", exc)
        return None, 0.0
