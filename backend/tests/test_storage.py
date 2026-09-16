"""
Dosya depolama servisi (storage.py) için testler.

Gerçek Google Vision/OCR'a hiç girmiyoruz — sadece dosya doğrulama ve
kaydetme mantığını (magic byte kontrolü, boyut limiti) test ediyoruz.
Gerçek diske değil, geçici (temp) bir klasöre yazıyoruz.
"""
import shutil
import tempfile
import uuid
from unittest.mock import patch

import pytest

from app.core.config import settings
from app.services import storage


@pytest.fixture
def tmp_storage_dir():
    """Testler gerçek STORAGE_DIR'e (/data/storage) değil, geçici bir
    klasöre yazsın diye settings.STORAGE_DIR'i test süresince değiştiriyoruz."""
    tmp_dir = tempfile.mkdtemp()
    with patch.object(settings, "STORAGE_DIR", tmp_dir):
        yield tmp_dir
    shutil.rmtree(tmp_dir, ignore_errors=True)


async def test_save_upload_accepts_valid_jpeg(tmp_storage_dir):
    """Gerçek JPEG başlangıç baytlarına (\\xff\\xd8\\xff) sahip bir dosya kabul edilmeli."""
    jpeg_content = b"\xff\xd8\xff" + b"sahte jpeg verisi" * 10

    result = await storage.save_upload(
        user_id=uuid.uuid4(),
        content=jpeg_content,
        original_filename="fis.jpg",
    )

    assert result.mime_type == "image/jpeg"
    assert result.sha256 == storage.sha256_of_bytes(jpeg_content)


async def test_save_upload_rejects_content_that_is_not_really_an_image(tmp_storage_dir):
    """
    Dosya adı .jpg olsa bile, GERÇEK baytları hiçbir bilinen resim formatının
    imzasıyla eşleşmiyorsa reddedilmeli — uzantıya değil, içeriğe güveniyoruz.
    """
    fake_content = b"Bu aslinda bir JPEG degil, duz metin." * 5

    with pytest.raises(storage.StorageError):
        await storage.save_upload(
            user_id=uuid.uuid4(),
            content=fake_content,
            original_filename="sahte.jpg",
        )


async def test_save_upload_rejects_empty_file(tmp_storage_dir):
    with pytest.raises(storage.StorageError):
        await storage.save_upload(user_id=uuid.uuid4(), content=b"", original_filename="bos.jpg")


async def test_save_upload_rejects_oversized_file(tmp_storage_dir):
    """MAX_UPLOAD_SIZE_MB'ı 1'e düşürüp, onu aşan bir dosya gönderiyoruz."""
    with patch.object(settings, "MAX_UPLOAD_SIZE_MB", 1):
        too_big = b"\xff\xd8\xff" + b"x" * (1024 * 1024 + 1)
        with pytest.raises(storage.StorageError):
            await storage.save_upload(
                user_id=uuid.uuid4(), content=too_big, original_filename="buyuk.jpg"
            )
