"""
Veri temizliği testleri: fiş ya da hesap silinince Qdrant vektörleri, diskteki dosyalar ve
profil fotoğrafı da silinmeli (KVKK / Google Play veri silme şartı).

Gerçek Qdrant'a gidilmiyor: sahte istemci ve kayıt tutan sahte fonksiyonlar kullanılıyor.
Dosyalar geçici (tmp_path) klasörlerde oluşturuluyor.
"""
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select, update

from app.api.endpoints import users as users_endpoint
from app.core.config import settings
from app.models.uploaded_file import UploadedFile
from app.models.user import User
from app.services import storage, vector_store


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------

class FakeQdrant:
    """qdrant-client yerine geçen ve delete çağrısını kaydeden sahte istemci."""

    def __init__(self, error=None):
        self.calls = []
        self.error = error

    def delete(self, collection_name, points_selector):
        self.calls.append({"collection": collection_name, "selector": points_selector})
        if self.error:
            raise self.error


@pytest.fixture
def vector_calls(monkeypatch):
    """vector_store silme fonksiyonlarını kayıt tutan sahtelerle değiştirir."""
    calls = {"receipts": [], "user": []}

    def fake_delete_receipts(ids):
        calls["receipts"].append(list(ids))
        return True

    def fake_delete_user(user_id):
        calls["user"].append(user_id)
        return True

    monkeypatch.setattr(vector_store, "delete_receipts", fake_delete_receipts)
    monkeypatch.setattr(vector_store, "delete_user_receipts", fake_delete_user)
    return calls


@pytest.fixture
def storage_dir(tmp_path, monkeypatch):
    path = tmp_path / "storage"
    path.mkdir()
    monkeypatch.setattr(settings, "STORAGE_DIR", str(path))
    return path


def auth(test_user):
    return {"Authorization": f"Bearer {test_user['token']}"}


async def user_id_of(client, test_user) -> uuid.UUID:
    res = await client.get("/api/v1/users/me", headers=auth(test_user))
    return uuid.UUID(res.json()["id"])


async def create_receipt(client, test_user, name="Market") -> uuid.UUID:
    res = await client.post(
        "/api/v1/receipts/",
        json={"merchant_name": name, "total_amount": 50},
        headers=auth(test_user),
    )
    assert res.status_code in (200, 201)
    return uuid.UUID(res.json()["id"])


# ---------------------------------------------------------------------------
# vector_store: Qdrant'a giden silme istekleri
# ---------------------------------------------------------------------------

def test_delete_receipts_sends_all_ids(monkeypatch):
    fake = FakeQdrant()
    monkeypatch.setattr(vector_store, "_get_client", lambda: fake)
    ids = [uuid.uuid4(), uuid.uuid4()]

    assert vector_store.delete_receipts(ids) is True
    assert fake.calls[0]["selector"].points == [str(i) for i in ids]


def test_delete_receipts_with_empty_list_does_nothing(monkeypatch):
    fake = FakeQdrant()
    monkeypatch.setattr(vector_store, "_get_client", lambda: fake)

    assert vector_store.delete_receipts([]) is True
    assert fake.calls == []


def test_delete_user_receipts_filters_by_user_id(monkeypatch):
    fake = FakeQdrant()
    monkeypatch.setattr(vector_store, "_get_client", lambda: fake)
    uid = uuid.uuid4()

    assert vector_store.delete_user_receipts(uid) is True
    condition = fake.calls[0]["selector"].filter.must[0]
    assert condition.key == "user_id"
    assert condition.match.value == str(uid)


def test_vector_deletes_return_false_without_client_or_on_error(monkeypatch):
    # İstemci yok (Qdrant yapılandırılmamış)
    assert vector_store.delete_receipts([uuid.uuid4()]) is False
    assert vector_store.delete_user_receipts(uuid.uuid4()) is False

    # İstemci var ama hata veriyor
    monkeypatch.setattr(vector_store, "_get_client", lambda: FakeQdrant(error=RuntimeError("bağlantı yok")))
    assert vector_store.delete_receipts([uuid.uuid4()]) is False
    assert vector_store.delete_user_receipts(uuid.uuid4()) is False


# ---------------------------------------------------------------------------
# storage.delete_user_dir
# ---------------------------------------------------------------------------

def test_delete_user_dir_removes_only_that_users_files(storage_dir):
    mine, other = uuid.uuid4(), uuid.uuid4()
    for uid in (mine, other):
        (storage_dir / str(uid)).mkdir()
        (storage_dir / str(uid) / "fis.jpg").write_bytes(b"x")

    assert storage.delete_user_dir(mine) is True
    assert not (storage_dir / str(mine)).exists()
    assert (storage_dir / str(other) / "fis.jpg").exists()


def test_delete_user_dir_is_ok_when_directory_does_not_exist(storage_dir):
    assert storage.delete_user_dir(uuid.uuid4()) is True


