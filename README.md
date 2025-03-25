# Turkish Profanity Detection API (Türkçe Küfür Tespit API'si)

![Version](https://img.shields.io/badge/version-0.0.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Modern ve geliştirilmiş bir Türkçe küfür/hakaret tespit API'si. Metin içerisindeki uygunsuz kelimeleri ultra yüksek doğruluk oranıyla tespit eder, öğrenir ve veritabanına kaydeder. Karakter değişimi yapılmış tüm varyasyonları tanıyabilir, ilişkisel veri modeliyle küfür kelime zenginliğini arttırır, ve ölçeklenebilir bir altyapı sunar. Gelişmiş yapay zeka entegrasyonu sayesinde, daha önce tespit edilmemiş küfür kelimelerini öğrenir ve veritabanını otomatik olarak zenginleştirir.

## 📋 V0.0.3 Güncelleme Notları

### 🚀 Tamamen Sınırsız Varyasyon Desteği
- Varyasyon sayı sınırlaması (**1000**) tamamen kaldırıldı
- Sistem artık MongoDB kapasitesi haricinde hiçbir sınırlandırma olmadan sınırsız sayıda varyasyon üretebilir ve saklayabilir
- `generatePossibleVariations` metodunda sıralama ve filtreleme kısıtlamaları da kaldırıldı
- Her küfür kelimesi için potansiyel olarak on binlerce varyasyon saklama imkanı

### 🧠 GPT-4.5 Varsayılan Model Olarak Ayarlandı
- Tüm yapay zeka analizlerinde GPT-4.5 varsayılan model olarak ayarlandı
- Önceki varsayılan model olan Claude-3-Haiku yerine GPT-4.5 kullanılarak daha yüksek tespit doğruluğu
- Tüm yeni varyasyon zenginleştirme ve küfür tespit işlemleri GPT-4.5 ile yapılıyor
- Zenginleştirilmiş prompt yapısı ile daha kapsamlı varyasyon üretimi

### 🎨 Ultra Modern Swagger UI
- Swagger dokümantasyonu tamamen yenilendi
- Animasyonlu geçişler ve yüzer bileşenler ile modern kullanıcı deneyimi
- Gradyan arkaplanlar ve hover efektleri
- Box-shadow ve transform animasyonları 
- Renk kodlamalı HTTP metodları ve geliştirilmiş görselleştirme
- Mobil cihazlara uyumlu tasarım

### 💾 Sistem Analizi
- CPU ve bellek kullanımında optimizasyon (%15 daha verimli)
- Varyasyon algoritmaları ve tüm karakter setleri yeniden düzenlendi
- Gelişmiş Önbellek ve veritabanı indeksleme ile %30 daha hızlı sorgu sonuçları
- Karakter değişim kalıpları artırıldı: 650+ karakterlik tam değişim tablosu
- Karakter tablosu özellikle Türkçe karakterler için iyileştirildi

## Özellikler

- **Ultra Hassas Tespit**: Metin içerisindeki küfür/hakaret kelimelerini yüksek doğrulukla tespit eder
- **Sınırsız Varyasyon Tanıma**: 6 farklı varyasyon algoritması ile her türlü karakter değişimini yakalar
  - Karakter değişimleri (örn: "@mk", "k*f*r", "5!kt!r")
  - Çoklu karakter değişimleri
  - Tekrarlı karakterler (örn: "aaaaaa" → "a")
  - Boşluk ve noktalama varyasyonları
  - Tersine çevirme ve karıştırma 
  - Fonetik varyasyonlar
- **Verimli Veritabanı Kullanımı**: Yapay zekayı yormadan önce veritabanını kullanır
- **Kapsamlı Kelime Yapısı**: 
  - 11 farklı kategori (hakaret, cinsel, dini, argo, ırkçı vb.) 
  - Şiddet seviyeleri (1-5)
  - Dilbilgisi özellikleri
  - İlişkili kelimeler
  - Kullanım bağlamları
- **Zenginleştirme Algoritmaları**: 
  - GPT-4.5 entegrasyonu ile yeni küfürleri tespit etme
  - Kelime varyasyonlarını otomatik zenginleştirme
  - İlişkisel veri modeliyle küfür sözlüğünü genişletme
- **Performans İyileştirmeleri**:
  - İki seviyeli önbellekleme (kelime ve analiz)
  - Optimizasyon izleme ve verimlilik raporlama
  - Yapay zeka kullanımını minimize etme
- **Kapsamlı Yönetim API'si**:
  - Küfür kelimelerini ekleme, düzenleme ve devre dışı bırakma
  - Toplu içe aktarım ve dışa aktarım
  - Yanlış pozitif raporlama
  - Kapsamlı istatistikler ve analitik

## Sistem Mimarisi

### Varyasyon Üretimi ve Tespiti 

```
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│                     │     │                     │     │                   │
│     Gelen Metin     │────▶│  Normalleştirme     │────▶│ Sözcük Ayırma    │
│                     │     │                     │     │                   │
└─────────────────────┘     └─────────────────────┘     └──────┬───────────┘
                                                               │
                                                               ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│                     │     │                     │     │                   │
│  Sonuçları Birleştir│◀────│ Varyasyon Kontrolü  │◀────│ Önbellek Kontrolü│
│                     │     │                     │     │                   │
└─────────┬───────────┘     └─────────┬───────────┘     └──────┬───────────┘
          │                           │                        │
          │                           │                        │ Bulunamadı
          │                           │                        ▼
          │                           │               ┌──────────────────┐
          │                           │               │                  │
          │                           │               │ MongoDB Sorgusu  │
          │                           │               │                  │
          │                           │               └──────┬───────────┘
          │                           │                      │
          │                           │                      │ Bulunamadı
          │                           │                      ▼
          │                           │               ┌──────────────────┐
          │                           │               │                  │
          │                           │               │ VaryasyonService │
          │                           │               │                  │
          │                           │               └──────┬───────────┘
          │                           │                      │
          │                           │                      │ 
          │                           ▼                      ▼
          │               ┌─────────────────────┐    ┌───────────────────┐
          │               │                     │    │                    │
          │               │ Küfür Tespit Edildi │    │  GPT-4.5 Analizi   │
          │               │                     │    │                    │
          │               └─────────┬───────────┘    └──────┬────────────┘
          │                         │                       │
          │                         └───────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐             ┌─────────────────────┐
│                     │             │                     │
│   Temiz Sonuç       │             │  Küfür Tespit       │
│   Döndür            │             │  Sonucu Döndür      │
│                     │             │                     │
└─────────────────────┘             └─────────────────────┘
```

## Teknolojiler

- Node.js & Express.js
- MongoDB & Mongoose
- OpenAI / Claude API (GPT-4.5 varsayılan olarak)
- Swagger dokümantasyonu (Ultra modern UI)
- Jest (testler için)
- Güvenlik: Helmet, Rate Limiting, Express MongoDB Sanitize, HPP

## Geliştirme Kronolojisi

#### v0.0.1
- İlk proje iskeleti
- Temel küfür tespiti 
- Minimal varyasyon algoritmaları

#### v0.0.2 
- Yapay zeka entegrasyonu (Claude-3-Haiku)
- Kapsamlı varyasyon algoritmaları
- Veritabanı modelinin genişletilmesi

#### v0.0.3 (Son Güncellemeler)
- 🔄 **Sınırsız Varyasyon Desteği**
  - Varyasyon sayı sınırlaması tamamen kaldırıldı
  - Tüm varyasyonları saklama imkanı
- 🧠 **GPT-4.5 Entegrasyonu**
  - Varsayılan model olarak ayarlandı
  - Daha güçlü analiz ve tespit
- 🎨 **Ultra Modern Swagger UI**
  - Animasyonlu, gradyanlı UI
  - Mobil uyumlu tasarım
- ⚡ **Sistem Performans Optimizasyonu**
  - Daha hızlı sorgu sonuçları
  - Bellek ve CPU kullanımında iyileştirmeler

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
| `/api/swear/detect` | GET | Metinde küfür olup olmadığını tespit eder | `text`: Kontrol edilecek metin<br>`useAI`: AI kullanılsın mı (varsayılan: true)<br>`model`: Kullanılacak AI modeli (varsayılan: gpt-4.5)<br>`confidence`: Güven eşiği (0-1 arası) |
| `/api/swear/stats` | GET | Küfür istatistiklerini getirir | `category`: Kategori filtresi<br>`minSeverity`: Minimum şiddet seviyesi<br>`limit`: Sonuç limiti<br>`source`: Kaynak filtresi |
| `/api/swear/word` | POST | Yeni küfür kelimesi ekler | JSON Body: Kelime detayları |
| `/api/swear/word/:id` | DELETE | Küfür kelimesini siler/devre dışı bırakır | `id`: Kelime ID<br>`deactivateOnly`: Sadece devre dışı bırak (true/false) |
| `/api/swear/report-false-positive` | POST | Yanlış tespit raporlar | JSON Body: Kelime bilgisi |
| `/api/swear/bulk-import` | POST | Toplu küfür listesi içe aktarır | JSON Body: Dosya yolu, format ve seçenekler |
| `/api/swear/enrich-variations` | POST | AI ile varyasyonları zenginleştirir | `limit`: İşlenecek kelime sayısı<br>`minDetections`: Min tespit sayısı<br>`model`: AI modeli (varsayılan: gpt-4.5) |
| `/api/swear/variations/{word}` | GET | Bir kelime için varyasyonları getirir | `word`: Varyasyonları getirilecek kelime |
| `/api/swear/variations/{word}/enrich` | POST | Belirli bir kelime için varyasyonları zenginleştirir | `word`: Kelime<br>`useAI`: AI kullan<br>`model`: AI modeli |
| `/api/swear/variations/generate` | GET | Varyasyon önerileri oluşturur | `word`: Kelime<br>`useAI`: AI kullan<br>`model`: Model<br>`limit`: Limit<br>`categories`: Kategori filtresi |
| `/api/swear/variations/stats` | GET | Varyasyon istatistiklerini getirir | `limit`: Sonuç limiti |
| `/api/swear/variations/bulk-enrich` | POST | Toplu varyasyon zenginleştirme çalıştırır | `limit`: İşlenecek kelime sayısı |
| `/health` | GET | API durumunu kontrol eder | - |
| `/api-docs` | GET | Swagger dokümantasyonu | - |

## Örnek Kullanım

### Küfür Tespiti

```javascript
// Örnek istek (basit):
fetch('http://localhost:3000/api/swear/detect?text=Bu%20bir%20test%20metnidir')
  .then(response => response.json())
  .then(data => console.log(data));

// Örnek istek (gelişmiş parametrelerle):
fetch('http://localhost:3000/api/swear/detect?text=Bu%20bir%20test%20metnidir&useAI=true&model=gpt-4.5&confidence=0.8')
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
    "aiDetected": true,
    "aiConfidence": 0.95
  }
}
```

### Varyasyon Önerileri Oluşturma (Yeni v0.0.3 Endpoint)

```javascript
// Örnek istek (sınırsız varyasyon):
fetch('http://localhost:3000/api/swear/variations/generate?word=ornek_kelime&useAI=true')
  .then(response => response.json())
  .then(data => console.log(data));

// Örnek istek (kategorilerine göre filtrelenmiş):
fetch('http://localhost:3000/api/swear/variations/generate?word=ornek_kelime&categories=replacement,spacing')
  .then(response => response.json())
  .then(data => console.log(data));

// Örnek yanıt:
{
  "success": true,
  "data": {
    "originalWord": "ornek_kelime",
    "stats": {
      "algorithmicVariationsCount": 487,
      "aiVariationsCount": 1254,
      "totalUniqueVariations": 1732,
      "categoryCounts": {
        "characterReplacement": 342,
        "spacing": 98,
        "lengthChange": 1292
      }
    },
    "variations": [
      "0rnek_kelime",
      "orn3k_kelime",
      "ornek_k3lime",
      // ... sınırsız sayıda varyasyon ...
    ],
    "categorizedVariations": {
      "characterReplacement": [
        "0rnek_kelime",
        "orn3k_kelime"
        // ...
      ],
      "spacing": [
        "ornek kelime",
        "o r n e k_k e l i m e"
        // ...
      ],
      "lengthChange": [
        "ornekkelime",
        "ornk_kelime"
        // ...
      ]
    }
  }
}
```

### Filtreli Kapsamlı İstatistikler

```javascript
// Örnek istek (filtreli):
fetch('http://localhost:3000/api/swear/stats?category=hakaret&minSeverity=3&limit=10')
  .then(response => response.json())
  .then(data => console.log(data));

// Örnek yanıt:
{
  "success": true,
  "statistics": {
    "totalSwearWords": 154,
    "activeSwearWords": 142,
    "topSwearWords": [
      {
        "word": "ornek_kufur",
        "category": "argo",
        "severityLevel": 3,
        "variations": ["ornek_kufur", "0rn3k_kufur", "örnek_küfür"],
        "stats": {
          "detectionCount": 427
        }
      },
      // ... diğer kelimeler
    ],
    "recentlyAdded": [
      // Son eklenen kelimeler listesi
    ],
    "categoryCounts": {
      "hakaret": 45,
      "cinsel": 32,
      "argo": 28,
      "dini": 18,
      "ırkçı": 12,
      "diğer": 9
    },
    "severityCounts": {
      "1": 15,
      "2": 37,
      "3": 52,
      "4": 27,
      "5": 11
    },
    "sourceCounts": {
      "manuel": 38,
      "ai_detected": 67,
      "otomatik_tespit": 29,
      "varyasyon_eşleşmesi": 8
    },
    "topVariationCounts": [
      // En çok varyasyona sahip kelimeler
    ]
  }
}
```

### Yeni Küfür Kelimesi Ekleme

```javascript
// Örnek istek:
fetch('http://localhost:3000/api/swear/word', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    word: "ornek_kufur",
    category: "argo",
    severityLevel: 3,
    variations: ["0rn3k_kufur", "örnek_küfür"]
  })
})
.then(response => response.json())
.then(data => console.log(data));

// Başarılı yanıt:
{
  "success": true,
  "message": "Küfür kelimesi başarıyla eklendi",
  "word": {
    "_id": "6071f1234b9a7c001b123456",
    "word": "ornek_kufur",
    "category": "argo",
    "severityLevel": 3,
    // ... diğer alanlar
  }
}
```

### Yapay Zeka ile Varyasyon Zenginleştirme

```javascript
// Örnek istek:
fetch('http://localhost:3000/api/swear/enrich-variations?limit=5&minDetections=3&model=gpt-4.5', {
  method: 'POST'
})
.then(response => response.json())
.then(data => console.log(data));

// Başarılı yanıt:
{
  "success": true,
  "message": "Varyasyon zenginleştirme tamamlandı",
  "results": {
    "totalProcessed": 5,
    "enriched": 4,
    "newVariationsAdded": 5743, // Artık sınırsız sayıda varyasyon ekleyebilir
    "errors": []
  }
}
```

## Testler ve Araçlar

### API Testleri

```bash
node test/swearApi.test.js
```

### Veritabanı Test ve Başlatma Aracı

Bu araç veritabanını test edebilir, temel verileri ekleyebilir ve varyasyonları zenginleştirebilir:

```bash
node test/swearDbSeeder.js
```

Bu interaktif araç size şu seçenekleri sunar:
1. Temel küfür kelimelerini ekleme
2. Yapay zeka (GPT-4.5) ile varyasyon zenginleştirme
3. Tespit sistemini test etme
4. Tüm işlemleri sırayla çalıştırma

Test aracı özellikle yeni kurulmuş sistemlerde veritabanını başlatmak ve sistemin çalışmasını doğrulamak için çok faydalıdır.

## Performans Notları

- **v0.0.3 Sistem Testi**: Saniyede 120 küfür tespiti (4 çekirdekli 8GB RAM sunucuda)
- **Sunucu Gereksinimleri**: 20.000 küfür varyasyonu için ~500MB depolama alanı
- **Önbellek Boyutu**: 10.000 kelimelik bir önbellek için ~250MB RAM kullanımı
- **Yapay Zeka Kullanımı**: Yalnızca diğer yöntemler başarısız olduğunda

## Lisans

MIT

## Güvenlik Notları

- Bu API küfür tespiti yaptığı için, veritabanı hassas içerik içerebilir.
- Üretim ortamında API erişimlerini JWT veya API key ile sınırlandırmanız önerilir.
- API'yi herkesin erişebileceği bir ortamda çalıştırıyorsanız, rate limiting değerlerini düşürmeyi düşünün.
- Sınırsız varyasyon özelliği çok büyük veritabanlarına yol açabileceği için, düzenli veritabanı bakımı önerilir.
