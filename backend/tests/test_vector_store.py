"""
vector_store koleksiyon kurulumu testleri.

Yeni Qdrant sürümleri indekslenmemiş alana göre filtrelemeyi reddediyor; bu yüzden
koleksiyon kurulurken `user_id` payload indeksinin oluşturulduğunu doğruluyoruz.
Gerçek Qdrant'a gidilmiyor, sahte istemci kullanılıyor.
"""
from types import SimpleNamespace

from app.services import vector_store


class FakeClient:
    def __init__(self, existing=(), index_error=None):
        self._existing = list(existing)
        self.index_error = index_error
        self.created_collections = []
        self.indexes = []

    def get_collections(self):
        return SimpleNamespace(collections=[SimpleNamespace(name=n) for n in self._existing])

    def create_collection(self, collection_name, vectors_config):
        self.created_collections.append(collection_name)

    def create_payload_index(self, collection_name, field_name, field_schema):
        if self.index_error:
            raise self.index_error
        self.indexes.append((collection_name, field_name, str(field_schema)))


def test_new_collection_is_created_with_user_id_index():
    client = FakeClient(existing=[])
    vector_store._ensure_collection(client)

    assert client.created_collections == [vector_store.COLLECTION_NAME]
    assert len(client.indexes) == 1
    assert client.indexes[0][:2] == (vector_store.COLLECTION_NAME, "user_id")


def test_existing_collection_still_gets_the_index():
    """Koleksiyon daha önce (indekssiz) oluşmuş olsa bile indeks eklenmeli."""
    client = FakeClient(existing=[vector_store.COLLECTION_NAME])
    vector_store._ensure_collection(client)

    assert client.created_collections == []
    assert len(client.indexes) == 1


def test_index_failure_does_not_break_startup():
    """İndeks oluşturulamazsa uygulama açılışı bozulmamalı (yalnızca uyarı)."""
    client = FakeClient(existing=[vector_store.COLLECTION_NAME], index_error=RuntimeError("hata"))
    vector_store._ensure_collection(client)  # istisna fırlatmamalı
    assert client.indexes == []
