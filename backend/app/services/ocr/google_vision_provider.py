"""
Google Cloud Vision OCR sağlayıcısı.

Kurulum:
1. https://console.cloud.google.com'da proje aç
2. "Cloud Vision API"yi etkinleştir
3. IAM > Service Account oluştur, JSON key indir
4. Railway'de GOOGLE_APPLICATION_CREDENTIALS_JSON env var'ına JSON içeriğini yapıştır
5. Railway'de OCR_PROVIDER=google_vision yap

Free tier: ayda ilk 1000 istek bedava, sonrası ~$1.50 / 1000.

Doğruluk: yatık fiş, buruşuk kağıt, dim ışık dahil çok iyi (>%95 tipik).
"""

from __future__ import annotations
import json
import os

from app.core.config import settings
from app.services.ocr.base import OCRProvider, OCRResult, OCRError


def _build_client():
    """
    Google Vision client oluştur.

    Öncelik sırası:
    1. GOOGLE_APPLICATION_CREDENTIALS_JSON env var (Railway için — JSON string)
    2. GOOGLE_APPLICATION_CREDENTIALS env var (dosya yolu — local için)
    3. Application Default Credentials (gcloud auth)
    """
    try:
        from google.cloud import vision
        from google.oauth2 import service_account
    except ImportError as e:
        raise OCRError(
            "google-cloud-vision yüklü değil. pip install google-cloud-vision"
        ) from e

    json_str = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON") or ""
    if json_str.strip():
        try:
            info = json.loads(json_str)
            creds = service_account.Credentials.from_service_account_info(
                info,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            return vision.ImageAnnotatorClient(credentials=creds)
        except Exception as e:
            raise OCRError(f"GOOGLE_APPLICATION_CREDENTIALS_JSON parse hatası: {e}") from e

    # Dosya yolu veya ADC
    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        os.environ.setdefault(
            "GOOGLE_APPLICATION_CREDENTIALS", settings.GOOGLE_APPLICATION_CREDENTIALS
        )
    return vision.ImageAnnotatorClient()


class GoogleVisionProvider(OCRProvider):
    name = "google_vision"

    def extract_text(self, image_path: str) -> OCRResult:
        try:
            from google.cloud import vision
        except ImportError as e:
            raise OCRError(
                "google-cloud-vision yüklü değil. pip install google-cloud-vision"
            ) from e

        try:
            client = _build_client()

            with open(image_path, "rb") as f:
                content = f.read()

            image = vision.Image(content=content)
            # document_text_detection: yoğun metin (fişler için ideal)
            response = client.document_text_detection(
                image=image, image_context={"language_hints": ["tr", "en"]}
            )

            if response.error.message:
                raise OCRError(
                    f"Google Vision API hatası: {response.error.message}"
                )

            full_text = response.full_text_annotation.text or ""

            # Sayfa bazlı confidence ortalaması
            confidences = []
            for page in response.full_text_annotation.pages:
                if page.confidence:
                    confidences.append(page.confidence)
            avg_conf = (
                sum(confidences) / len(confidences) if confidences else None
            )

            return OCRResult(
                text=full_text,
                confidence=avg_conf,
                raw={"engine": "google_vision"},
            )
        except FileNotFoundError as e:
            raise OCRError(f"Görsel bulunamadı: {image_path}") from e
        except OCRError:
            raise
        except Exception as e:
            raise OCRError(f"Google Vision hatası: {e}") from e
