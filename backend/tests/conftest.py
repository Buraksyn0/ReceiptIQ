"""
Test altyapısı (fixture'lar) — tüm test dosyaları bunları otomatik kullanabilir.

Neden ayrı bir test veritabanı?
  Gerçek geliştirme veritabanını (receiptiq) testler için kullanırsak, testler
  senin gerçek verini silebilir/bozabilir. Bunun yerine "receiptiq_test" adında
  ayrı bir veritabanına bağlanıyoruz, her testten önce şemayı sıfırlıyoruz.
"""
import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api import deps
from app.db.base import Base  # tüm modelleri Base.metadata'ya kaydeder
from app.main import app
from app.models.user import User

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/receiptiq_test"

# NullPool: her sorguda taze bağlantı aç/kapat — testler arasında (farklı
# event loop'lar arasında) bağlantı paylaşımından kaynaklanan çakışmaları önler.
test_engine = create_async_engine(TEST_DATABASE_URL, future=True, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(
    bind=test_engine, autocommit=False, autoflush=False, expire_on_commit=False
)


@pytest_asyncio.fixture(autouse=True)
async def reset_rate_limiter():
    """
    Rate limiter'ın sayacı, tüm testler boyunca (aynı Python süreci içinde)
    kalıcı — sıfırlamazsak, önceki testlerdeki istekler bu testi de
    etkileyip yanlışlıkla 429 döndürebilir. `autouse=True` sayesinde bu
    fixture HER testten önce otomatik çalışır, ayrıca istenmesine gerek yok.

    Not: main.py ve auth.py, her ikisi de kendi ayrı Limiter nesnesini
    oluşturuyor — hangisinin gerçekte kullanıldığından emin olmak için
    ikisini de sıfırlıyoruz.
    """
    from app.api.endpoints import auth as auth_endpoints

    app.state.limiter.reset()
    auth_endpoints.limiter.reset()
    yield


@pytest_asyncio.fixture(autouse=True)
async def sent_verification_emails(monkeypatch):
    """
    Doğrulama e-postası GERÇEKTEN gönderilmesin (yerel .env'de SendGrid anahtarı
    olabilir) — gönderilecek kodu bir listeye yazıyoruz; testler kodu buradan okur.
    Liste elemanları: (alıcı_e-posta, kod)
    """
    sent: list[tuple[str, str]] = []

    async def fake_send(to_email: str, code: str) -> bool:
        sent.append((to_email, code))
        return True

    monkeypatch.setattr("app.api.endpoints.auth.send_verification_code_email", fake_send)
    return sent


@pytest_asyncio.fixture(autouse=True)
async def sent_reset_emails(monkeypatch):
    """Şifre sıfırlama e-postası da gerçekten gönderilmesin; kodlar listeden okunur."""
    sent: list[tuple[str, str]] = []

    async def fake_send(to_email: str, code: str) -> bool:
        sent.append((to_email, code))
        return True

    monkeypatch.setattr("app.api.endpoints.auth.send_password_reset_email", fake_send)
    return sent


@pytest_asyncio.fixture
async def db_session():
    """Her testten önce şemayı temizden kurar, tek bir DB oturumu verir."""
    async with test_engine.begin() as conn:
        # Tabloları teker teker DROP etmek yerine tüm şemayı sıfırlıyoruz —
        # receipt/uploaded_files gibi birbirine dairesel bağımlı tablolarda
        # SQLAlchemy'nin drop_all'ı sıralama hatası veriyor, Postgres'in
        # kendi CASCADE mekanizması buna takılmıyor.
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """
    FastAPI uygulamasına gerçek bir sunucu başlatmadan istek atmamızı sağlayan
    test istemcisi. Uygulamanın gerçek veritabanı yerine bizim test oturumumuzu
    kullanmasını `dependency_overrides` ile sağlıyoruz.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[deps.get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def verify_email(db_session):
    """E-posta doğrulama adımını atlatır: kullanıcıyı doğrudan DB'de 'doğrulanmış' yapar."""
    async def _verify(email: str):
        await db_session.execute(
            update(User).where(User.email == email).values(email_verified=True)
        )
        await db_session.commit()
    return _verify


@pytest_asyncio.fixture
async def test_user(client, verify_email):
    """Kayıtlı ve giriş yapmış bir test kullanıcısı + token döner."""
    email = f"test_{uuid.uuid4().hex[:8]}@test.com"
    password = "testpass123"

    await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    await verify_email(email)
    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    token = login_res.json()["access_token"]

    return {"email": email, "password": password, "token": token}
