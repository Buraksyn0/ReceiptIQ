"""
Tesseract OCR sağlayıcısı.

Bağımlılıklar:
- Sistem: `brew install tesseract tesseract-lang` (macOS)
              veya `apt install tesseract-ocr tesseract-ocr-tur` (Linux)
- Python: pytesseract, Pillow

Doğruluk Tesseract'ın olağan limitlerinde — basit, düz, iyi aydınlatılmış
fişlerde iyi; eğri / buruşuk / düşük çözünürlüklü olanlarda zorlanır.
Bu yüzden upload'tan önce hafif önişleme yapıyoruz (gri tonlama).
"""

from __future__ import annotations
from PIL import Image, ImageOps

from app.core.config import settings
from app.services.ocr.base import OCRProvider, OCRResult, OCRError


class TesseractProvider(OCRProvider):
    name = "tesseract"

    def extract_text(self, image_path: str) -> OCRResult:
        try:
            import pytesseract
        except ImportError as e:
            raise OCRError(
                "pytesseract yüklü değil. requirements.txt güncel mi?"
            ) from e

        try:
            with Image.open(image_path) as img:
                # Önişleme: EXIF orientation düzelt + gri tonlama
                img = ImageOps.exif_transpose(img)
                img = img.convert("L")

                text = pytesseract.image_to_string(
                    img, lang=settings.TESSERACT_LANG
                )

                # Tesseract güven skorunu doğrudan vermez; kaba bir tahmin yapıyoruz
                data = pytesseract.image_to_data(
                    img,
                    lang=settings.TESSERACT_LANG,
                    output_type=pytesseract.Output.DICT,
                )
                confidences = [
                    int(c) for c in data.get("conf", []) if c not in ("-1", -1, "")
                ]
                avg_conf = (
                    sum(confidences) / len(confidences) / 100.0
                    if confidences
                    else None
                )

                return OCRResult(
                    text=text or "",
                    confidence=avg_conf,
                    raw={"engine": "tesseract", "lang": settings.TESSERACT_LANG},
                )
        except FileNotFoundError as e:
            raise OCRError(f"Görsel bulunamadı: {image_path}") from e
        except pytesseract.TesseractNotFoundError as e:  # type: ignore
            raise OCRError(
                "Tesseract sistemde kurulu değil. macOS: "
                "`brew install tesseract tesseract-lang`"
            ) from e
        except Exception as e:
            raise OCRError(f"Tesseract hatası: {e}") from e
