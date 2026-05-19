import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.api.api import api_router
from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler

# Rate limiter — IP bazlı
limiter = Limiter(key_func=get_remote_address)

AVATARS_DIR = os.path.join(os.path.dirname(__file__), "../avatars")
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

# Rate limiter state'ini app'e bağla
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
