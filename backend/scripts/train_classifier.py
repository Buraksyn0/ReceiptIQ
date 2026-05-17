"""
ReceiptIQ — Kategori Sınıflandırıcı Eğitim Scripti
====================================================
Türkçe fiş metni → kategori id (food, market, transport, ...)

Çalıştır:
    cd /Users/buraksayan/Desktop/ReceiptIQ/backend
    python scripts/train_classifier.py

Çıktı:
    app/ml/category_clf.pkl   — joblib pipeline
    app/ml/training_report.txt — accuracy + confusion matrix
"""

import random
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# 0. Bağımlılık kontrolü
# ---------------------------------------------------------------------------
try:
    import joblib
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import classification_report
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError as e:
    sys.exit(f"Eksik paket: {e}\nÇözüm: pip install scikit-learn joblib")

random.seed(42)

# ---------------------------------------------------------------------------
# 1. Sentetik veri şablonları
# ---------------------------------------------------------------------------
# Her kategori için: mağaza/yer adları, ürün/hizmet kelimeleri, miktar ifadeleri
# Fiş metni = rastgele kombinasyon → ~600-800 örnek/kategori

TEMPLATES: dict[str, dict] = {
    "food": {
        "stores": [
            "BURGER KING", "MCDONALD'S", "DOMINO'S PIZZA", "SIMIT SARAYI",
            "POPEYES", "KFC TÜRKIYE", "PIZZA HUT", "LITTLE CAESARS",
            "CAFE NERO", "STARBUCKS TURKEY", "GLORIA JEANS", "KÖFTECI YUSUF",
            "DÖNERCI ŞAHIN", "LAHMACUNCU MEHMET", "PIDE SALONU", "BALIK EVI",
            "KEBAPÇI MUSTAFA", "MANTICI FATMA", "ÇORBA EVI", "BÖREKÇI ALI",
        ],
        "items": [
            "WHOPPER MENU", "BIG MAC", "PIZZA MARGHERITA", "SIMIT", "ÇORBA",
            "DÖNER DÜRÜM", "LAHMACUN", "PIDE", "KÖFTE", "IZGARA TAVUK",
            "AMERICANO", "LATTE", "KAPUCİNO", "ÇAY", "TÜRK KAHVESİ",
            "AYRAN", "KOLA", "SU", "TOST", "SANDVIÇ", "WRAP",
            "BAKLAVA", "KÜNEFE", "SÜTLAÇ", "DİLBER DUDAĞI",
        ],
        "extras": ["PAKET SERVİS", "MASABAŞİ", "PAKET", "SERVİS ÜCRETİ"],
    },
    "market": {
        "stores": [
            "MİGROS", "BİM", "A101", "ŞOK MARKET", "CARREFOURSA",
            "METRO GROSS", "MACRO CENTER", "GRATIS", "HAKMAR EXPRESS",
            "ONUR MARKET", "ÖZDILEK MARKET", "FILE MARKET",
            "KIPA", "TEKNOSA MARKET", "KOÇTAŞ", "EVA",
        ],
        "items": [
            "EKMEK", "SÜT", "PEYNİR", "YOĞURT", "TEREYAĞI",
            "TAVUK", "KIYMA", "YUMURTA", "MAKARNA", "PİRİNÇ",
            "ZEYTINYAĞI", "DOMATES", "SALATALIK", "SOĞAN", "SARMSAK",
            "ELMA", "MUZ", "PORTAKAL", "ŞEKER", "TUZ",
            "DETERJAN", "ÇAMAŞIR SUYU", "BULAŞIK SABUNU", "TUVALET KAĞIDI",
            "PEÇETİ", "POŞETLİ MOP", "SÜNGER",
        ],
        "extras": ["MARKET ALIŞVERİŞİ", "NAKIT", "KREDİ KARTI"],
    },
    "shopping": {
        "stores": [
            "ZARA HOME", "H&M", "LC WAIKIKI AKSESUAR", "IKEA TÜRKIYE",
            "TEKNOSA", "MEDIAMARKT", "VATAN BİLGİSAYAR", "APPLE STORE",
            "SAMSUNG TURKEY", "DYSON", "TEFAL", "BEKO",
            "ENGLISH HOME", "KOÇTAŞ", "BAUHAUS", "DECATHLON",
            "TOYSARUSs", "D&R", "KIDLAND",
        ],
        "items": [
            "LAPTOP", "TELEFON KILIFI", "KULALIK", "ŞARJ KABLOSU",
            "TABLET", "AKILLI SAAT", "TV", "BUZDOLABI", "ÇAMAŞIR MAKİNESİ",
            "KOLTUK", "YATAK", "YASTIK", "NEVRESIM", "HALİ",
            "TABAK TAKIMI", "TENCERE SETİ", "TAVA", "BLAENDER",
            "OYUNCAK", "KİTAP", "BOYAMA KİTABI", "PUZZLE",
        ],
        "extras": ["TAKSİT", "PEŞİN", "GARANTİ BELGESİ", "FATURA"],
    },
    "transport": {
        "stores": [
            "İSTANBUL KART", "ANKARA KART", "İZMİR KART", "BURSAKART",
            "METRO TURIZM", "KAMIL KOÇ", "ULUSOY", "PAMUKKALE TURİZM",
            "TÜRK HAVA YOLLARI", "PEGASUS", "SUNEXPRESS", "ANADOLUJET",
            "UBER TÜRKIYE", "BİTAKSİ", "INDRIVE", "TAXI",
            "TCDD", "MARMARAY", "METRO İSTANBUL",
        ],
        "items": [
            "OTOBÜs BİLETİ", "METRO BİLETİ", "VAPUR BİLETİ", "TRAMVAY",
            "UÇAK BİLETİ", "ŞEHIRLERARASI", "TAKSİ ÜCRETİ", "UBER TRİP",
            "BAGAJ ÜCRETİ", "KOLTUK SEÇİMİ", "YURT İÇİ UÇUŞ",
            "HAVALİMANI TRANSFERİ", "DOLMUŞ", "MİNİBÜS",
            "OTOGAR", "BİNİŞ KARTI",
        ],
        "extras": ["GİDİŞ", "GİDİŞ-DÖNÜŞ", "EKONOMI SINIF", "BİZNES"],
    },
    "entertainment": {
        "stores": [
            "CİNEMAXİMUM", "CINEBONUS", "MARS SİNEMA", "AFM SİNEMA",
            "NETFLIX TURKEY", "SPOTIFY TURKEY", "YOUTUBE PREMIUM",
            "PLAYSTATION STORE", "STEAM", "EPIC GAMES",
            "DISNEY PLUS", "BLUTV", "EXXEN", "TOD TV",
            "ESCAPE ROOM İSTANBUL", "PLAYZONE", "LAZER TAG",
        ],
        "items": [
            "SİNEMA BİLETİ", "2D BİLET", "3D BİLET", "IMAX BİLETİ",
            "PATLAMİŞ MISIR", "KOLA+MISIIR COMBO", "ABONELIK",
            "OYUN SATINALMA", "DLC", "SEZONLİK GEÇIS",
            "KONSER BİLETİ", "TİYATRO BİLETİ", "MÜZİK FESTİVALİ",
            "KAÇIŞ OYUNU", "BOWLING", "GO-KART",
        ],
        "extras": ["ONLİNE BİLET", "GİŞE", "ÜYELİK YENİLEME"],
    },
    "rent": {
        "stores": [
            "AYEDAŞ", "BEDAŞ", "İGDAŞ", "BAŞKENTGAZ", "EGE GAZ",
            "TÜRK TELEKOM", "TURKCELL SUPERONLINE", "VODAFONE NET",
            "VODAFONE TÜRKİYE", "TURKCELL", "TÜRK TELEKOM", "BIMCELL",
            "KİRA MAKBUZU", "YÖNETİM", "SİTE AİDATI",
        ],
        "items": [
            "ELEKTRİK FATURASI", "DOĞALGAZ FATURASI", "SU FATURASI",
            "İNTERNET FATURASI", "TELEFON FATURASI", "KİRA",
            "AİDAT", "ORTAK GİDER", "ASANSÖR BAKIM",
            "ABONELIK ÜCRETİ", "BAĞLANTI ÜCRETİ", "SAYAÇ OKUMA",
        ],
        "extras": ["FATURA NO", "SON ÖDEME", "GECİKME FAİZİ"],
    },
    "salary": {
        "stores": [
            "BORDRO", "MAAŞ PUSULASI", "GELİR MAKBUZU",
            "SERBEST MESLEKİ MAKBUZ", "FATURALİ GELİR",
            "EK ÖDEME", "PRİM", "İKRAMİYE",
        ],
        "items": [
            "MAAŞ", "NET MAAŞ", "BRÜT MAAŞ", "AVANS",
            "PRİM ÖDEMESİ", "İKRAMİYE", "FAZLA MESAİ",
            "YILLIK İZİN ÜCRETİ", "SERBEST MESLEKİ GELİR",
            "DANIŞMANLIK ÜCRETİ", "PROJE ÖDEMESİ", "FREELANCE",
        ],
        "extras": ["BANKA HAVALESI", "EFT", "SGK", "GELİR VERGİSİ"],
    },
    "education": {
        "stores": [
            "D&R KİTAPEVİ", "KİTAPYURDU", "İDEAFİX", "PANDORA KİTAP",
            "UDEMY TURKEY", "COURSERA", "PLURALSIGHT",
            "DERSHANE", "ÖZEL DERS", "KURS MERKEZİ",
            "ÜNİVERSİTE KÜTÜPHANE", "OKUL KIRTASİYE",
        ],
        "items": [
            "KİTAP", "DERS KİTABI", "SORU BANKASI", "DENEME SINAVİ",
            "ONLİNE KURS", "SERTİFİKA PROGRAMI", "DİL KURSU",
            "ÖZEL DERS", "ETÜT", "YKS HAZIRLIK",
            "KIRTASİYE", "DEFTER", "KALEM SETİ", "HESAP MAKİNESİ",
        ],
        "extras": ["KDV DAHİL", "KAYIT ÜCRETİ", "TAKSITLI ÖDEME"],
    },
    "sports": {
        "stores": [
            "DECATHLON", "INTERSPORT", "NIKE TURKEY", "ADIDAS STORE",
            "SPOR SALONU", "GYM", "FITNESS", "CROSSFIT",
            "YÜZME HAVUZU", "TENİS KULÜBÜ", "FUTBOL SAHASI",
            "MACFIT", "SPORTSLINE", "GOLD'S GYM", "SMARTFIT",
        ],
        "items": [
            "SPOR AYAKKABISI", "FORMA", "ŞORT", "TAYT",
            "AYLLIK ÜYELİK", "YILLIK ÜYELİK", "GÜNLÜK GİRİŞ",
            "KİŞİSEL ANTRENÖRLİK", "GROUP FİTNESS", "YOGA DERSİ",
            "HAVUZ GİRİŞİ", "TENİS KORTU KİRA", "HALTER",
            "PROTEİN TOZU", "SPOR BESİN TAKVİYESİ",
        ],
        "extras": ["AYLIK ABONELİK", "YENİLEME", "DONUK HESAP"],
    },
    "clothing": {
        "stores": [
            "ZARA", "H&M", "LC WAIKIKI", "KOTON", "DeFacto",
            "MANGO", "BERSHKA", "PULL&BEAR", "STRADIVARIUS",
            "MARKS&SPENCER", "PIERRE CARDIN", "US POLO ASSN",
            "BEYMEN", "VAKKO", "NETWORK", "TWIST",
        ],
        "items": [
            "TIŞÖRT", "GÖMLEK", "PANTOLON", "KOT PANTOLON", "ELBİSE",
            "ETEK", "CEKET", "MONT", "KABAN", "TRENÇKOT",
            "AYAKKABISI", "ÇANTA", "KEMER", "KRAVAT", "FULAR",
            "İÇ ÇAMAŞIR", "ÇORAP", "PİJAMA", "HAVA",
        ],
        "extras": ["İNDİRİM", "SEZON SONU", "YENİ SEZON", "ÜYE FİYATI"],
    },
    "fuel": {
        "stores": [
            "SHELL TURKEY", "BP TÜRKIYE", "TOTAL TÜRKIYE",
            "PETKİM", "OPET", "PETROL OFİSİ", "LUKOIL",
            "AYTEMIZ", "TÜRKOIL", "MOİL",
        ],
        "items": [
            "KURŞUNSUZ 95", "KURŞUNSUZ 97", "DİZEL", "LPG",
            "MOTORIN", "BENZIN", "SÜPER BENZIN",
            "OTOMATİK YIKAMA", "MANUEL YIKAMA", "DETAYLI YIKAMA",
            "MOTORİN ADDİTİVLİ", "EURO DİZEL",
        ],
        "extras": ["LİTRE", "KM", "PLAKA", "POMPA NO"],
    },
    "health": {
        "stores": [
            "ECZANE", "ECZACIBAŞİ", "SEÇKIN ECZANE", "SAĞLIK ECZANE",
            "DEVLET HASTANESİ", "ÖZEL HASTANE", "POLİKLİNİK",
            "DİŞ KLİNİĞİ", "GÖZ MERKEZİ", "LABORATUVAR",
            "MEDİCAL PARK", "ACIBADЕМ", "MEMORIAL",
        ],
        "items": [
            "İLAÇ", "VITAMIN", "TAKVİYE", "ANTIBIOTIK",
            "MUAYENE ÜCRETİ", "KAN TAHLİLİ", "RÖNTGEN", "ULTRASONİ",
            "DİŞ TEDAVİSİ", "DOLGU", "TAŞ TEMIZLEME",
            "GÖZ MUAYENE", "GÖZLÜK CAM", "LENS",
            "BANDAJ", "YARA KAPATICI", "ELDİVEN",
        ],
        "extras": ["SGK", "MUAFIYET", "KATKİ PAYI", "ÖZEL SİGORTA"],
    },
    "personal_care": {
        "stores": [
            "GRATİS", "WATSONS", "İPEKYOL KOZMETİK", "SEPHORA",
            "ROSSMANN", "THE BODY SHOP", "AVON", "ORIFLAME",
            "MAC COSMETİCS", "NYX", "FLORMAR",
        ],
        "items": [
            "ŞAMPUAN", "SAÇ KREMI", "SAÇKOYUCU", "SAÇ BOYASI",
            "YÜZ KREMI", "NEMLENDİRİCİ", "GÜNEŞ KREMİ", "MAKYAJ",
            "RÜCU MASKARA", "RUJ", "FONDÖTEN", "KREMİ",
            "PARFÜM", "DEODORANT", "TIRAŞ KREMI", "TIRAŞ MAKİNESİ",
            "DIŞ FIRÇASI", "DİŞ MACUNİ", "AĞIZ SUYU",
            "SABUN", "DUŞ JELI", "LOSYON",
        ],
        "extras": ["KOZMETİK", "PERSONELHİZMET", "BAKIM"],
    },
    "subscriptions": {
        "stores": [
            "NETFLIX", "SPOTIFY", "YOUTUBE PREMIUM", "AMAZON PRİME",
            "DISNEY PLUS", "BLUTV", "EXXEN", "TOD",
            "APPLE ONE", "GOOGLE ONE", "DROPBOX",
            "MICROSOFT 365", "ADOBE CC", "CANVA PRO",
            "LINKEDIN PREMIUM", "CHATGPT PLUS", "CLAUDE PRO",
        ],
        "items": [
            "AYLIK PLAN", "YILLIK PLAN", "AİLE PLANI", "BİREYSEL PLAN",
            "PREMİUM ÜYELİK", "TEMEL PLAN", "STANDART PLAN",
            "4K ULTRA HD", "HD PLAN", "REKLAMSIZ",
            "DEPOLAMA ALANI", "BULUT DEPOLAMA", "EKSTRA ALAN",
            "OTOMATİK YENİLEME",
        ],
        "extras": ["AYLK ÜCRET", "YILLIK ÜCRET", "OTOMATİK ÖDEME", "ABONELİK"],
    },
    "other": {
        "stores": [
            "PTT", "KARGO", "YURTİÇİ KARGO", "ARAS KARGO", "MNG KARGO",
            "NOTER", "TAPU DAİRESİ", "NÜFUS MÜDÜRLÜĞÜ",
            "BELEDİYE", "VERGİ DAİRESİ", "SGK",
            "BAĞIŞ MAKBUZU", "DERNEĞİ",
        ],
        "items": [
            "KARGO ÜCRETİ", "DESİ", "KAPIDA ÖDEME",
            "NOTER HAR", "VEKALETNAMESİ", "ONAY ÜCRETİ",
            "VERGİ ÖDEMESİ", "HARÇ", "CEZA",
            "BAĞIŞ", "YARDIM", "AIDAT",
            "ÇEŞİTLİ GİDER", "DİĞER",
        ],
        "extras": ["MAKBUZ", "DEKONT", "BELGE"],
    },
}


