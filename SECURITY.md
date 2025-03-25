# Güvenlik Politikası

## Güvenlik Açıklarını Bildirme

Türkçe Küfür Tespit API'sinde bir güvenlik açığı keşfederseniz, lütfen aşağıdaki süreci izleyin:

1. **Güvenlik açığını kamuya açıklamayın.** Başkaları tarafından kötüye kullanılmasını önlemek için, sorunu önce ekibimize bildirin.
2. **Güvenlik bildirimlerini** security@example.com adresine gönderin.
3. **Güvenlik açığını detaylandırın**:
   - Açığın doğası ve potansiyel etkisi
   - Açığı yeniden oluşturmak için gereken adımlar
   - Mümkünse açığı gidermek için önerileriniz
4. **Yanıt için bekleyin**: Güvenlik ekibimiz bildiriminizi 48 saat içinde inceleyecek ve yanıtlayacaktır.

## Desteklenen Sürümler

Şu anda aşağıdaki API sürümleri için güvenlik güncellemeleri sağlıyoruz:

| Sürüm | Destekleniyor |
| ----- | ------------- |
| 0.0.3 | ✅ |
| 0.0.2 | ✅ |
| 0.0.1 | ❌ |

## Güvenlik Güncellemeleri

- Kritik güvenlik güncellemeleri en kısa sürede yayınlanacaktır.
- Güvenlik güncellemeleri için her zaman en son sürüme güncelleyin.
- Tüm güvenlik güncellemeleri, [Sürüm Notları](CHANGELOG.md) sayfamızda belgelenecektir.

## API Üretim Ortamında Güvenlik Tavsiyeleri

API'yi üretim ortamında kullanırken aşağıdaki güvenlik önlemlerini almanızı şiddetle tavsiye ederiz:

### 1. Kimlik Doğrulama ve Yetkilendirme

- **API Anahtarı Koruması**: Tüm yönetim endpointleri (küfür ekleme, silme, vb.) için API anahtarı koruması kullanın.
- **HTTPS**: API'ye yapılan tüm isteklerin HTTPS üzerinden yapıldığından emin olun.
- **JWT Kullanımı**: Uzun süreli işlemler için JWT tabanlı kimlik doğrulama kullanın.
- **İstemci IP Sınırlaması**: Mümkünse yönetim API'lerine erişimi güvenilir IP'lerle sınırlandırın.

### 2. Rate Limiting ve Istismar Önleme

- **Rate Limiting**: DoS saldırılarını önlemek için rate limiting uygulayın:
  ```javascript
  // Örnek rate limiting yapılandırması (middleware/rateLimit.js dosyasında)
  {
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 100, // IP başına 15 dakikada maksimum 100 istek
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Çok fazla istek, lütfen daha sonra tekrar deneyin' }
  }
  ```

- **IP Kara Listesi**: Kötü niyetli IP adreslerini otomatik olarak kara listeye alın.
- **Request Boyut Sınırlaması**: API'ye gönderilen isteklerin boyutunu sınırlayın (ör. 100KB).

### 3. Veritabanı Güvenliği

- **Şifreleme**: Hassas verileri veritabanında şifrelenmiş şekilde saklayın.
- **Veritabanı Erişimi**: Veritabanına en düşük ayrıcalıklara sahip kullanıcı ile erişin.
- **Injection Koruması**: SQL/NoSQL injection saldırılarına karşı koruma sağlayın:
  ```javascript
  // MongoDB için sanitize kullanımı
  app.use(mongoSanitize());
  ```

- **İndeks Optimizasyonu**: Performans ve güvenlik için veritabanı indekslerini düzenli olarak optimize edin.

### 4. Sınırsız Varyasyon Güvenliği (v0.0.3+)

v0.0.3 sürümünden itibaren desteklenen sınırsız varyasyon özelliği, ek güvenlik önlemleri gerektirir:

- **Disk Kullanımı İzleme**: Yüksek sayıda varyasyon veritabanında büyük miktarda yer kaplayabilir. Düzenli disk kullanımı izlemesi yapın.
- **Veritabanı Bakım İşlemleri**: Aşağıdaki bakım işlemini planlamak için bir cron job ayarlayın:
  ```javascript
  // Örnek bakım işlemi (her ay çalıştırılabilir)
  async function performMaintenance() {
    // 1. Kullanılmayan varyasyonları temizle (son 3 ayda hiç tespit edilmemiş)
    await SwearWord.updateMany(
      { 'stats.lastDetectionDate': { $lt: new Date(Date.now() - 90*24*60*60*1000) } },
      { $set: { variations: [], 'stats.lastMaintenance': new Date() } }
    );
    
    // 2. Varyasyon sayısını aşırı büyük olan kelimeler için sınırlama
    const massiveWords = await SwearWord.find({
      $where: "this.variations.length > 10000"
    });
    
    for (const word of massiveWords) {
      // En çok kullanılan varyasyonları koru
      word.variations = word.variations.slice(0, 5000);
      await word.save();
    }
  }
  ```

