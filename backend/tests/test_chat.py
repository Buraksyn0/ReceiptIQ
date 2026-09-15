"""
generate_opening_insight fonksiyonu için testler.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.chat import generate_opening_insight


async def test_opening_insight_with_no_receipts_skips_openai(client, db_session, test_user):
    """
    Fiş sayısı 0 ise, OpenAI'ye hiç gidilmeden sabit bir onboarding
    mesajı dönmeli (mocking gerekmiyor — kod zaten OpenAI'ye gitmeden
    erken çıkıyor).
    """
    me_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )
    user_id = uuid.UUID(me_res.json()["id"])

    result = await generate_opening_insight(db=db_session, user_id=user_id)

    assert result == (
        "Henüz hiç fiş eklemedin. İlk fişini tarat, "
        "harcamalarını birlikte takip etmeye başlayalım! 📸"
    )


async def test_opening_insight_with_receipts_uses_mocked_openai(client, db_session, test_user):
    """
    Fiş varsa OpenAI'ye gidilmeli. Gerçek OpenAI'yi ARAMIYORUZ — onun
    yerine sahte (mock) bir cevap koyup, fonksiyonun bu sahte cevabı
    doğru şekilde geri döndürdüğünü doğruluyoruz.
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    me_res = await client.get("/api/v1/users/me", headers=auth_headers)
    user_id = uuid.UUID(me_res.json()["id"])

    # "0 fiş" dalına değil, OpenAI dalına girmesi için en az 1 fiş lazım
    await client.post(
        "/api/v1/receipts/",
        json={"merchant_name": "Migros", "total_amount": 100, "category": "market"},
        headers=auth_headers,
    )

    # Gerçek OpenAI'nin döndürdüğü nesnenin yapısını taklit ediyoruz:
    # response.choices[0].message.content
    fake_message = MagicMock()
    fake_message.content = "Test mesajı: market harcaman var!"
    fake_choice = MagicMock()
    fake_choice.message = fake_message
    fake_response = MagicMock()
    fake_response.choices = [fake_choice]

    with patch("openai.AsyncOpenAI") as mock_openai_class:
        # AsyncOpenAI(...) çağrıldığında gerçek bağlantı yerine sahte bir
        # "client" nesnesi dönsün
        mock_client = mock_openai_class.return_value
        # .create(...) kodumuzda "await" ile çağrılıyor, bu yüzden AsyncMock
        mock_client.chat.completions.create = AsyncMock(return_value=fake_response)

        result = await generate_opening_insight(db=db_session, user_id=user_id)

    assert result == "Test mesajı: market harcaman var!"