def make_receipt_text(category: str, n: int = 1) -> list[str]:
    """Bir kategori için n adet sentetik fiş metni üretir."""
    t = TEMPLATES[category]
    stores = t["stores"]
    items = t["items"]
    extras = t["extras"]
    results = []

    for _ in range(n):
        store = random.choice(stores)
        # 2-5 arası ürün satırı
        chosen_items = random.sample(items, k=min(random.randint(2, 5), len(items)))
        # Rastgele tutar (10-500 TL)
        total = round(random.uniform(10, 500), 2)
        kdv = round(total * 0.18, 2)
        extra = random.choice(extras)

        lines = [
            store,
            random.choice(["VKN: " + str(random.randint(1000000000, 9999999999)),
                           "FİŞ NO: " + str(random.randint(100, 9999))]),
        ]
        for item in chosen_items:
            price = round(random.uniform(5, 200), 2)
            lines.append(f"{item}  *{price:.2f}")

        lines += [
            f"TOPKDV  *{kdv:.2f}",
            f"TOPLAM  *{total:.2f}",
            extra,
        ]

        results.append("\n".join(lines))

    return results


# ---------------------------------------------------------------------------
# 2. Dataset üret
# ---------------------------------------------------------------------------
SAMPLES_PER_CLASS = 60  # × 15 kategori = 900 toplam

