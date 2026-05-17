"""
/api/v1/tags — Kullanıcı etiket yönetimi
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.models.user import User
from app.models.tag import Tag, ReceiptTag
from app.models.receipt import Receipt

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str
    color: str = "#00A878"


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class TagOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str

    model_config = {"from_attributes": True}


# ── Tag CRUD ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[TagOut])
async def list_tags(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(
        select(Tag)
        .where(Tag.user_id == current_user.id)
        .order_by(Tag.created_at.asc())
    )
    return result.scalars().all()


@router.post("/", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Etiket adı boş olamaz.")
    if len(payload.name.strip()) > 50:
        raise HTTPException(status_code=400, detail="Etiket adı en fazla 50 karakter olabilir.")

    tag = Tag(
        user_id=current_user.id,
        name=payload.name.strip(),
        color=payload.color,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.patch("/{tag_id}", response_model=TagOut)
async def update_tag(
    tag_id: uuid.UUID,
    payload: TagUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    )
    tag = result.scalars().first()
    if not tag:
        raise HTTPException(status_code=404, detail="Etiket bulunamadı.")
    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(status_code=400, detail="Etiket adı boş olamaz.")
        tag.name = payload.name.strip()
    if payload.color is not None:
        tag.color = payload.color
    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    )
    tag = result.scalars().first()
    if not tag:
        raise HTTPException(status_code=404, detail="Etiket bulunamadı.")
    await db.delete(tag)
    await db.commit()


# ── Fişe etiket ekle / çıkar ─────────────────────────────────────────────────

@router.post("/receipts/{receipt_id}/tags/{tag_id}", status_code=status.HTTP_201_CREATED)
async def add_tag_to_receipt(
    receipt_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    # Fiş bu kullanıcıya ait mi?
    receipt = await db.get(Receipt, receipt_id)
    if not receipt or receipt.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Fiş bulunamadı.")

    # Etiket bu kullanıcıya ait mi?
    tag = await db.get(Tag, tag_id)
    if not tag or tag.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Etiket bulunamadı.")

    # Zaten ekli mi?
    existing = await db.execute(
        select(ReceiptTag).where(
            ReceiptTag.receipt_id == receipt_id,
            ReceiptTag.tag_id == tag_id,
        )
    )
    if existing.scalars().first():
        return {"detail": "Etiket zaten ekli."}

    db.add(ReceiptTag(receipt_id=receipt_id, tag_id=tag_id))
    await db.commit()
    return {"detail": "Etiket eklendi."}


@router.delete("/receipts/{receipt_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag_from_receipt(
    receipt_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    receipt = await db.get(Receipt, receipt_id)
    if not receipt or receipt.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Fiş bulunamadı.")

    result = await db.execute(
        select(ReceiptTag).where(
            ReceiptTag.receipt_id == receipt_id,
            ReceiptTag.tag_id == tag_id,
        )
    )
    rt = result.scalars().first()
    if not rt:
        raise HTTPException(status_code=404, detail="Bu etiket bu fişe ekli değil.")

    await db.delete(rt)
    await db.commit()