def test_delete_user_dir_refuses_paths_outside_storage(storage_dir):
    """'../' gibi bir değerle STORAGE_DIR dışındaki klasörler silinemez."""
    outside = storage_dir.parent / "dokunulmamali"
    outside.mkdir()
    (outside / "onemli.txt").write_text("silinmemeli")

    assert storage.delete_user_dir("../dokunulmamali") is False
    assert (outside / "onemli.txt").exists()
    assert storage.delete_user_dir("") is False  # STORAGE_DIR'in kendisi de silinemez
    assert storage_dir.exists()


# ---------------------------------------------------------------------------
# Tek fiş silme
# ---------------------------------------------------------------------------

async def test_deleting_a_receipt_removes_its_vector_and_linked_file(
    client, db_session, test_user, vector_calls, storage_dir
):
    uid = await user_id_of(client, test_user)
    receipt_id = await create_receipt(client, test_user)

    user_dir = storage_dir / str(uid)
    user_dir.mkdir()
    linked_file = user_dir / "bagli.jpg"
    other_file = user_dir / "baska-fis.jpg"
    linked_file.write_bytes(b"x")
    other_file.write_bytes(b"y")
    for path, receipt in ((linked_file, receipt_id), (other_file, None)):
        db_session.add(UploadedFile(
            user_id=uid, receipt_id=receipt, mime_type="image/jpeg", size_bytes=1,
            sha256=uuid.uuid4().hex + uuid.uuid4().hex[:32], storage_path=str(path),
        ))
    await db_session.commit()

    res = await client.delete(f"/api/v1/receipts/{receipt_id}", headers=auth(test_user))
    assert res.status_code == 204

    assert vector_calls["receipts"] == [[receipt_id]]
    assert not linked_file.exists()           # fişe bağlı dosya silindi
    assert other_file.exists()                # başka fişin / bağlantısız dosya dokunulmadı
    remaining = (await db_session.execute(select(UploadedFile))).scalars().all()
    assert [r.storage_path for r in remaining] == [str(other_file)]


async def test_deleting_all_receipts_removes_all_their_vectors(
    client, test_user, vector_calls, storage_dir
):
    ids = {await create_receipt(client, test_user, f"Market {i}") for i in range(3)}

    res = await client.delete("/api/v1/receipts/", headers=auth(test_user))
    assert res.status_code == 204

    assert len(vector_calls["receipts"]) == 1
    assert set(vector_calls["receipts"][0]) == ids


# ---------------------------------------------------------------------------
# Hesap silme
# ---------------------------------------------------------------------------

async def test_deleting_account_removes_vectors_files_and_avatar(
    client, db_session, test_user, vector_calls, storage_dir, tmp_path, monkeypatch
):
    uid = await user_id_of(client, test_user)

    user_dir = storage_dir / str(uid)
    user_dir.mkdir()
    (user_dir / "fis1.jpg").write_bytes(b"x")
    (user_dir / "fis2.png").write_bytes(b"y")

    avatars = tmp_path / "avatars"
    avatars.mkdir()
    (avatars / "profil.jpg").write_bytes(b"z")
    (avatars / "baska-kullanici.jpg").write_bytes(b"w")
    monkeypatch.setattr(users_endpoint, "AVATARS_DIR", str(avatars))
    await db_session.execute(
        update(User).where(User.id == uid).values(avatar_url="/avatars/profil.jpg")
    )
    await db_session.commit()

    res = await client.delete("/api/v1/users/me", headers=auth(test_user))
    assert res.status_code == 204

    assert vector_calls["user"] == [uid]
    assert not user_dir.exists()
    assert not (avatars / "profil.jpg").exists()
    assert (avatars / "baska-kullanici.jpg").exists()   # başkasının fotoğrafına dokunulmadı
    assert (await db_session.execute(select(User).where(User.id == uid))).scalars().first() is None


async def test_deleting_account_succeeds_even_if_cleanup_steps_fail(
    client, db_session, test_user, monkeypatch
):
    """Qdrant ya da disk hata verse bile kullanıcının hesabını silme hakkı engellenmemeli."""
    uid = await user_id_of(client, test_user)

    def boom(*args, **kwargs):
        raise RuntimeError("beklenmedik hata")

    monkeypatch.setattr(vector_store, "delete_user_receipts", boom)
    monkeypatch.setattr(storage, "delete_user_dir", boom)

    res = await client.delete("/api/v1/users/me", headers=auth(test_user))
    assert res.status_code == 204
    assert (await db_session.execute(select(User).where(User.id == uid))).scalars().first() is None


async def test_deleting_a_receipt_succeeds_even_if_vector_deletion_fails(
    client, test_user, monkeypatch
):
    def boom(ids):
        raise RuntimeError("qdrant çöktü")

    monkeypatch.setattr(vector_store, "delete_receipts", boom)
    receipt_id = await create_receipt(client, test_user)

    res = await client.delete(f"/api/v1/receipts/{receipt_id}", headers=auth(test_user))
    assert res.status_code == 204
