"""
Bildirim (notification) okunmamış sayısı ve toplu okundu işaretleme testleri.

Bu uç noktalarda bildirim OLUŞTURAN bir API yok (bildirimler sistem içinden,
örn. bütçe aşımı tespitinde otomatik oluşturuluyor) — bu yüzden test
verisini API üzerinden değil, doğrudan veritabanına (db_session ile) ekliyoruz.
"""
import uuid

from app.models.notification import Notification


async def _get_user_id(client, token):
    res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    return uuid.UUID(res.json()["id"])


async def test_unread_count_only_counts_unread(client, db_session, test_user):
    """unread-count, sadece is_read=False olan bildirimleri saymalı."""
    user_id = await _get_user_id(client, test_user["token"])

    db_session.add_all([
        Notification(user_id=user_id, notification_type="info", title="A", message="a", is_read=False),
        Notification(user_id=user_id, notification_type="info", title="B", message="b", is_read=False),
        Notification(user_id=user_id, notification_type="info", title="C", message="c", is_read=True),
    ])
    await db_session.commit()

    res = await client.get(
        "/api/v1/notifications/unread-count",
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )
    assert res.json()["unread_count"] == 2


async def test_mark_all_read(client, db_session, test_user):
    """read-all çağrıldıktan sonra, unread_count 0 olmalı."""
    user_id = await _get_user_id(client, test_user["token"])
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    db_session.add_all([
        Notification(user_id=user_id, notification_type="info", title="A", message="a", is_read=False),
        Notification(user_id=user_id, notification_type="info", title="B", message="b", is_read=False),
    ])
    await db_session.commit()

    mark_res = await client.patch("/api/v1/notifications/read-all", headers=auth_headers)
    assert mark_res.status_code == 200

    count_res = await client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert count_res.json()["unread_count"] == 0
