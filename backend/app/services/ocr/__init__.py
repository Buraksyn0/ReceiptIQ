"""
OCR provider factory.

Kullanım:
    from app.services.ocr import get_ocr_provider
    provider = get_ocr_provider()
    result = provider.extract_text("/path/to/image.jpg")
"""

from __future__ import annotations
from functools import lru_cache

from app.core.config import settings
from app.services.ocr.base import OCRProvider, OCRResult, OCRError


@lru_cache(maxsize=1)
def get_ocr_provider() -> OCRProvider:
    """Config'e göre tek bir OCR provider örneği üretir ve cache'ler."""
    name = settings.OCR_PROVIDER

    if name == "google_vision":
        from app.services.ocr.google_vision_provider import GoogleVisionProvider
        return GoogleVisionProvider()

    if name == "tesseract":
        from app.services.ocr.tesseract_provider import TesseractProvider
        return TesseractProvider()

    raise ValueError(
        f"Bilinmeyen OCR_PROVIDER: {name!r}. "
        "Geçerli değerler: 'tesseract', 'google_vision'."
    )


__all__ = ["get_ocr_provider", "OCRProvider", "OCRResult", "OCRError"]
