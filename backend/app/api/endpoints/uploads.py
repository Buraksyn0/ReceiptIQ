"""
/api/v1/receipts/upload — fiş yükleme + asenkron OCR boru hattı.
"""

from __future__ import annotations
import uuid
from typing import List

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.user import User
from app.models.uploaded_file import UploadedFile
from app.models.receipt import Receipt
from app.models.category_feedback import CategoryFeedback
from app.schemas.upload import (
    UploadedFileResponse,
    UploadedFileDetail,
    ConfirmReceiptFromUpload,
)
from app.schemas.receipt import Receipt as ReceiptSchema
from app.services import storage as storage_service
from app.services.upload_processor import process_upload

router = APIRouter()


@router.post(
    "/",
    response_model=UploadedFileResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Fiş/fatura görseli (jpg/png/heic)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Yeni dosya yükle. OCR arka planda çalışır; bu endpoint hemen 202 döner.

    İstemci sonrasında GET /receipts/upload/{id} ile durumu sorgular.
    """
    content = await file.read()

    # MIME doğrulama + boyut kontrolü + diske yazma
    try:
        saved = await storage_service.save_upload(
            user_id=current_user.id,
            content=content,
            original_filename=file.filename,
        )
    except storage_service.StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # SHA-256 dedup: aynı kullanıcı aynı içeriği tekrar yüklediyse eski kayıt
    existing = await db.execute(
        select(UploadedFile).where(
            UploadedFile.user_id == current_user.id,
            UploadedFile.sha256 == saved.sha256,
        )
    )
    duplicate = existing.scalars().first()
    if duplicate is not None:
        # Yeni yazdığımız dosyayı sil — eskisi var
        storage_service.delete_file(saved.storage_path)
        return duplicate

    upload = UploadedFile(
        user_id=current_user.id,
        original_filename=saved.original_filename,
        mime_type=saved.mime_type,
        size_bytes=saved.size_bytes,
        sha256=saved.sha256,
        storage_path=saved.storage_path,
        status="pending",
    )
    db.add(upload)
    await db.commit()
    await db.refresh(upload)

    # Async OCR'ı kuyruğa al
    # NOT: Celery'ye geçişte burası enqueue('process_upload', upload.id) olacak
    background_tasks.add_task(process_upload, upload.id)

    return upload


@router.get("/", response_model=List[UploadedFileResponse])
async def list_uploads(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm upload kayıtlarını döner (yeniden eskiye)."""
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.user_id == current_user.id)
        .order_by(UploadedFile.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{upload_id}", response_model=UploadedFileDetail)
async def get_upload(
    upload_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Tek upload kaydı + ham OCR metni.
    İstemci bu endpoint'i 'pending'/'processing' iken 1-2 sn aralıklarla polling eder.
    """
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == upload_id,
            UploadedFile.user_id == current_user.id,
        )
    )
    upload = result.scalars().first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return upload


@router.post(
    "/{upload_id}/confirm",
    response_model=ReceiptSchema,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_upload_as_receipt(
    upload_id: uuid.UUID,
    payload: ConfirmReceiptFromUpload,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Kullanıcı OCR sonucunu inceleyip onaylar — bu noktada gerçek Receipt oluşur.
    Kullanıcı dilerse parsed_data'yı düzenleyip yollar.
    """
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == upload_id,
            UploadedFile.user_id == current_user.id,
        )
    )
    upload = result.scalars().first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status != "done":
        raise HTTPException(
            status_code=409,
            detail=f"Upload status='{upload.status}', henüz onaylanamaz.",
        )

    if upload.receipt_id is not None:
        raise HTTPException(
            status_code=409, detail="Bu upload zaten bir fiş'e dönüştürülmüş."
        )

    receipt = Receipt(
        user_id=current_user.id,
        source_file_id=upload.id,
        merchant_name=payload.merchant_name,
        total_amount=payload.total_amount,
        receipt_type=payload.receipt_type,
        receipt_date=payload.receipt_date,
        category=payload.category,
        text_content=payload.text_content or upload.text_content,
    )
    db.add(receipt)
    await db.flush()  # receipt.id elde et

    # Faz 4: Anomali tespiti (hata olursa receipt kaydını engelleme)
    is_anomaly, anomaly_score = False, 0.0
    try:
        from app.services.anomaly_detector import check_receipt_anomaly
        is_anomaly, anomaly_score = await check_receipt_anomaly(
            db=db,
            user_id=current_user.id,
            receipt_id=receipt.id,
            category=payload.category,
            amount=payload.total_amount,
        )
    except Exception:
        pass
    receipt.is_anomaly = is_anomaly
    receipt.anomaly_score = anomaly_score
    db.add(receipt)

    upload.receipt_id = receipt.id
    db.add(upload)

    # Faz 3: Fişi Qdrant vektör veritabanına indexle (arka planda, hata olursa sessizce geç)
    try:
        from app.services.vector_store import index_receipt
        index_receipt(
            receipt_id=receipt.id,
            user_id=current_user.id,
            text=receipt.text_content or "",
            metadata={
                "merchant_name": receipt.merchant_name or "",
                "category": receipt.category or "",
                "amount": str(receipt.total_amount) if receipt.total_amount else "",
                "date": receipt.receipt_date.isoformat() if receipt.receipt_date else "",
                "text": (receipt.text_content or "")[:500],
            },
        )
    except Exception:
        pass

    # Bütçe aşımı kontrolü
    try:
        if payload.receipt_type != "income":
            from app.services.budget_checker import check_and_notify_budget
            await check_and_notify_budget(
                db=db,
                user_id=current_user.id,
                category=payload.category or "",
                receipt_id=receipt.id,
            )
    except Exception:
        pass

    # Faz 6: Anomali varsa bildirim oluştur
    if is_anomaly:
        from app.models.notification import Notification
        notif = Notification(
            user_id=current_user.id,
            notification_type="anomaly",
            receipt_id=receipt.id,
            title="Anormal Harcama Tespit Edildi",
            message=(
                f"{receipt.merchant_name or 'Bilinmeyen mağaza'} fişindeki "
                f"₺{float(receipt.total_amount):.2f} tutarı, "
                f"{receipt.category} kategorisindeki normal harcamalarınızdan "
                f"belirgin şekilde farklı."
            ),
        )
        db.add(notif)

        # Anomali e-postası + push bildirimi gönder
        try:
            from app.services.email_service import send_anomaly_email
            from app.services.push_service import send_push
            import asyncio
            date_str = receipt.receipt_date.strftime("%d.%m.%Y") if receipt.receipt_date else "?"
            merchant = receipt.merchant_name or "Bilinmeyen mağaza"
            amount_val = float(receipt.total_amount or 0)

            asyncio.create_task(
                send_anomaly_email(
                    to_email=current_user.email,
                    merchant=merchant,
                    amount=amount_val,
                    date_str=date_str,
                )
            )
            asyncio.create_task(
                send_push(
                    token=current_user.push_token,
                    title="🚨 Anormal Harcama Tespit Edildi",
                    body=f"{merchant} — ₺{amount_val:,.0f} tutarındaki işlem alışılmadık görünüyor.",
                    data={"type": "anomaly", "receipt_id": str(receipt.id)},
                )
            )
        except Exception:
            pass

    # Kategori feedback kaydı — model önerisi ile kullanıcı seçimini sakla
    # (retrain sırasında gerçek eğitim verisi olarak kullanılır)
    parsed = upload.parsed_data or {}
    suggested = parsed.get("suggested_category")
    feedback = CategoryFeedback(
        user_id=current_user.id,
        upload_id=upload.id,
        receipt_id=receipt.id,
        suggested_category=suggested,
        selected_category=payload.category,
        ocr_text=upload.text_content,
    )
    db.add(feedback)

    await db.commit()

    # receipt_tags ilişkisini eager load ile yeniden sorgula
    # (async SQLAlchemy lazy loading desteklemediği için gerekli)
    from app.models.receipt_tag import ReceiptTag
    from app.models.tag import Tag
    result2 = await db.execute(
        select(Receipt)
        .where(Receipt.id == receipt.id)
        .options(
            selectinload(Receipt.receipt_tags).selectinload(ReceiptTag.tag)
        )
    )
    receipt = result2.scalars().first()
    return receipt


@router.delete(
    "/{upload_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_upload(
    upload_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Upload kaydını ve diskteki dosyayı siler."""
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == upload_id,
            UploadedFile.user_id == current_user.id,
        )
    )
    upload = result.scalars().first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    storage_service.delete_file(upload.storage_path)
    await db.delete(upload)
    await db.commit()
    return None
