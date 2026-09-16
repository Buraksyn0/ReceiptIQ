"""
confirm_upload_as_receipt uç noktası testleri — dosya yükleme/OCR
adımlarını atlayıp, veritabanına doğrudan "OCR'ı bitmiş" bir UploadedFile
kaydı ekleyerek, onay (confirm) adımının kendisini test ediyoruz.
"""
import uuid

from sqlalchemy import select

from app.models.uploaded_file import UploadedFile
from app.models.receipt import Receipt


async def _get_user_id(client, token):
    res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    return uuid.UUID(res.json()["id"])


async def _create_upload(db_session, user_id, status="done", receipt_id=None):
    upload = UploadedFile(
        user_id=user_id,
        original_filename="fis.jpg",
        mime_type="image/jpeg",
        size_bytes=1234,
        sha256="a" * 64,
        storage_path="/tmp/fake/fis.jpg",
        status=status,
        text_content="MIGROS\nTOPLAM: 100.00 TL",
        receipt_id=receipt_id,
    )
    db_session.add(upload)
    await db_session.commit()
    await db_session.refresh(upload)
    return upload


async def test_confirm_upload_creates_receipt(client, db_session, test_user):
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}
    user_id = await _get_user_id(client, test_user["token"])
    upload = await _create_upload(db_session, user_id, status="done")

    res = await client.post(
        f"/api/v1/receipts/upload/{upload.id}/confirm",
        json={
            "merchant_name": "Migros",
            "total_amount": 100.0,
            "receipt_type": "expense",
            "category": "market",
        },
        headers=auth_headers,
    )

    assert res.status_code == 201
    data = res.json()
    assert data["merchant_name"] == "Migros"
    assert data["source_file_id"] == str(upload.id)

    # UploadedFile.receipt_id gerçekten set edilmiş mi doğrula
    refreshed = await db_session.execute(select(UploadedFile).where(UploadedFile.id == upload.id))
    refreshed_upload = refreshed.scalars().first()
    assert refreshed_upload.receipt_id == uuid.UUID(data["id"])


async def test_confirm_upload_not_done_is_rejected(client, db_session, test_user):
    """OCR henüz bitmemiş (status != 'done') bir upload onaylanamamalı."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}
    user_id = await _get_user_id(client, test_user["token"])
    upload = await _create_upload(db_session, user_id, status="pending")

    res = await client.post(
        f"/api/v1/receipts/upload/{upload.id}/confirm",
        json={"merchant_name": "Migros", "total_amount": 100.0, "category": "market"},
        headers=auth_headers,
    )

    assert res.status_code == 409


async def test_confirm_upload_already_confirmed_is_rejected(client, db_session, test_user):
    """Zaten bir fişe dönüştürülmüş bir upload ikinci kez onaylanamamalı."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}
    user_id = await _get_user_id(client, test_user["token"])

    # Önce gerçek bir fiş oluşturup upload'a bağlayalım
    receipt = Receipt(user_id=user_id, merchant_name="Eski Fiş", total_amount=50)
    db_session.add(receipt)
    await db_session.flush()
    upload = await _create_upload(db_session, user_id, status="done", receipt_id=receipt.id)

    res = await client.post(
        f"/api/v1/receipts/upload/{upload.id}/confirm",
        json={"merchant_name": "Migros", "total_amount": 100.0, "category": "market"},
        headers=auth_headers,
    )

    assert res.status_code == 409
