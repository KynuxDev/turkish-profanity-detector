/**
 * Küfür Tespit API Sunucusu
 * Express, MongoDB ve OpenAI kullanarak bir küfür tespit API'si sağlar
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const { swaggerUI, swaggerDocs, swaggerUIOptions } = require('./swagger');
const swearRoutes = require('./routes/swearRoutes');

// Logger ayarlarını yükle
const { createServiceLogger, createLogDir } = require('./utils/loggerSetup');

// API servisi için loglayıcı oluştur
const logger = createServiceLogger('api-server');

// Express uygulaması oluştur
const app = express();
const port = process.env.PORT || 3000;

// Proxy güvenliği için gerekli ayar - X-Forwarded-For başlıklarını güvenilir kabul et
// Bu ayar express-rate-limit'in kullanıcıları doğru tanımlaması için gereklidir
app.set('trust proxy', 1); // 1 = trust first proxy

// Log dizinini oluştur
createLogDir();

// Veritabanı bağlantısı
const { connectDB } = require('./config/database');

// MongoDB'ye bağlan
connectDB()
  .then(() => {
    logger.info('MongoDB bağlantısı başarılı');
  })
  .catch(err => {
    logger.error('MongoDB bağlantı hatası:', { error: err.message, stack: err.stack });
    process.exit(1);
  });

// İstek loglama middleware'i
const requestLogger = require('./middlewares/requestLogger');

// Güvenlik middleware'leri
app.use(helmet()); // Güvenlik başlıkları
app.use(cors()); // CORS desteği
app.use(express.json({ limit: '10kb' })); // JSON body parser ile boyut limiti
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize()); // NoSQL injection koruması
app.use(hpp()); // HTTP Parametre Kirliliği koruması
app.use(compression()); // Yanıt sıkıştırma

// İstek loglama - middleware'lerin ve rota işleyicilerinin arasında olmalı
app.use(requestLogger);

// Genel API limiti (DDoS koruması)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına 15 dakikada maksimum 100 istek
  standardHeaders: true,
  message: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'
});
app.use('/api', limiter);

// Swagger dokümantasyonu - modern UI ile
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs, swaggerUIOptions));

// API rotaları
app.use('/api/swear', swearRoutes);

// Örnek sağlık kontrolü
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Küfür Tespit API sunucusu çalışıyor'
  });
});

// 404 - Bulunamadı
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `${req.originalUrl} yolu bulunamadı`
  });
});

// Merkezi hata işleme middleware'i
const { errorHandler } = require('./middlewares/errorHandler');

// Genel hata yakalayıcı
app.use(errorHandler);

// Sunucuyu başlat
app.listen(port, () => {
  logger.info(`Küfür Tespit API sunucusu http://localhost:${port} adresinde çalışıyor`);
});

// Beklenmeyen hatalar için
process.on('unhandledRejection', err => {
  logger.error('İşlenmemiş Promise reddi:', { 
    error: err.message, 
    stack: err.stack 
  });
  logger.warn('Sunucu kapatılıyor...');
  process.exit(1);
});

process.on('uncaughtException', err => {
  logger.error('Yakalanmamış hata:', { 
    error: err.message, 
    stack: err.stack 
  });
  logger.warn('Sunucu kapatılıyor...');
  process.exit(1);
});
