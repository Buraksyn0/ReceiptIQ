# Google Cloud Vision Setup — Adım Adım

Hedef: ReceiptIQ'nun OCR'ını Tesseract'tan Google Cloud Vision API'ye geçirmek.
Süre: ~10-15 dakika.
Maliyet: ayda ilk 1000 istek **bedava**, ayrıca yeni hesaba **$300 ücretsiz kredi**.

---

## Adım 1 — GCP Hesabı Aç

1. Tarayıcıdan https://console.cloud.google.com aç
2. Google hesabınla giriş yap (Gmail varsa kullan)
3. İlk girişte **Country: Turkey**, kullanım koşullarını kabul et

---

## Adım 2 — Faturalama Hesabı (Billing)

⚠️ Vision API'yi kullanabilmek için billing zorunlu — ama korkma, **ilk 1000 istek/ay tamamen ücretsiz** + Google sana hediye olarak **$300 kredi** veriyor.

1. Soldaki menüden **Billing** → **Add billing account**
2. Bir kredi/banka kartı bağla (Google ön onay için ~$1 çekip iade eder)
3. Hesap aktive olunca **My Billing Account** olarak görünür

> İpucu: Bittiğinde billing alarm kur — Billing → Budgets → Create Budget → "ayda $5'i aşarsa email at" gibi. İlk denemede $0 harcayacağız ama önlem iyidir.

---

## Adım 3 — Yeni Proje Oluştur

1. Sol üstteki proje seçici (default'ta "My First Project" yazar) → **New Project**
2. Project name: **receiptiq**
3. Location: **No organization** (kişisel hesapsa)
4. **Create** → birkaç saniye sonra proje hazır olur, otomatik seçili gelir

---

## Adım 4 — Vision API'yi Etkinleştir

1. Üstteki arama çubuğuna **"Vision API"** yaz
2. Çıkan **Cloud Vision API** kartına tıkla
3. **Enable** butonuna bas
4. 30-60 saniye bekle, "API enabled" görmelisin

---

## Adım 5 — Service Account ve JSON Key

Backend'in API'yi çağırabilmesi için bir kimlik (service account) gerekiyor.

1. Soldaki menü → **IAM & Admin** → **Service Accounts**
2. Üstte **+ Create service account**
3. Doldur:
   - **Service account name**: `receiptiq-vision`
   - **Service account ID**: otomatik dolar
   - **Description**: "ReceiptIQ OCR backend"
4. **Create and Continue**
5. **Grant this service account access to project** → role olarak **Cloud Vision API User** seç (arayarak bul)
6. **Continue** → **Done**

Şimdi JSON key indir:

7. Service Accounts listesinde `receiptiq-vision@...` satırına tıkla
8. Üstte **Keys** sekmesi → **Add key** → **Create new key**
9. Type: **JSON** → **Create**
10. Tarayıcı otomatik bir JSON dosyası indirir, örn: `receiptiq-XXXXX.json`

---

## Adım 6 — Key Dosyasını Güvenli Bir Yere Koy

```bash
# Key dosyasını ev dizininde gizli bir yere taşı
mkdir -p ~/keys
mv ~/Downloads/receiptiq-*.json ~/keys/receiptiq-vision.json

# İzinleri kısıtla (sadece sen okuyabilesin)
chmod 600 ~/keys/receiptiq-vision.json

# Doğrula
ls -la ~/keys/receiptiq-vision.json
```

⚠️ **Bu dosyayı asla commit etme** — `.gitignore`'da `*.json` zaten yok ama `~/keys/` klasörü zaten projenin dışında, güvendesin.

---

## Adım 7 — .env Güncelle

`backend/.env` dosyasını aç ve iki satırı değiştir:

```env
# Eskisi:
OCR_PROVIDER=tesseract

# Yenisi:
OCR_PROVIDER=google_vision
GOOGLE_APPLICATION_CREDENTIALS=/Users/buraksayan/keys/receiptiq-vision.json
```

(Path'i kendi kullanıcı adınla değiştir — `whoami` ile öğrenebilirsin.)

---

## Adım 8 — Backend'i Restart Et

Uvicorn'un çalıştığı terminalde:

```bash
# Ctrl+C ile durdur, sonra
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`--reload` zaten dosya değişimini izliyor ama `.env` değişikliklerini garantiye almak için manuel restart en iyisi.

İlk istek geldiğinde `google.cloud.vision.ImageAnnotatorClient` ilk kez instantiate olacak. Eğer credentials path yanlışsa veya billing aktif değilse hatayı ilk upload denemesinde göreceksin.

---

## Adım 9 — Test

1. Uygulamada Scan ekranına git
2. Aynı kıvrımlı fişi tekrar çek
3. Review ekranı açılınca chip'lere bak:
   - Provider: **`google_vision`** olmalı
   - Güven: muhtemelen **%90+**
4. Form alanları:
   - Mağaza: **GÖCEK TÜNELİ İNŞ TAAH. A. Ş.** (Türkçe karakterler dahil!)
   - Tutar: **₺75,00**
   - Tarih: **17 Ocak 2026**
5. Ham OCR çıktısı kutusunda **tüm fiş metni** görünmeli (TOPKDV, NAKİT dahil)

---

## Olası Hatalar

**`google.api_core.exceptions.PermissionDenied: 403 Cloud Vision API has not been used`**
→ Adım 4'te Vision API'yi enable etmemişsin. Tekrar git, enable et.

**`google.auth.exceptions.DefaultCredentialsError: File ... was not found`**
→ `.env`'deki path yanlış. `ls -la` ile gerçek dosya yolunu doğrula.

**`401: Unauthorized` veya `INVALID_ARGUMENT`**
→ Service account'a Vision API User rolü verilmedi. Adım 5.5'i tekrar yap.

**`Quota exceeded`**
→ Ayda 1000 isteği aştın (test sırasında imkansız ama bilgi olarak).

---

## Sıradaki Adım

Vision aktive olunca testimiz yepyeni bir kalitede olacak. Sonuçları paylaş, oradan
karşılaştırma yapacağım. Vision iyi çalışırsa:
- Tesseract kodunu silmeyeceğiz — fallback olarak kalacak
- `.env`'de provider değişikliği ile geri dönülebilir
- Bitirme savunmasında "biz hibrit OCR mimarisi kurduk" diyebilirsin
