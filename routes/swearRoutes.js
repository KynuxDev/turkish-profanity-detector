/**
 * Küfür Tespit API Rotaları
 */

const express = require('express');
const router = express.Router();
const swearController = require('../controllers/swearController');
const rateLimit = require('express-rate-limit');

// Hız sınırlayıcı (DDoS ve brute force saldırılarını önlemek için)
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

/**
 * @swagger
 * /api/swear/detect:
 *   get:
 *     summary: Metinde küfür/hakaret olup olmadığını tespit eder
 *     description: Verilen metin içerisinde küfür veya hakaret içeren kelimeler olup olmadığını tespit eder ve veritabanına kaydeder.
 *     tags:
 *       - Küfür Tespiti
 *     parameters:
 *       - in: query
 *         name: text
 *         required: true
 *         schema:
 *           type: string
 *         description: Kontrol edilecek metin
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
router.get('/detect', apiLimiter, swearController.detectSwear);

/**
 * @swagger
 * /api/swear/stats:
 *   get:
 *     summary: Küfür istatistiklerini getirir
 *     description: Veritabanındaki küfür kelimelerinin istatistiklerini getirir.
 *     tags:
 *       - Küfür Tespiti
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatisticsResponse'
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
router.get('/stats', apiLimiter, swearController.getStatistics);

module.exports = router;
