# ReceiptIQ — Gereksinim ↔ Mevcut Kod Eşleşmesi

Tarih: 25.04.2026
Hazırlayan: Burak Sayan ile birlikte

Lejant: ✅ Var ve çalışıyor · 🟡 Kısmen var / iskelet hazır · ❌ Yok

---

## 2.1.1 Kullanıcı Yönetimi

| Gereksinim | Durum | Not |
|---|---|---|
| Email + şifre kayıt/giriş | ✅ | `/auth/signup`, `/auth/login` |
| Şifreler hash | ✅ | bcrypt |
| Profil: isim, **şehir**, email, **tema tercihi** | 🟡 | Sadece `full_name` + `email` var; `city` ve `theme` alanları yok |
| Profil güncelleme | ❌ | Endpoint yok, UI "Yakında" diyor |
| Hesap silme | ❌ | Endpoint yok, UI yok |
| Kullanıcı sadece kendi faturalarını görür | ✅ | `Receipt.user_id == current_user.id` filtresi var |

## 2.1.2 Fatura ve Fiş Yönetimi

| Gereksinim | Durum | Not |
|---|---|---|
| Kamera ile foto çekme | ❌ | `ScanScreen` sadece UI çerçevesi; `expo-camera` yüklü değil |
| Cihazdan PDF/DOCX yükleme | ❌ | `expo-document-picker` yüklü değil, endpoint yok |
| E-posta ile fatura aktarma | ❌ | Mailgun/Gmail API entegrasyonu yok |
| Dosyaların UUID ile saklanması | ❌ | Dosya storage hiç yok |
| SHA-256 hash duplikasyon kontrolü | ❌ | Yok |
| OCR ile metne çevirme | ❌ | Yok |
| Ürün/miktar/fiyat/tarih ayıklama | ❌ | Yok (sadece kullanıcı manuel giriyor) |
| Fatura listesi (tarih, satıcı, tutar) | ✅ | `TransactionsScreen` |
| Fatura **silme** / **düzenleme** | ❌ | PUT/DELETE endpoint yok |

## 2.1.3 OCR ve Veri Ayrıştırma

| Gereksinim | Durum |
|---|---|
| Görsel + PDF OCR (Tesseract) | ❌ |
| Regex temizliği | ❌ |
| ₺/TL ve TR tarih formatı tanıma | ❌ |
| OCR hata uyarısı | ❌ |

## 2.1.4 ML Kategorilendirme

| Gereksinim | Durum |
|---|---|
| TF-IDF + Logistic Regression | ❌ |
| `.pkl` model entegrasyonu | ❌ |
| Manuel kategori düzenleme | 🟡 | Yeni eklemede manuel seçim var, ama mevcut fişin kategorisi backend'den değiştirilemiyor (PUT yok) |
| Kullanıcı tercihinden öğrenme (online learning / feedback loop) | ❌ |

## 2.1.5 RAG + LLM Soru-Cevap

| Gereksinim | Durum |
|---|---|
| Doğal dilde soru | ❌ | Chat ekranı tamamen mock — hardcoded mesaj |
| Qdrant embedding store | ❌ |
| bge-m3 embedding | ❌ |
| LLM (Mistral/GPT) yanıt üretimi | ❌ |
| Kaynak gösterimi ("Kaynak: Fatura X, Satır Y") | ❌ |

## 2.1.6 Dashboard & Analiz

| Gereksinim | Durum | Not |
|---|---|---|
| Pasta grafik (kategori bazlı) | ✅ | `ReportsScreen` |
| **Zaman serisi grafik** | ❌ | Yok |
| Aylık harcama / kategori istatistikleri (backend) | ❌ | `/stats` endpoint'i yok; tüm hesap frontend'de yapılıyor |
| Toplam harcama kartı | ✅ | Dashboard |
| **Aylık değişim %** | ❌ |
| **En çok harcanan kategori** kartı | ❌ |
| Tarih aralığı seçimi | 🟡 | Transactions'ta hızlı filtre var (Son 7 gün/Bu ay/Geçen ay) ama özel tarih aralığı seçici yok |

## 2.1.7 Fiyat Tahmini & Anomali

| Gereksinim | Durum |
|---|---|
| LightGBM / Prophet ile fiyat tahmini | ❌ |
| Isolation Forest / IQR anomali tespiti | ❌ |
| Anormal harcama uyarısı | ❌ |

## 2.1.8 Bildirim & Uyarı

| Gereksinim | Durum |
|---|---|
| Sistem uyarıları gösterimi | 🟡 | UI var, içerik tamamen hardcoded |
| Bütçe aşımı uyarısı | ❌ | Mantık yok |
| Anomali uyarısı | ❌ |
| Yeni kategori önerisi | ❌ |
| Uygulama içi + e-posta bildirim | ❌ |

