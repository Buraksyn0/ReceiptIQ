import csv
import io
import os
import uuid
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, FileResponse
from fpdf import FPDF
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.user import User
from app.models.receipt import Receipt
from app.models.uploaded_file import UploadedFile
from app.models.category_feedback import CategoryFeedback
from app.schemas.receipt import (
    Receipt as ReceiptSchema,
    ReceiptCreate,
    ReceiptUpdate,
)

router = APIRouter()


async def _get_owned_receipt(
    receipt_id: uuid.UUID, db: AsyncSession, user: User
) -> Receipt:
    """Sahiplik kontrolü ile fiş çek."""
    from app.models.tag import ReceiptTag
    result = await db.execute(
        select(Receipt)
        .where(Receipt.id == receipt_id, Receipt.user_id == user.id)
        .options(selectinload(Receipt.tags).selectinload(ReceiptTag.tag))
    )
    receipt = result.scalars().first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.get("/", response_model=List[ReceiptSchema])
async def read_receipts(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Giriş yapmış kullanıcının tüm fişlerini döner."""
    from app.models.tag import ReceiptTag
    result = await db.execute(
        select(Receipt)
        .where(Receipt.user_id == current_user.id)
        .options(selectinload(Receipt.tags).selectinload(ReceiptTag.tag))
    )
    return result.scalars().all()


@router.get("/export/csv")
async def export_receipts_csv(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm fişlerini CSV olarak döner."""
    result = await db.execute(
        select(Receipt)
        .where(Receipt.user_id == current_user.id)
        .order_by(Receipt.receipt_date.desc())
    )
    receipts = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Merchant", "Category", "Type", "Amount"])

    for r in receipts:
        writer.writerow([
            str(r.receipt_date)[:10] if r.receipt_date else "",
            r.merchant_name or "",
            r.category or "",
            r.receipt_type or "",
            str(r.total_amount or ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=receipts.csv"},
    )


def _ascii(text: str) -> str:
    """Türkçe ve özel karakterleri PDF-güvenli ASCII'ye çevirir."""
    table = str.maketrans(
        "şŞğĞüÜöÖçÇıİ",
        "sSgGuUoOcCiI"
    )
    return text.translate(table).replace("₺", "TL")


@router.get("/export/pdf")
async def export_receipts_pdf(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm fişlerini profesyonel PDF olarak döner."""
    result = await db.execute(
        select(Receipt)
        .where(Receipt.user_id == current_user.id)
        .order_by(Receipt.receipt_date.desc())
    )
    receipts = result.scalars().all()

    total_income = sum(float(r.total_amount or 0) for r in receipts if r.receipt_type == "income")
    total_expense = sum(float(r.total_amount or 0) for r in receipts if r.receipt_type != "income")
    balance = total_income - total_expense
    now = datetime.now().strftime("%d.%m.%Y")

    class PDF(FPDF):
        def header(self):
            self.set_fill_color(108, 99, 255)
            self.rect(0, 0, 210, 28, 'F')
            self.set_font("helvetica", "B", 20)
            self.set_text_color(255, 255, 255)
            self.set_xy(14, 6)
            self.cell(0, 10, "ReceiptIQ", ln=False)
            self.set_font("helvetica", "", 9)
            self.set_text_color(220, 215, 255)
            self.set_xy(14, 17)
            name = _ascii(current_user.full_name or current_user.email or "")
            self.cell(0, 6, f"Finansal Rapor  |  {name}  |  {now}")
            self.ln(18)

        def footer(self):
            self.set_y(-12)
            self.set_font("helvetica", "", 7)
            self.set_text_color(160, 163, 189)
            self.cell(0, 6, f"Bu rapor ReceiptIQ tarafindan {now} tarihinde olusturulmustur.", align="C")

    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(14, 14, 14)

    # Özet kartlar
    card_y = 34
    card_h = 22
    card_w = (210 - 28 - 8) / 3
    x_start = 14
    cards = [
        ("Toplam Gelir", f"TL {total_income:,.2f}",  (0, 200, 83)),
        ("Toplam Gider", f"TL {total_expense:,.2f}", (255, 82, 82)),
        ("Net Bakiye",   f"TL {balance:,.2f}",        (108, 99, 255)),
    ]
    for i, (label, value, color) in enumerate(cards):
        x = x_start + i * (card_w + 4)
        pdf.set_fill_color(247, 248, 255)
        pdf.set_draw_color(229, 231, 235)
        pdf.rect(x, card_y, card_w, card_h, 'FD')
        pdf.set_font("helvetica", "", 8)
        pdf.set_text_color(107, 114, 128)
        pdf.set_xy(x, card_y + 4)
        pdf.cell(card_w, 5, label, align="C")
        pdf.set_font("helvetica", "B", 13)
        pdf.set_text_color(*color)
        pdf.set_xy(x, card_y + 11)
        pdf.cell(card_w, 6, value, align="C")

    pdf.set_y(card_y + card_h + 8)

    # Bölüm başlığı
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(26, 29, 30)
    pdf.cell(0, 8, f"Islem Gecmisi  ({len(receipts)} kayit)", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    # Tablo başlık satırı
    col_w = [28, 62, 36, 22, 30]
    headers = ["Tarih", "Magaza / Aciklama", "Kategori", "Tur", "Tutar"]

    pdf.set_fill_color(108, 99, 255)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("helvetica", "B", 8)
    for w, h in zip(col_w, headers):
        pdf.cell(w, 8, h, border=0, align="C", fill=True)
    pdf.ln()

    # Satırlar
    pdf.set_font("helvetica", "", 8)
    for idx, r in enumerate(receipts):
        date_str = str(r.receipt_date)[:10] if r.receipt_date else "-"
        is_income = r.receipt_type == "income"
        merchant = _ascii((r.merchant_name or "-"))[:28]
        category = _ascii((r.category or "-"))[:18]
        tur = "Gelir" if is_income else "Gider"
        amount = f"{'+'if is_income else '-'}TL {float(r.total_amount or 0):,.2f}"

        bg = (255, 255, 255) if idx % 2 == 0 else (247, 248, 255)
        pdf.set_fill_color(*bg)
        pdf.set_draw_color(229, 231, 235)
        pdf.set_text_color(26, 29, 30)

        row_data = [date_str, merchant, category, tur, amount]
        aligns = ["C", "L", "L", "C", "R"]
        for w, val, align in zip(col_w, row_data, aligns):
            if val == amount:
                pdf.set_text_color(0, 200, 83) if is_income else pdf.set_text_color(255, 82, 82)
                pdf.set_font("helvetica", "B", 8)
            else:
                pdf.set_text_color(26, 29, 30)
                pdf.set_font("helvetica", "", 8)
            pdf.cell(w, 7, val, border="B", align=align, fill=True)
        pdf.ln()

    buffer = io.BytesIO(pdf.output())
    return StreamingResponse(
        iter([buffer.read()]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=receipts.pdf"},
    )


@router.post("/", response_model=ReceiptSchema, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    *,
    db: AsyncSession = Depends(deps.get_db),
    receipt_in: ReceiptCreate,
    current_user: User = Depends(deps.get_current_user),
):
    """Yeni fiş oluştur."""
    receipt = Receipt(**receipt_in.model_dump(), user_id=current_user.id)
    db.add(receipt)
    await db.flush()  # receipt.id elde et

    # Bütçe aşımı kontrolü
    if receipt_in.receipt_type != "income":
        from app.services.budget_checker import check_and_notify_budget
        await check_and_notify_budget(
            db=db,
            user_id=current_user.id,
            category=receipt_in.category or "",
            receipt_id=receipt.id,
        )

    await db.commit()

    # tags ilişkisini de yükleyerek taze kayıt al
    result = await db.execute(
        select(Receipt)
        .where(Receipt.id == receipt.id)
        .options(selectinload(Receipt.tags))
    )
    receipt = result.scalars().first()

    # Qdrant'a indexle (hata olursa fiş yine de kaydedilir)
    try:
        from app.services.vector_store import index_receipt
        index_receipt(
            receipt_id=receipt.id,
            user_id=current_user.id,
            text=receipt.text_content or f"{receipt.merchant_name or ''} {receipt.category or ''}",
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

    return receipt


@router.get("/{receipt_id}/image")
async def get_receipt_image(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user_or_token),
):
    """
    Fişe bağlı tarama görselini döner (JPEG / PNG).
    Yalnızca taranmış fişlerde (source_file_id dolu) çalışır.
    """
    receipt = await _get_owned_receipt(receipt_id, db, current_user)

    if not receipt.source_file_id:
        raise HTTPException(status_code=404, detail="Bu fişe bağlı bir görsel yok")

    result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == receipt.source_file_id)
    )
    upload = result.scalars().first()

    if not upload:
        raise HTTPException(status_code=404, detail="Görsel kaydı bulunamadı")

    if not os.path.exists(upload.storage_path):
        raise HTTPException(status_code=404, detail="Görsel dosyası bulunamadı")

    # MIME type'a göre media_type belirle
    media_type = upload.mime_type or "image/jpeg"

    return FileResponse(
        path=upload.storage_path,
        media_type=media_type,
        filename=upload.original_filename or "receipt.jpg",
    )


@router.get("/{receipt_id}", response_model=ReceiptSchema)
async def read_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Tek bir fişi getir."""
    return await _get_owned_receipt(receipt_id, db, current_user)


@router.put("/{receipt_id}", response_model=ReceiptSchema)
@router.patch("/{receipt_id}", response_model=ReceiptSchema)
async def update_receipt(
    receipt_id: uuid.UUID,
    receipt_in: ReceiptUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Fiş güncelle (yalnız sahibi)."""
    receipt = await _get_owned_receipt(receipt_id, db, current_user)
    update_data = receipt_in.model_dump(exclude_unset=True)

    # Kategori değişikliği varsa feedback kaydet
    if "category" in update_data and update_data["category"] != receipt.category:
        feedback = CategoryFeedback(
            user_id=current_user.id,
            receipt_id=receipt.id,
            suggested_category=receipt.category,
            selected_category=update_data["category"],
            ocr_text=receipt.text_content,
        )
        db.add(feedback)

    for field, value in update_data.items():
        setattr(receipt, field, value)
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)
    return receipt


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Fiş sil (yalnız sahibi)."""
    receipt = await _get_owned_receipt(receipt_id, db, current_user)
    await db.delete(receipt)
    await db.commit()
    return None


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_receipts(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm fişlerini sil."""
    await db.execute(
        delete(Receipt).where(Receipt.user_id == current_user.id)
    )
    await db.commit()
    return None


@router.post("/reindex", status_code=200)
async def reindex_receipts(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Kullanıcının tüm mevcut fişlerini Qdrant'a (yeniden) indexler.
    Geliştirme/bakım amaçlı — tek seferlik çalıştır.
    """
    from app.services.vector_store import index_receipt

    result = await db.execute(
        select(Receipt).where(Receipt.user_id == current_user.id)
    )
    receipts = result.scalars().all()

    success, failed = 0, 0
    for r in receipts:
        text = r.text_content or f"{r.merchant_name or ''} {r.category or ''}"
        ok = index_receipt(
            receipt_id=r.id,
            user_id=current_user.id,
            text=text,
            metadata={
                "merchant_name": r.merchant_name or "",
                "category": r.category or "",
                "amount": str(r.total_amount) if r.total_amount else "",
                "date": r.receipt_date.isoformat() if r.receipt_date else "",
                "text": text[:500],
            },
        )
        if ok:
            success += 1
        else:
            failed += 1

    return {"indexed": success, "failed": failed, "total": len(receipts)}
