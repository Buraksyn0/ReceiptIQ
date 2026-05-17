"""
ReceiptIQ — Vektör Veritabanı Servisi (Qdrant)

Fişleri vektör olarak saklar ve semantik arama yapar.

Koleksiyon: "receipts"
Payload: receipt_id, user_id, merchant_name, category, amount, date, text
"""

from __future__ import annotations
import logging
import uuid
from functools import lru_cache
from typing import Optional

log = logging.getLogger(__name__)

COLLECTION_NAME = "receipts"
VECTOR_DIM = 1536


@lru_cache(maxsize=1)
def _get_client():
    """Qdrant client'ı bir kez oluştur, cache'le."""
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(host="localhost", port=6333)
        _ensure_collection(client)
        return client
    except Exception as e:
        log.error("Qdrant bağlantısı kurulamadı: %s", e)
        return None


def _ensure_collection(client) -> None:
    """Koleksiyon yoksa oluştur."""
    from qdrant_client.models import Distance, VectorParams

    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )
        log.info("Qdrant koleksiyonu oluşturuldu: %s", COLLECTION_NAME)


def index_receipt(
    receipt_id: uuid.UUID,
    user_id: uuid.UUID,
    text: str,
    metadata: dict,
) -> bool:
    """
    Bir fişi vektör veritabanına ekler/günceller.

    Args:
        receipt_id: Fişin UUID'si (Qdrant point ID olarak kullanılır)
        user_id: Kullanıcı UUID'si (filtreleme için payload'da saklanır)
        text: OCR metni + parse edilen alanlar (embedding için)
        metadata: merchant_name, category, amount, date vb.

    Returns:
        True (başarılı) | False (hata)
    """
    from app.services.embedder import embed_text
    from qdrant_client.models import PointStruct

    client = _get_client()
    if client is None:
        return False

    vector = embed_text(text)
    if vector is None:
        return False

    try:
        payload = {
            "user_id": str(user_id),
            "receipt_id": str(receipt_id),
            **metadata,
        }
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(
                    id=str(receipt_id),
                    vector=vector,
                    payload=payload,
                )
            ],
        )
        return True
    except Exception as e:
        log.error("Qdrant upsert hatası: %s", e)
        return False


def search_receipts(
    user_id: uuid.UUID,
    query_vector: list[float],
    limit: int = 5,
) -> list[dict]:
    """
    Kullanıcıya ait en alakalı fişleri semantik olarak arar.

    Args:
        user_id: Sadece bu kullanıcının fişlerinde ara
        query_vector: Sorgunun embedding vektörü
        limit: Kaç sonuç dönsün

    Returns:
        [{"receipt_id": ..., "merchant_name": ..., "score": ...}, ...]
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    client = _get_client()
    if client is None:
        return []

    try:
        user_filter = Filter(
            must=[
                FieldCondition(
                    key="user_id",
                    match=MatchValue(value=str(user_id)),
                )
            ]
        )

        # query_points (qdrant-client >= 1.7)
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=user_filter,
            limit=limit,
            with_payload=True,
        ).points

        log.info("Qdrant arama: user=%s, sonuç=%d", user_id, len(results))
        return [
            {**r.payload, "score": r.score}
            for r in results
        ]
    except Exception as e:
        log.error("Qdrant search hatası: %s", e)
        return []


def delete_receipt(receipt_id: uuid.UUID) -> bool:
    """Fişi vektör veritabanından sil."""
    from qdrant_client.models import PointIdsList

    client = _get_client()
    if client is None:
        return False

    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=PointIdsList(points=[str(receipt_id)]),
        )
        return True
    except Exception as e:
        log.error("Qdrant delete hatası: %s", e)
        return False
