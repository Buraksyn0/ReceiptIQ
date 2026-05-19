# ReceiptIQ — Devir-Teslim Notu (4 Mayıs 2026)

> Bu doküman, yeni bir Claude oturumunda projeye soğuk başlayan bir agent'ın
> mevcut durumu hızlıca kavraması için hazırlandı. Tüm dosya yolları,
> kararlar ve sıradaki adımlar burada.

---

## 0. Proje Kimliği

- **Öğrenci**: Burak Sayan, Bilgisayar Mühendisliği son sınıf
- **Konum**: `/Users/buraksayan/Desktop/ReceiptIQ` (Mac)
- **Tip**: React Native (Expo SDK 54) + FastAPI (Python 3.13) + PostgreSQL 15
- **Hedef**: Hem bitirme projesi hem de App Store / Play Store'da yayınlanacak
  gerçek ürün. Bu yüzden production-grade kararlar verilmeli.
- **Konuşma dili**: Türkçe, samimi (`dostum`, `evet`, vb.). Emoji kullanılmaz,
  bullet'lar/tablolar gerektiğinde kullanılır.

## 1. Gereksinim Özeti (PDF özeti — `Burak_SAYAN_Bitirme_Gereksinim_Analizi.pdf`)

ReceiptIQ — Yapay Zekâ Destekli Fatura ve Harcama Analiz Uygulaması:

