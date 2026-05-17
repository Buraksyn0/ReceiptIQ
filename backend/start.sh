#!/bin/bash
# ReceiptIQ Backend Başlatıcı
# Eksik paketleri yükler, sonra uvicorn başlatır.

cd "$(dirname "$0")"

VENV_PIP="../.venv/bin/pip"
VENV_UVICORN="../.venv/bin/uvicorn"

echo "📦 Paketler kontrol ediliyor..."
$VENV_PIP install -r requirements.txt -q

echo "🚀 Backend başlatılıyor..."
$VENV_UVICORN app.main:app --reload --host 0.0.0.0 --port 8000
