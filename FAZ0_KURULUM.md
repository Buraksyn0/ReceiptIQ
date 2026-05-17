# Faz 0 — Kurulum Adımları (Burak için)

Bu adımları sırayla uygula. ~5-10 dakika sürer.

## 1. Backend tarafı

```bash
cd backend

# Yeni paketler yok, ama .env dosyasına dikkat — kasada zaten oluşturuldu.
# .env içindeki SECRET_KEY'i prodüksiyonda mutlaka değiştir:
python -c "import secrets; print(secrets.token_hex(32))"
# ↑ çıktıyı .env'deki SECRET_KEY=... satırına yapıştır

# Veritabanını ayağa kaldır (zaten ayaktaysa atla)
docker compose up -d

# Migration'ı uygula
.venv/bin/alembic upgrade head
# ya da macOS'ta venv aktifken: alembic upgrade head

# Backend'i çalıştır
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`http://localhost:8000/docs` aç — yeni endpoint'leri görmelisin:
- `PATCH /api/v1/users/me`
- `DELETE /api/v1/users/me`
- `GET /api/v1/receipts/{id}`
- `PUT /api/v1/receipts/{id}`
- `PATCH /api/v1/receipts/{id}`
- `DELETE /api/v1/receipts/{id}`
- `PUT /api/v1/budgets/{id}`
- `PATCH /api/v1/budgets/{id}`
- `DELETE /api/v1/budgets/{id}`

`/health` endpoint'i de eklendi — load balancer/uptime check için.

## 2. Frontend tarafı

```bash
# Proje köküne dön
cd ..

# Yeni paketleri yükle (Inter font + expo-font + expo-splash-screen)
npx expo install @expo-google-fonts/inter expo-font expo-splash-screen

# Tunnel ile başlat (telefonda Expo Go açıkken)
npx expo start --tunnel
```

İlk açılışta font yüklenirken splash bir saniye fazladan görünür — bu normal.

### Eğer fiziksel cihazda gerçek API kullanmak istersen

Backend'in çalıştığı bilgisayarın LAN IP'sini bul:
```bash
# macOS
ipconfig getifaddr en0
# ya da
ifconfig | grep "inet 192"
```

Sonra Expo'yu şöyle başlat:
```bash
EXPO_PUBLIC_API_URL=http://192.168.X.X:8000 npx expo start --tunnel
```

Backend'i `--host 0.0.0.0` ile çalıştırdığından emin ol (yukarıdaki komutta zaten var).

## 3. Doğrulama Senaryosu

1. Uygulamayı aç, kayıt ol → giriş otomatik olur.
2. Dashboard'da artık "Burak Sayan" yazmıyor, gerçek ismin yazıyor.
3. Selam saatin gününe göre değişiyor (Good Morning / Afternoon / Evening / Night).
4. Settings'e git — profil kartında gerçek email görünüyor.
5. Dark mode toggle'ı bas → backend'e PATCH gidiyor (Network sekmesinden gör).
6. Çıkış yap → ekran SignIn'e dönüyor, **token kasadan gerçekten siliniyor**.
7. Tekrar giriş yap → aynı kullanıcıyla geliyor.
8. Settings → Hesabımı Sil → uyarı çıkıyor → onayla → hesap + tüm fişler/bütçeler siliniyor → SignIn ekranına düşüyorsun.

## 4. Bilinmesi Gerekenler

- Renk paleti `#2979FF` mavisinden `#008080` teal'a geçti. Eski mavi referansları başka dosyalarda hardcoded kaldıysa Faz 1'de tek tek temizleyeceğiz; ama `Colors.primary` zaten her yerde kullanılıyor, çoğu otomatik güncellendi.
- Inter fontu artık tüm `<Text>`'in default'u. Bazı yerlerde `fontWeight: '700'` gibi tanımlar var; bunlar Inter'in 700 weight'iyle eşlendiği için doğru render olur.
- `EXPO_PUBLIC_*` prefix'i Expo SDK 49+ için frontend'e expose edilen env değişkenidir; runtime'da `process.env.EXPO_PUBLIC_API_URL` üzerinden okunur.

## 5. Sıradaki Faz

Faz 0 bitti. Şimdi Faz 1'e geçebiliriz: **OCR pipeline**.
- `expo-camera` + `expo-document-picker` kurulumu
- Backend'de `/receipts/upload` endpoint'i
- Tesseract entegrasyonu
- TR fiş regex parser
- SHA-256 dedup + UUID storage

Hazır olduğunda söyle, başlayalım.
