/**
 * Küfür Tespit API Rotaları - Gelişmiş Sürüm
 * 
 * API rotalarını, hız limitleme, parametre doğrulama ve
 * yetkilendirme mekanizmalarıyla birlikte tanımlar.
 */

const express = require('express');
const router = express.Router();
const swearController = require('../controllers/swearController');
const rateLimit = require('express-rate-limit');
const { requireAdminAuth } = require('../middlewares/authMiddleware');

// Standart API rate limiter (DDoS ve brute force saldırılarını önlemek için)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına 15 dakikada maksimum 100 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'
  }
});

// Admin işlemleri için daha katı rate limiter
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 50, // IP başına 1 saatte maksimum 50 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Yönetici işlemleri için çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'
  }
});

// Yüksek hacimli veri işlemleri için daha düşük limit (bulkImport, enrichVariationsWithAI gibi)
const highVolumeProcessingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 10, // IP başına 1 saatte maksimum 10 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Yüksek kaynak gerektiren işlemler için çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'
  }
});

// Middleware - İstek parametrelerini doğrulama 
const validateTextParam = (req, res, next) => {
  const { text } = req.query;
  
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Geçerli bir text parametresi gerekli'
    });
  }
  
  next();
};

/**
 * @swagger
 * /api/swear/detect:
 *   get:
 *     summary: Metinde küfür/hakaret olup olmadığını tespit eder
 *     description: Verilen metin içerisinde küfür veya hakaret içeren kelimeler olup olmadığını tespit eder, veritabanında arar ve gerekirse yapay zeka kullanarak analiz eder.
 *     tags:
 *       - Küfür Tespiti
 *     parameters:
 *       - in: query
 *         name: text
 *         required: true
 *         schema:
 *           type: string
 *         description: Kontrol edilecek metin
 *       - in: query
 *         name: useAI
 *         required: false
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Veritabanında bulunamazsa yapay zeka kullanılsın mı?
 *       - in: query
 *         name: model
 *         required: false
 *         schema:
 *           type: string
 *           enum: [claude-3-haiku, claude-3-sonnet, claude-3-opus, gpt-4o, gpt-4-turbo, gpt-4, gpt-3.5-turbo]
 *           default: o3-mini
 *         description: Kullanılacak AI modeli
 *       - in: query
 *         name: confidence
 *         required: false
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.7
 *         description: Minimum güven eşiği (0-1 arası)
 *     responses:
 *       200:
 *         description: Başarılı tespit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SwearDetectionResponse'
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Çok fazla istek
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 message:
 *                   type: string
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/detect', apiLimiter, validateTextParam, swearController.detectSwear);

/**
 * @swagger
 * /api/swear/stats:
 *   get:
 *     summary: Küfür istatistiklerini getirir
 *     description: Veritabanındaki küfür kelimelerinin detaylı istatistiklerini getirir - filtreler ve sıralama seçenekleriyle.
 *     tags:
 *       - Küfür Tespiti
 *     parameters:
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *         description: Kategori filtresi (ör. hakaret, cinsel, dini, vb.)
 *       - in: query
 *         name: minSeverity
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Minimum şiddet seviyesi
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Döndürülecek maksimum kelime sayısı
 *       - in: query
 *         name: source
 *         required: false
 *         schema:
 *           type: string
 *         description: Kaynak filtresi (ör. manuel, ai_detected, vb.)
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatisticsResponse'
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.get('/stats', apiLimiter, requireAdminAuth, swearController.getStatistics);

/**
 * @swagger
 * /api/swear/word:
 *   post:
 *     summary: Yeni bir küfür kelimesi ekler
 *     description: Veritabanına yeni bir küfür kelimesi ve ilişkili bilgilerini ekler.
 *     tags:
 *       - Küfür Yönetimi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               word:
 *                 type: string
 *                 required: true
 *                 description: Eklenecek küfür kelimesi
 *               category:
 *                 type: string
 *                 description: Kategori
 *               severityLevel:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Şiddet seviyesi (1-5)
 *               variations:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Varyasyon listesi
 *               alternatives:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Alternatif kelimeler
 *     responses:
 *       201:
 *         description: Kelime başarıyla eklendi
 *       400:
 *         description: Geçersiz istek
 *       409:
 *         description: Kelime zaten mevcut
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.post('/word', adminLimiter, requireAdminAuth, swearController.addSwearWord);

/**
 * @swagger
 * /api/swear/word/{id}:
 *   delete:
 *     summary: Bir küfür kelimesini siler veya devre dışı bırakır
 *     description: Bir küfür kelimesini veritabanından tamamen siler veya devre dışı bırakır.
 *     tags:
 *       - Küfür Yönetimi
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Silinecek kelimenin ID'si
 *       - in: query
 *         name: deactivateOnly
 *         required: false
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Sadece devre dışı bırak (true) veya tamamen sil (false)
 *     responses:
 *       200:
 *         description: Kelime başarıyla silindi veya devre dışı bırakıldı
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Kelime bulunamadı
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.delete('/word/:id', adminLimiter, requireAdminAuth, swearController.deleteSwearWord);

/**
 * @swagger
 * /api/swear/report-false-positive:
 *   post:
 *     summary: Yanlış pozitif tespiti rapor eder
 *     description: Hatalı şekilde küfür olarak tespit edilen bir kelimeyi rapor eder.
 *     tags:
 *       - Küfür Tespiti
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               word:
 *                 type: string
 *                 required: true
 *                 description: Yanlış pozitif olarak rapor edilecek kelime
 *     responses:
 *       200:
 *         description: Yanlış pozitif başarıyla rapor edildi
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Kelime bulunamadı
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.post('/report-false-positive', apiLimiter, swearController.reportFalsePositive);

/**
 * @swagger
 * /api/swear/bulk-import:
 *   post:
 *     summary: Toplu küfür listesi içe aktarır
 *     description: CSV, JSON veya metin dosyasından toplu küfür listesi içe aktarır.
 *     tags:
 *       - Küfür Yönetimi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filePath:
 *                 type: string
 *                 required: true
 *                 description: İçe aktarılacak dosyanın yolu
 *               format:
 *                 type: string
 *                 enum: [json, csv, text]
 *                 default: json
 *                 description: Dosya formatı
 *               overwrite:
 *                 type: boolean
 *                 default: false
 *                 description: Mevcut kayıtlar üzerine yazılsın mı?
 *     responses:
 *       200:
 *         description: İçe aktarım başarıyla tamamlandı
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Dosya bulunamadı
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.post('/bulk-import', highVolumeProcessingLimiter, requireAdminAuth, swearController.bulkImport);

/**
 * @swagger
 * /api/swear/enrich-variations:
 *   post:
 *     summary: AI ile varyasyonları zenginleştirir
 *     description: Yapay zeka kullanarak küfür kelimelerinin varyasyonlarını otomatik olarak zenginleştirir.
 *     tags:
 *       - Küfür Yönetimi
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 5
 *         description: İşlenecek kelime sayısı
 *       - in: query
 *         name: minDetections
 *         required: false
 *         schema:
 *           type: integer
 *           default: 2
 *         description: Minimum tespit sayısı
 *       - in: query
 *         name: model
 *         required: false
 *         schema:
 *           type: string
 *           default: o3-mini
 *         description: Kullanılacak AI modeli
 *     responses:
 *       200:
 *         description: Varyasyon zenginleştirme başarıyla tamamlandı
 *       404:
 *         description: İşlenecek kelime bulunamadı
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.post('/enrich-variations', highVolumeProcessingLimiter, requireAdminAuth, swearController.enrichVariationsWithAI);

/**
 * @swagger
 * /api/swear/variations/{word}:
 *   get:
 *     summary: Bir kelime için varyasyonları getirir
 *     description: Belirli bir kelime için tüm varyasyonları getirir
 *     tags:
 *       - Varyasyon Yönetimi
 *     parameters:
 *       - in: path
 *         name: word
 *         required: true
 *         schema:
 *           type: string
 *         description: Varyasyonları getirilecek kelime
 *     responses:
 *       200:
 *         description: Varyasyonlar başarıyla getirildi
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Kelime için varyasyon bulunamadı
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.get('/variations/:word', apiLimiter, swearController.getVariationsForWord);

/**
 * @swagger
 * /api/swear/variations/{word}/enrich:
 *   post:
 *     summary: Bir kelime için varyasyonları zenginleştirir
 *     description: Belirli bir kelime için varyasyonları algoritma ve yapay zeka kullanarak zenginleştirir
 *     tags:
 *       - Varyasyon Yönetimi
 *     parameters:
 *       - in: path
 *         name: word
 *         required: true
 *         schema:
 *           type: string
 *         description: Varyasyonları zenginleştirilecek kelime
 *       - in: query
 *         name: useAI
 *         required: false
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Yapay zeka kullanılsın mı?
 *       - in: query
 *         name: model
 *         required: false
 *         schema:
 *           type: string
 *         description: Kullanılacak AI modeli
 *     responses:
 *       200:
 *         description: Varyasyon zenginleştirme başarıyla tamamlandı
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Kelime bulunamadı
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.post('/variations/:word/enrich', highVolumeProcessingLimiter, requireAdminAuth, swearController.enrichVariationsForWord);

/**
 * @swagger
 * /api/swear/variations/stats:
 *   get:
 *     summary: Varyasyon istatistiklerini getirir
 *     description: Veritabanındaki küfür kelimelerinin varyasyon istatistiklerini getirir
 *     tags:
 *       - Varyasyon Yönetimi
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maksimum sonuç sayısı
 *     responses:
 *       200:
 *         description: İstatistikler başarıyla getirildi
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.get('/variations/stats', apiLimiter, requireAdminAuth, swearController.getVariationStatistics);

/**
 * @swagger
 * /api/swear/variations/generate:
 *   get:
 *     summary: Kelime için varyasyon önerileri oluşturur
 *     description: Verilen kelime için varyasyon önerileri oluşturur (veritabanına kaydetmeden)
 *     tags:
 *       - Varyasyon Yönetimi
 *     parameters:
 *       - in: query
 *         name: word
 *         required: true
 *         schema:
 *           type: string
 *         description: Varyasyonları oluşturulacak kelime
 *       - in: query
 *         name: useAI
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Yapay zeka kullanılsın mı?
 *       - in: query
 *         name: model
 *         required: false
 *         schema:
 *           type: string
 *         description: Kullanılacak AI modeli
 *     responses:
 *       200:
 *         description: Varyasyonlar başarıyla oluşturuldu
 *       400:
 *         description: Geçersiz istek
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.get('/variations/generate', apiLimiter, swearController.generateVariations);

/**
 * @swagger
 * /api/swear/variations/bulk-enrich:
 *   post:
 *     summary: Toplu varyasyon zenginleştirme
 *     description: Veritabanındaki çok sayıda küfür kelimesi için varyasyon zenginleştirme işlemi çalıştırır
 *     tags:
 *       - Varyasyon Yönetimi
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 100
 *         description: İşlenecek maksimum kelime sayısı
 *     responses:
 *       200:
 *         description: Toplu zenginleştirme başarıyla tamamlandı
 *       429:
 *         description: Çok fazla istek
 *       500:
 *         description: Sunucu hatası
 */
router.post('/variations/bulk-enrich', highVolumeProcessingLimiter, requireAdminAuth, swearController.runBulkVariationEnrichment);

/**
 * AI Modelleri Endpointi
 * Desteklenen tüm yapay zeka modellerini listeler
 */
router.get('/models', (req, res) => {
  // Desteklenen modellerin listesi
  const supportedModels = [
    "gpt-4.5",
    "o3-mini",
    "claude-3-7-sonnet",
    "claude-3-5-sonnet", 
    "chatgpt-latest",
    "gpt-4o",
    "gpt-4",
    "gpt-4-turbo",
    "claude-v3-opus",
    "claude-3-haiku",
    "gemini-2.0-pro",
    "gemini-2.0-flash",
    "command-r-plus",
    "command-r"
  ];

  // OpenAI benzeri yanıt formatı
  const response = {
    object: "list",
    data: supportedModels.map(model => ({
      id: model,
      object: "model",
    }))
  };

  res.status(200).json(response);
});

module.exports = router;
