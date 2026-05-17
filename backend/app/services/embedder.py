"""
ReceiptIQ — Metin Vektörleştirici (Embedder)

OpenAI text-embedding-3-small modelini kullanarak metni vektöre çevirir.
1536 boyutlu vektör üretir.

Maliyet: $0.02 / 1M token → bir fiş metni ~100 token → 10.000 fiş = $0.20
"""

from __future__ import annotations
import logging
from typing import Optional

log = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

_client = None
_client_initialized = False


def _get_client():
    """OpenAI client'ı lazım olunca oluştur (tek seferlik, hata durumunda tekrar dene)."""
    global _client, _client_initialized
    if _client is not None:
        return _client
    try:
        from openai import OpenAI
        from app.core.config import settings
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
        log.info("OpenAI client başarıyla oluşturuldu.")
        return _client
    except Exception as e:
        log.error("OpenAI client oluşturulamadı: %s", e)
        return None


def embed_text(text: str) -> Optional[list[float]]:
    """
    Metni vektöre çevirir.

    Returns:
        1536 boyutlu float listesi | None (hata durumunda)
    """
    if not text or not text.strip():
        return None

    client = _get_client()
    if client is None:
        return None

    try:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text[:8000],  # max token güvenliği
        )
        return response.data[0].embedding
    except Exception as e:
        log.error("Embedding hatası: %s", e)
        return None
