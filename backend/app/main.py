import os
import sys
import subprocess
from contextlib import asynccontextmanager
from fastapi import FastAPI

# Kritik paketlerin venv'de yüklü olduğundan emin ol
_REQUIRED = ["openai", "qdrant_client", "sendgrid"]
for _pkg in _REQUIRED:
    try:
        __import__(_pkg)
    except ImportError:
        print(f"[startup] '{_pkg}' bulunamadı, yükleniyor...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", _pkg, "-q"])
        print(f"[startup] '{_pkg}' yüklendi.")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.api import api_router
from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler

AVATARS_DIR = os.path.join(os.path.dirname(__file__), "../../avatars")
os.makedirs(AVATARS_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Başlangıç: scheduler'ı başlat
    start_scheduler()
    yield
    # Kapanış: scheduler'ı durdur
    stop_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS — Expo Go (tunnel) ve emulator için açık tutuyoruz
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Avatar fotoğraflarını statik olarak sun
app.mount("/avatars", StaticFiles(directory=AVATARS_DIR), name="avatars")


@app.get("/")
def root():
    return {"message": "Welcome to ReceiptIQ API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
