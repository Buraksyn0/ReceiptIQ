"""
Sohbet asistanı sistem istemi testleri.

Asistanlar kullanıcının KENDİ harcama verilerini analiz eder; yatırım/kredi/vergi/sigorta
konusunda kişiye özel tavsiye vermemelidir (Google Play "finansal özellik" beyanımızla
tutarlı kalmak için). Modelin gerçek davranışını burada sınamıyoruz (OpenAI'a gidilmez),
yalnızca sınır kuralının her asistan istemine eklendiğini ve temel kuralların
korunduğunu doğruluyoruz.
"""
import pytest

from app.services import chat

ASSISTANT_PROMPTS = {
    "genel": chat.SYSTEM_PROMPT,
    "tasarruf": chat.SAVINGS_SYSTEM_PROMPT,
    "finansal_skor": chat.FINANCIAL_SCORE_SYSTEM_PROMPT,
}


@pytest.mark.parametrize("name", ASSISTANT_PROMPTS)
def test_every_assistant_prompt_contains_the_finance_boundary(name):
    prompt = ASSISTANT_PROMPTS[name]
    assert chat.FINANCE_BOUNDARY in prompt


def test_boundary_names_the_restricted_topics():
    for topic in ("yatırım", "kripto", "kredi", "vergi", "sigorta"):
        assert topic in chat.FINANCE_BOUNDARY.lower()


def test_boundary_keeps_budget_and_savings_advice_allowed():
    """Sınır asistanı gereğinden fazla kısıtlamamalı: bütçe/tasarruf önerileri serbest kalmalı."""
    text = chat.FINANCE_BOUNDARY
    assert "aynen devam et" in text
    assert "bütçe" in text and "tasarruf" in text


@pytest.mark.parametrize("name", ASSISTANT_PROMPTS)
def test_core_rules_are_preserved(name):
    prompt = ASSISTANT_PROMPTS[name]
    assert "Her zaman Türkçe yanıt ver" in prompt
    assert "GERÇEK" in prompt  # gerçek verilere dayanma kuralı


def test_opening_insight_prompt_is_not_affected():
    """Sohbet açılışındaki tek cümlelik prompt sınır eklenmeden kalmalı."""
    assert chat.FINANCE_BOUNDARY not in chat.OPENING_INSIGHT_PROMPT