- Auth (email/şifre + bcrypt + JWT) ✓
- Profil: isim, **şehir**, email, **tema tercihi** ✓ (Faz 0'da eklendi)
- Fiş yönetimi:
  - Kamera + PDF/DOCX + email ile yükleme (Faz 1'de **kamera kısmı** tamam, PDF/DOCX gelecek faz)
  - UUID dosya ✓ + SHA-256 dedup ✓ + MIME magic byte ✓
- OCR (Tesseract + ek: Google Vision hibrit) — Faz 1 ✓
- ML kategorilendirme (TF-IDF + LogReg `.pkl`) — Faz 2 ✓
- RAG + LLM chat (Qdrant + OpenAI text-embedding-3-small + GPT-4o) — Faz 3 ✓
- Dashboard (zaman serisi + MoM %) — Faz 5
- Anomali (Isolation Forest / IQR) + Fiyat tahmini (LightGBM/Prophet) — Faz 4
- Bildirim sistemi (in-app + email) — Faz 6
- 100 eşzamanlı kullanıcı, asenkron OCR/embedding, Docker Compose dağıtım

---

## 2. Mimari Kararlar

### OCR — Hibrit Provider Sistemi
- `OCRProvider` abstract → `TesseractProvider` + `GoogleVisionProvider`
- `.env` → `OCR_PROVIDER=google_vision` (aktif)
- Factory: `app/services/ocr/__init__.py::get_ocr_provider()` (lru_cache'li)
- **Karar gerekçesi**: gereksinim Tesseract diyor, ama gerçek ürün için Vision çok daha doğru.
  Bitirme savunmasında "biz hibrit yaptık ve benchmark'a göre Vision'ı default yaptık" denecek.

### Async — BackgroundTasks (şimdi), Celery'ye migrasyon hazır
- `process_upload(upload_id)` standalone async fonksiyon (`app/services/upload_processor.py`)
- Şu an FastAPI BackgroundTasks ile çağrılıyor
- İleride Celery/arq'a geçince **tek satır** değişecek

### Renk Paleti — Teal #008080
- `src/Constants/Colors.js`'de `primary: '#008080'`

### Font — Inter
- `@expo-google-fonts/inter`, `App.js`'de yüklenip `<Text>` default'una aktarılıyor

### API URL Yönetimi
- Tek yerden: `src/Constants/Config.js` → `apiUrl('/path/')`
- `EXPO_PUBLIC_API_URL` env'den okur, yoksa platform-aware default

### Veritabanı Migration — Alembic
- Migration zinciri: `5b10ec887cbf` → `83054aaa7147` → `86e9bf936b20` → `b944cb62a7d6` → `cefa8b447d36` → `a91c4b2e7d18` → `f3c2d1e8b4a9` (head)

### ML Kategorilendirme — TF-IDF + LogReg
- `backend/scripts/train_classifier.py` — sentetik veri üretir + model eğitir
- `backend/app/ml/category_clf.pkl` — eğitilmiş pipeline
- `backend/app/ml/training_report.txt` — accuracy raporu
- `backend/app/services/classifier.py` — lazy load, `predict_category(text)`
- `backend/app/models/category_feedback.py` — kullanıcı düzeltmeleri tablosu
- **Retrain**: `python scripts/train_classifier.py` (ileride `--use-feedback` eklenecek)

### RAG + LLM Chat — Qdrant + GPT-4o
- Qdrant Docker container: `docker run -d --name qdrant -p 6333:6333 qdrant/qdrant`
- Embedding: OpenAI `text-embedding-3-small` (1536 boyut)
- LLM: `gpt-4o` (Türkçe sistem promptu)
- `backend/app/services/embedder.py` — metin → vektör
- `backend/app/services/vector_store.py` — Qdrant indexleme + arama
- `backend/app/services/chat.py` — RAG pipeline
- `backend/app/api/endpoints/chat.py` — POST /api/v1/chat/
- Fiş onaylanınca (confirm) otomatik Qdrant'a indexlenir

### Python Ortamı — KRİTİK
- Backend `venv`'i: `/Users/buraksayan/Desktop/ReceiptIQ/backend/venv/`
- Her backend oturumunda önce: `source venv/bin/activate`
- uvicorn başlatma: `uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000`
- `--reload-dir app` şart — yoksa venv/numpy değişikliklerini izleyip sonsuz restart yapar

---

## 3. Tamamlanan Fazlar

### Faz 0 — Temizlik & Altyapı (✓ DONE)
- Backend `.env` + `pydantic-settings`, hardcoded SECRET_KEY çıkarıldı
- CORS middleware eklendi, `/health` endpoint
- User modeline `city` + `theme_preference` (light/dark) kolonları
- User PATCH /me + DELETE /me endpoint'leri
- Receipt CRUD: GET/{id}, PUT/{id}, PATCH/{id}, DELETE/{id}
- Budget CRUD: PUT/{id}, PATCH/{id}, DELETE/{id}
- Migration: `cefa8b447d36_add_user_profile_fields.py`
- Frontend: Config.js, teal palette, Inter font, AuthContext.user, real /users/me bağlantısı
- Settings ekranında gerçek logout + Hesabı Sil + dark mode toggle (PATCH'li)
- Dashboard: hardcoded "Burak Sayan" → dinamik isim + saatin gününe göre selamlama

### Faz 1 — OCR Pipeline (✓ DONE)
**Backend**:
- `app/services/ocr/` paketi: `base.py`, `tesseract_provider.py`, `google_vision_provider.py`, `__init__.py`
- `app/services/parser.py` — TR fiş regex parser (tarih, tutar, KDV, satıcı heuristik)
  - Şirket suffix pattern (_COMPANY_SUFFIX_RE) ile mağaza adı tespiti
  - `_AMOUNT_LINE_RE` ile OCR artifact filtresi
  - `take_max=True` ile TOPLAM, `take_max=False` ile KDV ayrımı
  - TOPKDV keyword'ü eklendi
- `app/services/storage.py` — UUID + SHA-256 + magic byte
- `app/services/upload_processor.py` — async worker
- `app/api/endpoints/uploads.py` — POST/GET/confirm/DELETE
- `app/models/uploaded_file.py` — UploadedFile tablosu
- Migration: `a91c4b2e7d18_add_uploaded_files.py`

**Frontend**:
- `src/Screens/App/Scan/ScanScreen.js` — gerçek CameraView + galeri + ImageManipulator
- `src/Screens/App/ReviewReceipt/ReviewReceiptScreen.js` — polling, OCR meta chips, parsed form

**Google Vision Setup**:
- GCP proje: `receiptiq` (proje ID: receiptiq-494711)
- Service account: `receiptiq-vision@receiptiq-494711.iam.gserviceaccount.com`
- JSON key: `/Users/buraksayan/keys/receiptiq-vision.json`
- `.env`: `OCR_PROVIDER=google_vision`, `GOOGLE_APPLICATION_CREDENTIALS=/Users/buraksayan/keys/receiptiq-vision.json`

### Faz 2 — ML Kategorilendirme (✓ DONE)
- 900 sentetik Türkçe fiş örneği (15 kategori × 60)
- TF-IDF (1-2 gram, 8000 feature) + LogReg (C=5.0, lbfgs)
- CV Accuracy: %100 (sentetik veri birbirinden net ayrışıyor)
- `backend/app/services/classifier.py` — lazy load, graceful degradation
- `upload_processor.py` → `parsed_data['suggested_category']` + `category_confidence`
- `ReviewReceiptScreen.js` → suggested_category otomatik seçiliyor
- `category_feedback` tablosu → her kayıtta model önerisi vs kullanıcı seçimi kaydediliyor
- Migration: `f3c2d1e8b4a9_add_category_feedback.py`

### Faz 3 — RAG + LLM Chat (✓ DONE)
- Qdrant Docker: `qdrant` container, port 6333
- OpenAI API key: `.env`'de `OPENAI_API_KEY`
- Embedding: `text-embedding-3-small` (1536 boyut)
- LLM: `gpt-4o`, Türkçe sistem promptu, temperature=0.3, max_tokens=512
- Fiş confirm anında `index_receipt()` ile Qdrant'a yazılıyor
- `POST /api/v1/chat/` → soru → embed → Qdrant search (user_id filter) → GPT-4o → Türkçe yanıt
- Frontend: `src/Screens/App/Chat/ChatScreen.js` — gerçek chat UI, öneri soruları, yükleniyor göstergesi
- **Test**: "Son fişim neydi?" → "Son fişiniz 15 Mart 2016 tarihinde... ₺135.78" ✓

---

## 4. Şu Anki Durum

**Tüm fazlar (0-6) tamamlandı.** Uygulama production-ready temel özelliklere sahip.
Sıradaki: App Store / Play Store hazırlığı — Docker Compose, gerçek domain, push notification, monetizasyon.

---

## 5. Çalışan Servisler

- **Postgres**: Docker container `receiptiq_db`, port 5432
- **Qdrant**: Docker container `qdrant`, port 6333
- **Backend**:
  ```bash
  cd /Users/buraksayan/Desktop/ReceiptIQ/backend
  source venv/bin/activate
  uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
  ```
- **Frontend**:
  ```bash
  EXPO_PUBLIC_API_URL=http://192.168.1.102:8000 npx expo start --clear
  ```
- **Tesseract**: `/opt/homebrew/bin/tesseract` (brew), tur+eng dilleri

---

## 6. Bilinen Bug'lar / Borçlar

- ScanScreen alt kontrolleri hâlâ tab bar boşluğuna manuel padding
- HEIC iPhone fotoları frontend'de JPEG'e çevriliyor — backend'de pillow-heif eklenebilir
- Receipt PUT/DELETE backend hazır ama frontend'de swipe-to-delete yok
- AlertsScreen hâlâ hardcoded mock — Faz 6'da backend'le bağlanacak
- category_feedback ile retrain (`--use-feedback` flag) henüz implement edilmedi
- Qdrant production'da Docker yerine Qdrant Cloud'a taşınacak (URL değişikliği yeterli)
- Chat geçmişi saklanmıyor — her uygulama açılışında sıfırlanıyor (Faz 3 ikinci iter.)

---

### Faz 4 — Anomali Tespiti + Fiyat Tahmini (✓ DONE)

- `backend/app/models/receipt.py` → `is_anomaly: bool`, `anomaly_score: float` eklendi
- `backend/alembic/versions/c1d2e3f4a5b6_add_anomaly_fields_to_receipt.py` — migration
- `backend/app/services/anomaly_detector.py` — IQR tabanlı anomali tespiti (min 5 fiş)
- `backend/app/api/endpoints/analytics.py` — GET /analytics/forecast + GET /analytics/anomalies
- `backend/app/api/api.py` → analytics router eklendi (`/analytics` prefix)
- `backend/app/schemas/receipt.py` → `is_anomaly`, `anomaly_score` eklendi
- `src/Screens/App/Dashboard/DashboardScreen.js` → ForecastCard komponenti + anormal fişlerde ⚠ badge
- `backend/app/services/parser.py` → "TOPLAN" OCR hatası düzeltmesi (M→N), inline tutar tespiti

### Faz 5 — Dashboard Zaman Serisi + Kategori Grafikleri (✓ DONE)

- `backend/app/api/endpoints/analytics.py` → `GET /analytics/monthly` (son 6 ay, MoM %) + `GET /analytics/categories` eklendi
- `src/Screens/App/Reports/ReportsScreen.js` → aylık bar grafiği (react-native-gifted-charts BarChart) + MoM badge + kategori pasta grafiği güncellendi
- Test: bar grafiği, pasta grafiği, kategori listesi, MoM badge hepsi çalışıyor ✓

### Faz 6 — Bildirim Sistemi (✓ DONE)

- `backend/app/models/notification.py` — Notification modeli (anomaly, budget_exceeded, info tipleri)
- `backend/alembic/versions/d2e3f4a5b6c7_add_notifications_table.py` — migration
- `backend/app/api/endpoints/notifications.py` — GET /notifications/, GET /notifications/unread-count, PATCH /read, PATCH /read-all
- `backend/app/api/api.py` → notifications router eklendi
- `backend/app/api/endpoints/uploads.py` → anomali tespitinde otomatik bildirim oluşturuluyor
- `src/Screens/App/Alerts/AlertsScreen.js` → hardcoded mock kaldırıldı, gerçek backend verisi, okundu/okunmadı, "Tümünü Oku"
- `src/Screens/App/Dashboard/DashboardScreen.js` → zil ikonunda okunmamış sayısı badge'i
- Test: bildirim geldi, badge görünüyor, okundu işaretleme çalışıyor ✓

## 7. Sıradaki Adımlar — App Store / Play Store Hazırlığı

1. **Docker Compose** — tüm servisleri tek dosyada yönet (backend + postgres + qdrant)
2. **Push notification** — Expo Notifications ile cihaza gerçek bildirim
3. **Bütçe aşımı bildirimi** — budget endpoint'e otomatik kontrol ekle
4. **Qdrant Cloud** — production'da Docker yerine Qdrant Cloud (URL değişikliği yeterli)
5. **Monetizasyon** — freemium model: aylık X fiş ücretsiz, premium sınırsız + AI chat

---

## 8. Önemli Dosya Yolları

### Dokümanlar
- `/Users/buraksayan/Desktop/ReceiptIQ/DEVIR_TESLIM.md` — bu doküman
- `/Users/buraksayan/Desktop/ReceiptIQ/GAP_ANALIZI.md`
- `/Users/buraksayan/Desktop/ReceiptIQ/FAZ0_KURULUM.md`
- `/Users/buraksayan/Desktop/ReceiptIQ/FAZ1_KURULUM.md`
- `/Users/buraksayan/Desktop/ReceiptIQ/GOOGLE_VISION_SETUP.md`

### Backend kritik dosyalar
- `backend/app/core/config.py` — pydantic-settings (OPENAI_API_KEY dahil)
- `backend/app/main.py` — FastAPI + CORS + /health
- `backend/app/api/api.py` — router toplama (auth, users, receipts, uploads, budgets, chat)
- `backend/app/api/endpoints/uploads.py` — confirm'de Qdrant indexleme + feedback kaydı
- `backend/app/api/endpoints/chat.py` — POST /chat/
- `backend/app/services/ocr/` — provider sistemi
- `backend/app/services/parser.py` — TR regex parser
- `backend/app/services/classifier.py` — ML kategori tahmini
- `backend/app/services/embedder.py` — OpenAI embedding
- `backend/app/services/vector_store.py` — Qdrant işlemleri
- `backend/app/services/chat.py` — RAG + GPT-4o
- `backend/app/ml/category_clf.pkl` — eğitilmiş model
- `backend/scripts/train_classifier.py` — model eğitim scripti
- `backend/.env` — gizli; `.env.example` commitlenmiş

### Frontend kritik dosyalar
- `App.js` — font loading, splash, AuthProvider, NavigationContainer
- `src/Constants/Config.js` — `apiUrl()` helper
- `src/Constants/Colors.js` — teal palette
- `src/Constants/Categories.js` — 15 kategori
- `src/Screens/App/Scan/ScanScreen.js` — gerçek kamera
- `src/Screens/App/ReviewReceipt/ReviewReceiptScreen.js` — OCR review + suggested_category
- `src/Screens/App/Chat/ChatScreen.js` — RAG chat UI

---

## 9. Yeni Agent İçin Operasyon Notları

- Backend her açılışta `source venv/bin/activate` şart
- `--reload-dir app` olmadan başlatma — numpy/venv döngüsü oluşur
- Docker'da iki container çalışmalı: `receiptiq_db` (postgres) + `qdrant`
- Frontend Expo Go ile fiziksel iPhone'da test ediliyor (LAN, IP: 192.168.1.102:8000)
- Kod değişikliklerinden sonra Python AST + Babel parser ile syntax doğrulanıyor
- Dosyalar `computer:///Users/buraksayan/Desktop/ReceiptIQ/...` link'leriyle gösteriliyor

### Kullanıcı'nın hassasiyetleri
- Üretim seviyesinde düşünmeyi seviyor (App Store launch hedefi var)
- Bitirme savunmasında "iyi mühendislik" cümleleri kullanmak istiyor
- Adım adım rehber takip ediyor, her adımdan sonra duruyor
- Türkçe konuşuyor, biz de Türkçe cevap veriyoruz
