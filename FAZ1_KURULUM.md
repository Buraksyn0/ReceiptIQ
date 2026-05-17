# Faz 1 — OCR Pipeline Kurulum & Test

Faz 1 ile gelen yetenekler:
- Kameradan veya galeriden fiş yükleme
- SHA-256 hash ile yinelenen yükleme engeli + UUID ile güvenli depolama
- MIME magic byte doğrulama (JPEG/PNG/HEIC kabul)
- Asenkron OCR (FastAPI BackgroundTasks)
- OCR provider'ı seçilebilir: Tesseract (default) veya Google Vision
- Türkçe regex parser: tarih, tutar, KDV, satıcı adı
- Kullanıcının düzeltebileceği "Review" ekranı
- Onay sonrası gerçek `Receipt` kaydı (kaynak dosyaya bağlı)

---

## 1. macOS Sistem Kurulumu (tek seferlik)

### Tesseract (yerel OCR)

```bash
brew install tesseract tesseract-lang
tesseract --version          # 5.x görmelisin
tesseract --list-langs        # tur ve eng listede olmalı
```

Tesseract'a ihtiyacın yoksa (sadece Google Vision kullanacaksan) bunu atlayabilirsin —
ama .env'de `OCR_PROVIDER=tesseract` ise (default) sistemde olması şart.

### Google Vision (opsiyonel — prod default)

```bash
# 1. https://console.cloud.google.com → Yeni proje "receiptiq"
# 2. APIs & Services → Library → "Cloud Vision API" → Enable
# 3. APIs & Services → Credentials → Create Credentials → Service Account
# 4. Service Account → Keys → Add Key → JSON → indir, ~/keys/receiptiq-vision.json
# 5. .env'i güncelle:
#    OCR_PROVIDER=google_vision
#    GOOGLE_APPLICATION_CREDENTIALS=/Users/buraksayan/keys/receiptiq-vision.json
```

---

## 2. Backend — Python Bağımlılıkları

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

Yeni paketler: `Pillow`, `pytesseract`, `google-cloud-vision`, `aiofiles`.

### Migration

```bash
alembic upgrade head
```

`uploaded_files` tablosu ve `receipt.source_file_id` kolonu eklenecek.

### Backend'i çalıştır

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Yeni endpoint'leri `http://localhost:8000/docs` altında görmelisin:
- `POST /api/v1/receipts/upload/` (multipart)
- `GET /api/v1/receipts/upload/`
- `GET /api/v1/receipts/upload/{id}`
- `POST /api/v1/receipts/upload/{id}/confirm`
- `DELETE /api/v1/receipts/upload/{id}`

---

## 3. Frontend — Native Modüller

```bash
cd ..
npx expo install expo-camera expo-image-picker expo-image-manipulator
```

> Not: Yeni native modüller eklendi, **Expo Go yerine "expo-dev-client"** gerekebilir.
> Eğer kamera açılırken `Cannot find native module 'ExpoCamera'` gibi hata alırsan:
>
> ```bash
> npx expo prebuild         # ios/android klasörleri oluşturur
> npx expo run:ios          # ya da run:android
> ```
>
> Çoğunlukla **Expo Go SDK 54+ ile expo-camera çalışır**, önce dev client'sız dene.

### Çalıştır

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.X:8000 npx expo start --clear
```

(IP'ni `ipconfig getifaddr en0` ile alıp yaz.)

---

## 4. Test Senaryosu

### Hızlı duman testi (parser)

```bash
cd backend
source .venv/bin/activate
python -c "
from app.services.parser import parse_receipt
sample = '''MIGROS TICARET A.S.
TARIH: 25.04.2026 SAAT: 14:30
SUT 18.50
EKMEK 12.00
TOPLAM KDV %8: 11.20
GENEL TOPLAM: 156,15 TL'''
r = parse_receipt(sample)
print(r.to_dict())
"
```

Beklenen çıktı:
```
{'merchant_name': 'MIGROS TICARET A.S.', 'total_amount': '156.15',
 'receipt_date': '2026-04-25T00:00:00', 'vat_amount': '11.20', ...}