### 5. Yapay Zeka Güvenliği (GPT-4.5)

API, GPT-4.5 gibi yapay zeka modellerini kullandığından özel güvenlik önlemleri gerektirir:

- **Prompt Injection Koruması**: Kullanıcı girdilerini doğrudan yapay zeka promptlarına dahil ederken dikkatli olun ve sanitize edin.
- **API Anahtarı Yönetimi**: OpenAI API anahtarınızı çevresel değişkenler olarak saklayın, asla kodda saklamayın.
- **Kullanım Limitleri**: GPT-4.5 kullanımını sınırlandırın ve yalnızca gerektiğinde kullanın.
- **Günlüklemeyi Sınırlama**: Yapay zekaya gönderilen metinleri günlüklerde saklamayın veya anonimleştirin.

### 6. İstemci Tarafı Koruma

- **Cross-Origin Resource Sharing (CORS)**: CORS politikalarınızı güvenli şekilde yapılandırın:
  ```javascript
  // Örnek CORS yapılandırması
  const corsOptions = {
    origin: ['https://guvenli-sitem.com', 'https://admin.guvenli-sitem.com'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-API-KEY'],
    maxAge: 86400
  };
  ```

- **Content Security Policy (CSP)**: Swagger UI gibi istemci tarafı arayüzler için CSP başlıkları kullanın.
- **HTTP Security Headers**: Diğer güvenlik başlıklarını ekleyin:
  ```javascript
  // Helmet kütüphanesi ile tüm güvenlik başlıklarını etkinleştirme
  app.use(helmet());
  ```

## Veri Saklama ve Koruma

Küfür tespit API'sinin doğası gereği, veritabanında hassas içerik bulunabilir:

- **Veri Minimizasyonu**: Yalnızca gerekli verileri saklayın, gereksiz kişisel verileri saklamaktan kaçının.
- **Veri Anonimleştirme**: Test ve geliştirme ortamları için verileri anonimleştirin.
- **Düzenli Denetim**: Veritabanını düzenli olarak denetleyin ve gereksiz verileri temizleyin.
- **Erişim Kontrolleri**: Veri erişimini görev temelli yetkilendirme ile sınırlayın.

## Güvenlik Testleri

API'nizi düzenli olarak güvenlik testlerine tabi tutun:

- **Penetrasyon Testi**: Yılda en az bir kez tam kapsamlı penetrasyon testi yapın.
- **Otomatik Güvenlik Taramaları**: CI/CD sürecinize otomatik güvenlik taramaları ekleyin.
- **Kod İncelemesi**: Yeni özelliklerin kodlarını güvenlik açısından inceleyin.
- **Zaafiyet Taraması**: Bağımlılıkları düzenli olarak tarayın:
  ```bash
  npm audit
  # veya
  snyk test
  ```

## Güvenlik Kontrol Listesi

Üretim ortamına geçmeden önce aşağıdaki güvenlik kontrollerini tamamlayın:

- [ ] Tüm API endpointleri için uygun kimlik doğrulama mekanizmaları uygulandı
- [ ] Rate limiting ve istismar önleme mekanizmaları devrede
- [ ] Tüm bağımlılıklar güncel ve bilinen güvenlik açıkları yok
- [ ] Hassas bilgilerin şifrelenmesi ve güvenli depolanması sağlandı
- [ ] Hata mesajları minimum bilgi içerecek şekilde yapılandırıldı
- [ ] Günlükleme ve izleme sistemleri yapılandırıldı
- [ ] HTTPS zorunlu kılındı ve SSL/TLS yapılandırması güvenli
- [ ] Veritabanı yedekleme ve kurtarma prosedürleri test edildi
- [ ] Varyasyon sayısı sınırsız olduğundan disk alanı izleme ve uyarı sistemleri aktif

## Güvenli Yapılandırma Örnekleri

### Helmet Yapılandırması

```javascript
// middlewares/security.js
const helmet = require('helmet');

const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 yıl
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  referrerPolicy: { policy: 'same-origin' }
});

module.exports = securityMiddleware;
```

### API Key Auth Middleware

```javascript
// middlewares/apiKeyAuth.js
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Geçersiz API anahtarı'
    });
  }
  
  next();
};

module.exports = apiKeyAuth;
```

## Sorumlu Güvenlik Açığı Bildirenlere Teşekkür

API'mizin güvenliğini artırmak için zaman ve çaba harcayan aşağıdaki kişilere minnettarız:

- İsimler güvenlik açıkları düzeltildikçe eklenecektir.

---

Bu güvenlik politikası v0.0.3 sürümü için oluşturulmuştur ve düzenli olarak güncellenecektir. Son güncelleme: 25.03.2025
