"""
Google Vision OCR sağlayıcısı için mocking testi — gerçek Google Cloud
sunucusuna hiç gidilmiyor, para harcanmıyor.
"""
import tempfile
from unittest.mock import MagicMock, patch

from app.services.ocr.google_vision_provider import GoogleVisionProvider


def test_extract_text_returns_ocr_result_from_mocked_google_client():
    """
    Sahte bir Google Vision cevabı kurup, extract_text'in bu cevabı doğru
    OCRResult'a (text + confidence) çevirdiğini doğruluyoruz.
    """
    # Kod open(image_path, "rb") çağırıyor — gerçek (geçici) bir dosya lazım
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp_file:
        tmp_file.write(b"sahte gorsel icerigi")
        tmp_file.flush()

        # Sahte sayfa (confidence içeren)
        fake_page = MagicMock()
        fake_page.confidence = 0.95

        # Sahte "full_text_annotation" (Google Vision'ın gerçek cevap yapısı)
        fake_annotation = MagicMock()
        fake_annotation.text = "MIGROS\nTOPLAM: 150.00 TL"
        fake_annotation.pages = [fake_page]

        fake_response = MagicMock()
        fake_response.error.message = ""  # hata yok
        fake_response.full_text_annotation = fake_annotation

        fake_client = MagicMock()
        fake_client.document_text_detection.return_value = fake_response

        # _build_client() gerçek Google kimlik doğrulaması yapmaya çalışır —
        # onu tamamen atlayıp sahte client'ımızı döndürmesini sağlıyoruz
        with patch(
            "app.services.ocr.google_vision_provider._build_client",
            return_value=fake_client,
        ):
            provider = GoogleVisionProvider()
            result = provider.extract_text(tmp_file.name)

        assert result.text == "MIGROS\nTOPLAM: 150.00 TL"
        assert result.confidence == 0.95
