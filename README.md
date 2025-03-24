# Turkish Profanity Detection API (Türkçe Küfür Tespit API'si)

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Modern ve gelişmiş bir Türkçe küfür/hakaret tespit API'si. Metin içerisindeki uygunsuz kelimeleri yüksek doğruluk oranıyla tespit eder, öğrenir ve veritabanına kaydeder. Karakter değişimi yapılmış varyasyonları da tanıyabilir. Yapay zeka entegrasyonu sayesinde, daha önce tespit edilmemiş küfür kelimelerini de öğrenebilir.

## Özellikler

- Metin içerisindeki küfür/hakaret kelimelerini tespit etme
- Karakter değişimi yapılmış kelimeleri (örn: "@mk" gibi) tanıma
- Yapay zeka ile daha önce bilinmeyen küfürleri tespit etme
- Tespit edilen küfürleri kategorilendirme ve şiddet seviyesini belirleme
- Tüm tespitleri MongoDB veritabanında depolama
- İstatistik ve raporlama özellikleri
- Swagger ile API dokümantasyonu
- Kapsamlı güvenlik önlemleri (rate limiting, input sanitization vb.)

## Teknolojiler

- Node.js & Express.js
- MongoDB & Mongoose
- OpenAI / Claude API (küfür analizi için)
- Swagger dokümantasyonu
- Jest (testler için)
- Güvenlik: Helmet, Rate Limiting, Express MongoDB Sanitize, HPP

## Son Geliştirmeler

- ✨ Performans için **önbellekleme sistemi** eklendi
- 🔍 Gelişmiş **varyasyon algoritmaları** ile daha iyi tespit
- 📊 **Detaylı loglama** ve izleme sistemi
- 🛡️ **Merkezi hata yönetimi** mekanizması
- 🚀 AI model seçimi ve optimizasyonları

## Kurulum

1. Repoyu klonlayın:
```bash
git clone https://github.com/kynuxdev/turkish-profanity-detector.git
cd turkish-profanity-detector
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env` dosyasını, örnek dosyadan oluşturun:
```bash
cp .env.example .env
# .env dosyasını düzenleyin ve kendi değerlerinizi ekleyin
```

4. Uygulamayı başlatın:
```bash
npm start
```

5. Swagger dokümantasyonuna browser'dan erişin:
```
http://localhost:3000/api-docs
```

## API Endpointleri

| Endpoint | Metod | Açıklama | Parametreler |
|----------|-------|----------|--------------|
| `/api/swear/detect` | GET | Metinde küfür olup olmadığını tespit eder | `text`: Kontrol edilecek metin |
| `/api/swear/stats` | GET | Küfür istatistiklerini getirir | - |
| `/health` | GET | API durumunu kontrol eder | - |
| `/api-docs` | GET | Swagger dokümantasyonu | - |

## Örnek Kullanım

### Küfür Tespiti

```javascript
// Örnek istek:
fetch('http://localhost:3000/api/swear/detect?text=Bu%20bir%20test%20metnidir')
  .then(response => response.json())
  .then(data => console.log(data));

// Örnek yanıt (küfür yoksa):
{
  "success": true,
  "result": {
    "isSwear": false,
    "details": null,
    "aiDetected": false
  }
}

// Örnek yanıt (küfür varsa):
{
  "success": true,
  "result": {
    "isSwear": true,
    "details": {
      "word": "tespit_edilen_kelime",
      "category": "hakaret",
      "severityLevel": 3,
      "detectedWords": ["tespit_edilen_kelime"]
    },
    "aiDetected": false
  }
}
```

### İstatistikler

```javascript
// Örnek istek:
fetch('http://localhost:3000/api/swear/stats')
  .then(response => response.json())
  .then(data => console.log(data));

// Örnek yanıt:
{
  "success": true,
  "statistics": {
    "totalSwearWords": 42,
    "topSwearWords": [
      {
        "word": "ornek_kufur",
        "category": "argo",
        "severityLevel": 3,
        "detectionCount": 15
      },
      // ... diğer kelimeler
    ],
    "categoryCounts": {
      "hakaret": 15,
      "cinsel": 10,
      "argo": 12,
      "dini": 3,
      "diğer": 2
    }
  }
}
```

## Testler

Testleri çalıştırmak için:

```bash
node test/swearApi.test.js
```

Not: Testleri çalıştırmadan önce uygulamanın çalışır durumda olduğundan emin olun.

## Lisans

MIT

## Güvenlik Notları

- Bu API küfür tespiti yaptığı için, veritabanı hassas içerik içerebilir.
- Üretim ortamında API erişimlerini JWT veya API key ile sınırlandırmanız önerilir.
- API'yi herkesin erişebileceği bir ortamda çalıştırıyorsanız, rate limiting değerlerini düşürmeyi düşünün.
