"""
Hesap silme testi: kullanıcı hesabını sildiğinde, ona bağlı verilerin
(fişler dahil) veritabanı seviyesinde (CASCADE) gerçekten silindiğini doğrular.

Bu, bugün elle (psql ile) doğruladığımız CASCADE davranışının otomatik hali.
"""
import uuid

from sqlalchemy import select

from app.models.receipt import Receipt
from app.models.user import User


async def test_delete_account_cascades_receipts(client, db_session, test_user):
    # Kullanıcının gerçek id'sini al
    me_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )
    user_id = uuid.UUID(me_res.json()["id"])

    # Kullanıcıya bağlı bir fiş oluştur
    receipt = Receipt(user_id=user_id, merchant_name="Test Market", total_amount=100)
    db_session.add(receipt)
    await db_session.commit()

    # Fişin gerçekten oluştuğunu doğrula
    result = await db_session.execute(select(Receipt).where(Receipt.user_id == user_id))
    assert result.scalars().first() is not None

    # Hesabı sil
    delete_res = await client.delete(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )
    assert delete_res.status_code == 204

    # Kullanıcı gerçekten silinmiş mi
    user_result = await db_session.execute(select(User).where(User.id == user_id))
    assert user_result.scalars().first() is None

    # Fiş de cascade ile silinmiş mi
    receipt_result = await db_session.execute(select(Receipt).where(Receipt.user_id == user_id))
    assert receipt_result.scalars().first() is None
