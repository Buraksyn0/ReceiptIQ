"""
Tesseract OCR sağlayıcısı.

Bağımlılıklar:
- Sistem: `brew install tesseract tesseract-lang` (macOS)
              veya `apt install tesseract-ocr tesseract-ocr-tur` (Linux)
- Python: pytesseract, Pillow

Doğruluk Tesseract'ın olağan limitlerinde — basit, düz, iyi aydınlatılmış
fişlerde iyi; eğri / buruşuk / düşük çözünürlüklü olanlarda zorlanır.
Termal fiş baskılarında kontrast artırma + binarizasyon uygulanır.
"""

from __future__ import annotations
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

from app.core.config import settings
from app.services.ocr.base import OCRProvider, OCRResult, OCRError


def _preprocess(img: Image.Image) -> Image.Image:
    """
    Termal fiş görseli için önişleme zinciri:
    1. EXIF orientation düzelt
    2. Gri tonlamaya çevir
    3. Hafif unsharp mask (netlik)
    4. Kontrast artır (×2)
    5. Otsu benzeri eşikleme (binarizasyon) — siyah/beyaz metin

    Bu adımlar Tesseract'ın soluk/eğik/düşük çözünürlüklü fişlerde
    çok daha fazla karakter yakalamasını sağlar.
    """
    img = ImageOps.exif_transpose(img)
    img = img.convert("L")

    # Hafif sharpening — bulanık kameraları düzeltir
    img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3))

    # Kontrast 2× artır
    img = ImageEnhance.Contrast(img).enhance(2.0)

    # Binarizasyon: piksel < 140 → siyah (0), >= 140 → beyaz (255)
    img = img.point(lambda p: 0 if p < 140 else 255)

    return img


class TesseractProvider(OCRProvider):
    name = "tesseract"

    def extract_text(self, image_path: str) -> OCRResult:
        try:
            import pytesseract
            import shutil
            # Railway/Linux'ta tesseract path'ini açıkça belirt
            tess_path = shutil.which("tesseract")
            if tess_path:
                pytesseract.pytesseract.tesseract_cmd = tess_path
        except ImportError as e:
            raise OCRError(
                "pytesseract yüklü değil. requirements.txt güncel mi?"
            ) from e

        try:
            with Image.open(image_path) as img:
                img = _preprocess(img)

                # --psm 6: Tek tip metin bloğu varsay (fiş için ideal)
                # --oem 1: Sadece LSTM motoru (daha doğru)
                custom_config = "--psm 6 --oem 1"

                text = pytesseract.image_to_string(
                    img, lang=settings.TESSERACT_LANG, config=custom_config
                )

                # Tesseract güven skorunu doğrudan vermez; kaba bir tahmin yapıyoruz
                data = pytesseract.image_to_data(
                    img,
                    lang=settings.TESSERACT_LANG,
                    config=custom_config,
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
