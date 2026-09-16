"""
Chat uç noktaları testleri (/chat/, /chat/financial-score, /chat/savings)
— OpenAI mock'lanıyor, gerçek API'ye hiç gidilmiyor.
"""
from unittest.mock import AsyncMock, MagicMock, patch


def _fake_openai_response(text):
    fake_message = MagicMock()
    fake_message.content = text
    fake_choice = MagicMock()
    fake_choice.message = fake_message
    fake_response = MagicMock()
    fake_response.choices = [fake_choice]
    return fake_response


async def test_chat_endpoint_returns_mocked_openai_answer(client, test_user):
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    with patch("openai.AsyncOpenAI") as mock_openai_class:
        mock_client = mock_openai_class.return_value
        mock_client.chat.completions.create = AsyncMock(
            return_value=_fake_openai_response("Bu ay hiç harcaman yok görünüyor.")
        )

        res = await client.post(
            "/api/v1/chat/",
            json={"question": "Bu ay ne kadar harcadım?"},
            headers=auth_headers,
        )

    assert res.status_code == 200
    assert res.json()["answer"] == "Bu ay hiç harcaman yok görünüyor."


async def test_chat_endpoint_rejects_empty_question(client, test_user):
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    res = await client.post(
        "/api/v1/chat/",
        json={"question": "   "},
        headers=auth_headers,
    )

    assert res.status_code == 400


async def test_financial_score_chat_endpoint_returns_mocked_answer(client, test_user):
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    with patch("openai.AsyncOpenAI") as mock_openai_class:
        mock_client = mock_openai_class.return_value
        mock_client.chat.completions.create = AsyncMock(
            return_value=_fake_openai_response("Finansal skorun şu an hesaplanamıyor.")
        )

        res = await client.post(
            "/api/v1/chat/financial-score",
            json={"question": "Skorum nasıl?"},
            headers=auth_headers,
        )

    assert res.status_code == 200
    assert res.json()["answer"] == "Finansal skorun şu an hesaplanamıyor."


async def test_savings_chat_endpoint_returns_mocked_answer(client, test_user):
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    with patch("openai.AsyncOpenAI") as mock_openai_class:
        mock_client = mock_openai_class.return_value
        mock_client.chat.completions.create = AsyncMock(
            return_value=_fake_openai_response("Henüz aktif bir tasarruf hedefin yok.")
        )

        res = await client.post(
            "/api/v1/chat/savings",
            json={"question": "Hedefime ne zaman ulaşırım?"},
            headers=auth_headers,
        )

    assert res.status_code == 200
    assert res.json()["answer"] == "Henüz aktif bir tasarruf hedefin yok."