## 2.2 Donanımsal — Genelde otomatik karşılanır

| Gereksinim | Durum |
|---|---|
| Min Android 9 / iOS 14 | ✅ | Expo SDK 54 zaten daha yüksek minimum istiyor |
| Kamera izni | ❌ | `app.json`'da `expo-camera` plugin'i ve permission yok |

## 2.3 Yazılımsal Stack

| Bileşen | Durum |
|---|---|
| RN (Expo) | ✅ |
| FastAPI 3.11+ | ✅ |
| PostgreSQL | ✅ |
| **Qdrant** | ❌ |
| **Tesseract** | ❌ |
| **scikit-learn / LightGBM / Prophet** | ❌ |
| **SentenceTransformers (bge-m3)** | ❌ |
| **OpenAI/Mistral API** | ❌ |
| Git + GitHub | ✅ |
| Docker Compose | 🟡 | Sadece Postgres var; backend, qdrant, worker eksik |

## 2.4 Güvenlik

| Gereksinim | Durum |
|---|---|
| JWT auth | ✅ |
| bcrypt/Argon2 | ✅ | bcrypt |
| **MIME + magic byte kontrolü** | ❌ | Dosya yükleme bile yok |
| Per-user veri izolasyonu | ✅ |
| Yetkisiz erişim kapalı | ✅ | `Depends(get_current_user)` her korumalı endpoint'te |
| `SECRET_KEY` env'de | ❌ | `config.py`'da hardcoded |
| CORS middleware | ❌ |

## 2.5 Performans

| Gereksinim | Durum |
|---|---|
| 100 eşzamanlı kullanıcı | 🟡 | Async stack hazır ama load test yok |
| OCR/embedding asenkron | ❌ | Worker (Celery/RQ/arq) yok |
| Qdrant <1s | ❌ |
| Docker Compose ile yatay ölçek | ❌ |

## 2.6 UI

| Gereksinim | Durum | Not |
|---|---|---|
| Sade, mobil öncelik | ✅ |
| **Renk paleti: teal #008080 / yeşil #00A878** | ❌ | Mevcut palette mavi `#2979FF` — gereksinime aykırı |
| **Inter / SF Pro font** | ❌ | Custom font yüklü değil |
| Ekranlar: Giriş ✓ / Fatura Listesi ✓ / Fatura Ekle ✓ / Dashboard ✓ / **Yapay Zekâya Sor** 🟡 / Uyarılar 🟡 / Ayarlar ✓ | 🟡 |

## 2.7 Sistem Entegrasyonu

| Gereksinim | Durum |
|---|---|
| Mailgun/Gmail API (e-posta in) | ❌ |
| OpenAI/Mistral/HuggingFace endpoint | ❌ |

---

# ÖZET SKORU

- Kullanıcı yönetimi: **70%**
- Fatura yönetimi (manuel kısım): **40%**
- OCR / Veri ayrıştırma: **0%**
- ML kategorilendirme: **5%** (sadece manuel kategori UI)
- RAG + LLM Chat: **0%** (mock UI)
- Dashboard & Analiz: **45%**
- Fiyat tahmini & Anomali: **0%**
- Bildirim sistemi: **5%** (mock UI)
- Güvenlik: **75%**
- UI uyumu: **60%** (renk paleti ve font hariç)

**Genel: ~%28**

---

# YOL HARİTASI (Önerilen Sıra)

## FAZ 0 — Temizlik & Altyapı (1-2 gün)
- [ ] `.env` + `pydantic-settings` ile `SECRET_KEY` çıkar
- [ ] CORS middleware ekle
- [ ] Frontend için `config.js` (LAN IP veya tunnel ile baseURL)
- [ ] Settings'teki logout'u `AuthContext.logout()` ile bağla
- [ ] Renk paletini gereksinime uyarla (teal/yeşil)
- [ ] Inter/SF Pro font'u Expo'ya ekle
- [ ] Receipt PUT/DELETE + Budget PUT/DELETE endpoint'leri
- [ ] User PATCH (profil güncelle) + DELETE (hesap sil) + `city`, `theme_preference` kolonları
- [ ] Alembic migration

## FAZ 1 — OCR Pipeline (3-5 gün)
- [ ] `expo-camera` + `expo-document-picker` yükle, kamera izni
- [ ] `POST /receipts/upload` — multipart file (image/pdf/docx)
- [ ] MIME tipi + magic byte (`python-magic`) kontrolü
- [ ] SHA-256 hash + duplicate guard tablosu (`uploaded_files`)
- [ ] UUID isimli dosyayı `/storage/{user_id}/{uuid}.ext`'e kaydet
- [ ] Tesseract (`pytesseract` + `Pillow` + `pdf2image`)
- [ ] DOCX için `python-docx`
- [ ] Türkçe regex parser: tarih (`dd.MM.yyyy`, `dd/MM/yyyy`), tutar (`\d+[.,]\d{2}\s*(₺|TL)?`), KDV satırı, satıcı (genelde ilk satır)
- [ ] OCR sonucu `text_content`'e ham metin, `merchant_name` + `total_amount` + `receipt_date` parsed olarak yazılır
- [ ] `arq` veya `Celery + Redis` ile async worker
- [ ] OCR güvenilirlik düşükse frontend'e flag dön

