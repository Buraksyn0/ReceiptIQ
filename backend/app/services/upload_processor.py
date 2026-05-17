"""
Upload işleme worker'ı.

Bu fonksiyon FastAPI BackgroundTasks tarafından arka planda çalıştırılır.
Tasarım kararı: dispatch'tan bağımsız bir Python fonksiyonu olarak tutuyoruz
ki gelecekte Celery / arq'ye geçince çağrı kodu dışında hiçbir şey değişmesin.

Akış:
  1. UploadedFile.status = 'processing'
  2. OCR çalıştır (provider .env'den seçilir)
  3. TR parser ile yapısal veri üret
  4. UploadedFile.status = 'done', text_content + parsed_data dolur
  4'. Hata olursa status = 'failed', error_message dolar
"""

from __future__ import annotations
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.uploaded_file import UploadedFile
from app.services.ocr import get_ocr_provider, OCRError
from app.services.parser import parse_receipt
from app.services.classifier import predict_category

log = logging.getLogger("upload_processor")


async def _set_status(
    db: AsyncSession,
    upload: UploadedFile,
    status: str,
    *,
    error: str | None = None,
    text_content: str | None = None,
    ocr_provider: str | None = None,
    ocr_confidence: float | None = None,
    parsed_data: dict | None = None,
) -> None:
    upload.status = status
    if error is not None:
        upload.error_message = error
    if text_content is not None:
        upload.text_content = text_content
    if ocr_provider is not None:
        upload.ocr_provider = ocr_provider
    if ocr_confidence is not None:
        upload.ocr_confidence = ocr_confidence
    if parsed_data is not None:
        upload.parsed_data = parsed_data
    db.add(upload)
    await db.commit()


async def process_upload(upload_id: uuid.UUID) -> None:
    """
    Tek bir upload kaydını OCR + parse boru hattından geçirir.
    Bağımsız bir DB session açar (BackgroundTasks ana request session'ı kapanır).
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UploadedFile).where(UploadedFile.id == upload_id)
        )
        upload = result.scalars().first()
        if upload is None:
            log.warning("process_upload: upload bulunamadı id=%s", upload_id)
            return

        await _set_status(db, upload, "processing")

        try:
            provider = get_ocr_provider()
            ocr = provider.extract_text(upload.storage_path)
            parsed = parse_receipt(ocr.text)

            # ML kategori tahmini
            suggested_category, category_confidence = predict_category(ocr.text)
            parsed_dict = parsed.to_dict()
            if suggested_category:
                parsed_dict["suggested_category"] = suggested_category
                parsed_dict["category_confidence"] = round(category_confidence, 3)

            await _set_status(
                db,
                upload,
                "done",
                text_content=ocr.text,
                ocr_provider=provider.name,
                ocr_confidence=ocr.confidence,
                parsed_data=parsed_dict,
            )
            log.info(
                "process_upload OK id=%s provider=%s confidence=%s",
                upload_id,
                provider.name,
                ocr.confidence,
            )
        except OCRError as e:
            log.exception("OCR hatası id=%s", upload_id)
            await _set_status(db, upload, "failed", error=f"OCR: {e}")
        except Exception as e:
            log.exception("Beklenmeyen hata id=%s", upload_id)
            await _set_status(db, upload, "failed", error=str(e))