print("Sentetik veri üretiliyor...")
texts, labels = [], []
for cat in TEMPLATES:
    cat_texts = make_receipt_text(cat, SAMPLES_PER_CLASS)
    texts.extend(cat_texts)
    labels.extend([cat] * len(cat_texts))

print(f"  Toplam örnek: {len(texts)} ({len(set(labels))} kategori)")

# ---------------------------------------------------------------------------
# 3. Pipeline tanımla & çapraz doğrulama
# ---------------------------------------------------------------------------
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        min_df=2,
        max_features=8000,
        sublinear_tf=True,
    )),
    ("clf", LogisticRegression(
        max_iter=1000,
        C=5.0,
        solver="lbfgs",
    )),
])

print("5-fold çapraz doğrulama...")
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
scores = cross_val_score(pipeline, texts, labels, cv=cv, scoring="accuracy")
print(f"  CV Accuracy: {scores.mean():.3f} ± {scores.std():.3f}")

# ---------------------------------------------------------------------------
# 4. Tüm veri ile eğit & kaydet
# ---------------------------------------------------------------------------
print("Final model eğitiliyor...")
pipeline.fit(texts, labels)

out_dir = Path(__file__).parent.parent / "app" / "ml"
out_dir.mkdir(parents=True, exist_ok=True)
model_path = out_dir / "category_clf.pkl"
joblib.dump(pipeline, model_path)
print(f"  Model kaydedildi: {model_path}")

