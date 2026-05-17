"""
OCR Provider tabanı.

Bu modül, OCR motoruna bağımsız bir arayüz tanımlar. Yerel (Tesseract) ve
bulut (Google Vision) implementasyonları aynı sözleşmeye uyar; böylece
.env'de OCR_PROVIDER değeri değişince koddan başka hiçbir şey değişmez.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class OCRResult:
    """OCR motorunun döndürdüğü sonuç."""

    text: str
    """Çıkarılan ham metin."""

    confidence: float | None = None
    """0.0-1.0 arası ortalama güven skoru. Sağlanmazsa None."""

    raw: dict | None = None
    """Provider'a özel ek veri (debug için saklanır)."""


class OCRProvider(ABC):
    """OCR motoru için soyut arayüz."""

    name: str = "abstract"

    @abstractmethod
    def extract_text(self, image_path: str) -> OCRResult:
        """
        Bir görsel dosyasından metin çıkarır.

        Args:
            image_path: Yerel disk üzerinde okunabilir bir görsel yolu (jpg/png).

        Returns:
            OCRResult: ham metin + opsiyonel güven skoru.

        Raises:
            OCRError: Sağlayıcıya bağlı hata durumunda.
        """
        raise NotImplementedError


class OCRError(Exception):
    """OCR sağlayıcısından gelen hatalar."""
