"""
ReceiptIQ — Veri temizliği

Bir fiş ya da hesap silinince, veritabanı satırının ötesindeki kopyalar da silinmelidir:
  - Qdrant'taki fiş vektörleri (sohbet/arama için tutulan metin gömmeleri)
  - Diskteki yüklenmiş dosyalar (fiş fotoğrafları) ve profil fotoğrafı

Hepsi "en iyi çaba" ile yapılır: bir dış kaynak hata verirse kullanıcının silme hakkı
engellenmez, hata günlüğe yazılır. Dış kaynaklar veritabanından ÖNCE silinir; çünkü
veritabanı kaydı gidince "bu vektör/dosya kimin" bilgisi de kaybolur ve yarım kalan
bir silme sonradan düzeltilemez.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.uploaded_file import UploadedFile
from app.services import storage, vector_store

log = logging.getLogger(__name__)


async def purge_receipt_artifacts(
    db: AsyncSession, user_id: uuid.UUID, receipt_ids: list[uuid.UUID]
) -> None:
    """
    Fişlerin vektörlerini ve onlara bağlı yüklenmiş dosyaları (disk + uploaded_files satırı) siler.
    Veritabanı commit'i çağıran tarafa aittir.
    """
    if not receipt_ids:
        return

    try:
        vectors_ok = await asyncio.to_thread(vector_store.delete_receipts, list(receipt_ids))
    except Exception as e:  # beklenmedik hata silmeyi engellememeli
        vectors_ok = False
        log.error("Fiş vektörü silme beklenmedik hata verdi: %s", e)
    if not vectors_ok:
        log.warning("Fiş vektörleri silinemedi (Qdrant kapalı ya da hata): kullanıcı=%s", user_id)

    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.user_id == user_id,
            UploadedFile.receipt_id.in_(receipt_ids),
        )
    )
    for row in result.scalars().all():
        try:
            storage.delete_file(row.storage_path)
        except OSError as e:
            log.error("Dosya silinemedi (%s): %s", row.storage_path, e)
        await db.delete(row)


async def purge_user_data(user_id: uuid.UUID, avatar_path: str | None = None) -> dict:
    """
    Hesap silinirken: kullanıcının tüm fiş vektörlerini, yüklenmiş dosya klasörünü ve
    profil fotoğrafını siler. Hangi adımın başarılı olduğunu döner (test ve günlük için).
    """
    try:
        vectors_ok = await asyncio.to_thread(vector_store.delete_user_receipts, user_id)
    except Exception as e:  # beklenmedik hata silmeyi engellememeli
        vectors_ok = False
        log.error("Kullanıcı vektörü silme beklenmedik hata verdi: %s", e)
    if not vectors_ok:
        log.warning("Kullanıcı vektörleri silinemedi (Qdrant kapalı ya da hata): kullanıcı=%s", user_id)

    try:
        files_ok = await asyncio.to_thread(storage.delete_user_dir, user_id)
    except Exception as e:
        files_ok = False
        log.error("Kullanıcı dosya silme beklenmedik hata verdi: %s", e)
    if not files_ok:
        log.error("Kullanıcı dosya klasörü silinemedi: kullanıcı=%s", user_id)

    avatar_ok = True
    if avatar_path:
        try:
            os.remove(avatar_path)
        except FileNotFoundError:
            pass
        except OSError as e:
            avatar_ok = False
            log.error("Profil fotoğrafı silinemedi: %s", e)

    return {"vectors": vectors_ok, "files": files_ok, "avatar": avatar_ok}