## FAZ 2 — ML Kategorilendirme (2-3 gün)
- [ ] Küçük TR fiş corpus'u topla (~500-1000 örnek; kendi fişlerinden + sentetik)
- [ ] Notebook: TF-IDF (1-2 gram) + Logistic Regression
- [ ] `joblib.dump(pipeline, "category_clf.pkl")`
- [ ] Backend `app/ml/classifier.py` lazy load
- [ ] OCR sonrası otomatik kategori öner
- [ ] Kullanıcı düzeltirse `category_feedback` tablosuna kaydet
- [ ] Haftalık cron: feedback üzerinde `partial_fit` veya retrain

## FAZ 3 — RAG + LLM Chat (4-6 gün)
- [ ] `docker-compose.yml`'a Qdrant ekle
- [ ] `sentence-transformers` ile `BAAI/bge-m3` indir
- [ ] Her yeni fişte: özet metin (`"{date} {merchant} ₺{amount} - {category} - {items}"`) → embedding → Qdrant upsert (payload: receipt_id, user_id, date, category)
- [ ] `POST /chat/ask` endpoint:
  - kullanıcı sorusunu embed et
  - Qdrant'tan `user_id` filtreli top-k retrieve
  - bağlamı LLM'e (Mistral API veya OpenAI) sistem prompt'uyla yolla
  - dönen yanıtla birlikte `sources: [{receipt_id, snippet}]` göster
- [ ] Frontend `ChatScreen` — gerçek mesaj geçmişi, streaming response (opsiyonel), kaynak chip'leri
- [ ] Chat geçmişi `chat_messages` tablosu

## FAZ 4 — Anomali & Fiyat Tahmini (2-3 gün)
- [ ] **Anomali (önce IQR — basit ve hızlı kazanç):**
  - kategori bazında IQR hesabı
  - yeni fiş Q3 + 1.5*IQR'ı aşıyorsa → `Alert` kaydı oluştur
  - opsiyonel: scikit-learn `IsolationForest` user başına aylık fit
- [ ] **Fiyat tahmini:** LightGBM ile (kategori, ay, gün) → tutar regresyonu; az veri varsa Prophet aylık seri
- [ ] `GET /insights` endpoint: anomaliler + tahmin

## FAZ 5 — Dashboard Genişletmesi (1-2 gün)
- [ ] `GET /stats?range=...` — aylık toplam, kategori dağılımı, MoM değişim %, en çok harcanan kategori
- [ ] Time-series line chart (`react-native-gifted-charts` zaten kurulu, `LineChart` var)
- [ ] Tarih aralığı seçici (`@react-native-community/datetimepicker` zaten kurulu)
- [ ] Bütçe ekranındaki hardcoded ₺12,450 / ₺20,000 → gerçek toplam

## FAZ 6 — Bildirim Sistemi (1-2 gün)
- [ ] `Alert` modeli (user_id, type, title, body, read, created_at)
- [ ] Bütçe aşımında trigger (POST receipt sonrası check)
- [ ] Anomali tespitinde trigger
- [ ] `GET /alerts` + `PATCH /alerts/{id}/read`
- [ ] Frontend `AlertsScreen` — gerçek API'ye bağlan
- [ ] `expo-notifications` ile local push (in-app)
- [ ] Email için Mailgun (opsiyonel ama bonus)

## FAZ 7 — E-posta İçeri Aktarma (Opsiyonel, 1-2 gün)
- [ ] Mailgun inbound route veya Gmail API ile webhook
- [ ] `POST /receipts/email-webhook` — gelen attachment'ı OCR pipeline'a sok

## FAZ 8 — Bitirme Sunumu Hazırlığı (2-3 gün)
- [ ] README (kurulum + ekran görüntüleri + mimari diyagramı)
- [ ] Mimari diyagram (mermaid)
- [ ] API docs (FastAPI'nin OpenAPI'si zaten otomatik)
- [ ] Pytest ile en kritik 5-10 endpoint testi
- [ ] Demo veri seti
- [ ] Sunum slaytları (.pptx)

---

# TAHMİNİ TOPLAM SÜRE
**~3-4 hafta** yoğun çalışırsan tüm fazlar.
"Sunulabilir minimum" için Faz 0+1+2+3+5+6 yeterli (~2-2.5 hafta).