# ---------------------------------------------------------------------------
# 5. Rapor
# ---------------------------------------------------------------------------
preds = pipeline.predict(texts)
report = classification_report(labels, preds, digits=3)
report_path = out_dir / "training_report.txt"
report_path.write_text(
    f"CV Accuracy: {scores.mean():.3f} ± {scores.std():.3f}\n\n{report}"
)
print(f"  Rapor kaydedildi: {report_path}")

# ---------------------------------------------------------------------------
# 6. Hızlı test
# ---------------------------------------------------------------------------
test_cases = [
    ("MIGROS\nEKMEK *5.50\nSÜT *12.00\nYOĞURT *8.90\nTOPLAM *26.40", "market"),
    ("STARBUCKS\nLATTE *65.00\nCHEESECAKE *45.00\nTOPLAM *110.00", "food"),
    ("SHELL\nKURŞUNSUZ 95\n42.5 LİTRE\nTOPLAM *1487.50", "fuel"),
    ("ECZANE\nAMOXİLİN 500MG\nVİTAMİN C\nMUAYENE KATKİ\nTOPLAM *85.00", "health"),
    ("METRO İSTANBUL\nBİNİŞ KARTI\n5 ADET\nTOPLAM *35.00", "transport"),
]

print("\nHızlı test:")
for text, expected in test_cases:
    pred = pipeline.predict([text])[0]
    status = "✓" if pred == expected else "✗"
    print(f"  {status} Beklenen: {expected:15s} | Tahmin: {pred}")

print("\nFaz 2 model eğitimi tamamlandı!")
