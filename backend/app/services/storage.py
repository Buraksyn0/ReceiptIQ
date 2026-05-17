"""
Dosya depolama servisi.

Sorumluluklar:
- Magic byte ile gerçek MIME doğrulama (uzantıya güvenmiyoruz)
- SHA-256 hash hesabı (yinelenen yüklemeleri tespit için)
- UUID isimli güvenli dosya yolu
- Async dosya yazma (aiofiles)

Storage layout:
  {STORAGE_DIR}/{user_id}/{uuid}.{ext}
"""

from __future__ import annotations
import hashlib
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

import aiofiles

from app.core.config import settings


# === Magic byte sözlüğü ===
# Sadece gerçekten desteklediğimiz formatları kabul ediyoruz
_MIME_SIGNATURES: dict[str, list[bytes]] = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/heic": [b"ftypheic", b"ftypheix", b"ftypmif1", b"ftyphevc"],
    "image/heif": [b"ftypmif1", b"ftypheif"],
}

ALLOWED_MIME_TYPES = set(_MIME_SIGNATURES.keys())

_EXT_FROM_MIME = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/heif": "heif",
}


class StorageError(Exception):
    pass


@dataclass
class SavedFile:
    storage_path: str   # Mutlak yol
    relative_path: str  # STORAGE_DIR'e göre relatif yol
    sha256: str
    mime_type: str
    size_bytes: int
    original_filename: str | None


def detect_mime(content: bytes) -> str | None:
    """Dosya başlığına bakarak MIME tahmin eder. Bilinmiyorsa None."""
    head = content[:32]
    for mime, signatures in _MIME_SIGNATURES.items():
        for sig in signatures:
            # JPEG/PNG: dosyanın başı
            if mime in ("image/jpeg", "image/png") and head.startswith(sig):
                return mime
            # HEIC/HEIF: 'ftyp' chunk'ı genelde 4. byte'ta
            if mime in ("image/heic", "image/heif") and sig in head:
                return mime
    return None


def sha256_of_bytes(content: bytes) -> str:
    h = hashlib.sha256()
    h.update(content)
    return h.hexdigest()


def _ensure_user_dir(user_id) -> Path:
    base = Path(settings.STORAGE_DIR).resolve()
    user_dir = base / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


async def save_upload(
    *,
    user_id,
    content: bytes,
    original_filename: str | None = None,
) -> SavedFile:
    """
    Yüklenen byte içeriğini doğrular ve diske yazar.

    Doğrulamalar:
    - Boyut: <= MAX_UPLOAD_SIZE_MB
    - MIME: ALLOWED_MIME_TYPES içinde olmalı (magic byte ile)
    """
    if not content:
        raise StorageError("Boş dosya")

    size_bytes = len(content)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise StorageError(
            f"Dosya çok büyük: {size_bytes / 1024 / 1024:.1f} MB "
            f"(maks {settings.MAX_UPLOAD_SIZE_MB} MB)"
        )

    mime = detect_mime(content)
    if mime is None or mime not in ALLOWED_MIME_TYPES:
        raise StorageError(
            f"Desteklenmeyen dosya tipi. Kabul edilen: {sorted(ALLOWED_MIME_TYPES)}"
        )

    digest = sha256_of_bytes(content)
    ext = _EXT_FROM_MIME.get(mime, "bin")
    new_uuid = uuid.uuid4().hex
    filename = f"{new_uuid}.{ext}"

    user_dir = _ensure_user_dir(user_id)
    full_path = user_dir / filename
    async with aiofiles.open(full_path, "wb") as f:
        await f.write(content)

    base = Path(settings.STORAGE_DIR).resolve()
    relative = full_path.relative_to(base)

    return SavedFile(
        storage_path=str(full_path),
        relative_path=str(relative),
        sha256=digest,
        mime_type=mime,
        size_bytes=size_bytes,
        original_filename=original_filename,
    )


def delete_file(storage_path: str) -> None:
    """Diskten sil — dosya yoksa sessizce geç."""
    try:
        os.remove(storage_path)
    except FileNotFoundError:
        pass