```

### Uçtan uca akış (telefonda)

1. Uygulamayı aç → giriş yap
2. Alt menüden **Scan** sekmesine git → kamera izni ver
3. Bir fiş çek (markette aldığın bir kasa fişi ideal). İyi ışık, düz çekim.
4. Foto çekildiğinde "Yükleniyor & taranıyor…" → otomatik olarak Review ekranına geç
5. Review ekranında:
   - "Fiş analiz ediliyor…" → spinner
   - Birkaç saniye sonra parsed alanlar dolacak: mağaza adı, tutar, tarih
   - OCR provider chip'i (tesseract / google_vision) ve güven skoru görünür
6. Hatalı yerleri düzelt, kategori seç, **Kaydet**
7. Dashboard'a dönünce yeni fişin listede görmen gerek

### Hata senaryoları

- **OCR çıktısı boş** → "Mağaza adı ve tutar gerekli" — tüm alanları manuel yaz, kaydet
- **OCR zaman aşımı (60 sn)** → backend'i durdurmuş olabilirsin, restart et
- **Aynı fişi tekrar yükle** → hash matchlenir, var olan upload kaydı döner (yeni dosya yazılmaz)

---

## 5. Sık Karşılaşılan Hatalar

**`TesseractNotFoundError`** → `brew install tesseract tesseract-lang` çalıştırmamışsın.

**`Cannot find native module 'ExpoCamera'`** → Expo Go yerine dev client gerekli:
```bash
npx expo prebuild
npx expo run:ios
```

**`HTTP 400: Desteklenmeyen dosya tipi`** → telefon HEIC çekti, ama frontend zaten
`expo-image-manipulator` ile JPEG'e çeviriyor. Eğer yine olursa, kameranın output
formatını telefon ayarından "Most Compatible" yap (iPhone: Settings → Camera → Formats).

**`HTTP 401`** → JWT süresi dolmuş, çıkış yapıp tekrar giriş yap.

**Backend "ModuleNotFoundError: google.cloud"** → `pip install -r requirements.txt`
çalıştırmadan önce eski venv'den çalışıyor olabilirsin. Tekrar `pip install -r requirements.txt`.

---

## 6. Kod Mimarisi (Sunum İçin)

```
backend/app/services/
├── ocr/
│   ├── base.py                    # OCRProvider abstract + OCRResult dataclass
│   ├── tesseract_provider.py      # Yerel implementasyon
│   ├── google_vision_provider.py  # Bulut implementasyon
│   └── __init__.py                # Factory: get_ocr_provider()
├── parser.py                      # TR fiş regex parser
├── storage.py                     # SHA-256 + magic byte + UUID disk yazma
└── upload_processor.py            # process_upload(upload_id) — async worker

backend/app/api/endpoints/uploads.py  # /receipts/upload route group
backend/app/models/uploaded_file.py    # UploadedFile tablosu
```

**Migrasyon hazırlığı:** `process_upload(upload_id)` standalone bir async fonksiyon.
Şu anda FastAPI BackgroundTasks ile çağrılıyor; ileride Celery/arq'a geçilirse
sadece `background_tasks.add_task(...)` satırı `await arq.enqueue(...)` olacak.
Diğer hiçbir şey değişmeyecek.

---

## 7. Faz 1.5 (Sıradaki — istersen)

Bu maddeleri Faz 1.5'te bitirebiliriz:
- PDF/DOCX upload (gereksinim 2.1.2)
- Receipt'lere swipe-to-delete (Faz 0'da PUT/DELETE backend hazır)
- Dashboard'da "kaynak dosya" rozetinin gösterimi
- ML Kategorilendirme (Faz 2): TF-IDF + LogReg `.pkl`


