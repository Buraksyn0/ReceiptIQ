"""
model_trainer.py testleri.

_generate_synthetic_data saf bir fonksiyon, hızlı test edilir.
retrain_with_feedback gerçek bir ML eğitimi yapıyor ve normalde GERÇEK
model dosyasının üzerine yazar — bunu önlemek için MODEL_PATH'i geçici
bir dosyaya yönlendiriyoruz.
"""
import tempfile
from pathlib import Path
from unittest.mock import patch

from app.services.model_trainer import CATEGORIES, _generate_synthetic_data, retrain_with_feedback


def test_generate_synthetic_data_covers_all_categories():
    texts, labels = _generate_synthetic_data(samples_per_class=10)

    assert len(texts) == len(labels) == 10 * len(CATEGORIES)
    assert set(labels) == set(CATEGORIES)


def test_generate_synthetic_data_respects_samples_per_class():
    texts, labels = _generate_synthetic_data(samples_per_class=5)
    for cat in CATEGORIES:
        assert labels.count(cat) == 5


async def test_retrain_with_feedback_returns_valid_result(db_session):
    """
    Gerçek model dosyasının üzerine yazmamak için MODEL_PATH'i geçici bir
    dosyaya yönlendiriyoruz. Bu test gerçek bir ML eğitimi yaptığı için
    birkaç saniye sürebilir.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        fake_model_path = Path(tmp_dir) / "category_clf.pkl"
        with patch("app.services.model_trainer.MODEL_PATH", fake_model_path):
            result = await retrain_with_feedback(db_session)

        assert fake_model_path.exists()  # model gerçekten kaydedilmiş mi

    assert result["status"] == "ok"
    assert result["feedback_count"] == 0  # taze test veritabanı, hiç feedback yok
    assert result["total_samples"] > 0
