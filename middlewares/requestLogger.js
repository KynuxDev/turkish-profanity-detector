/**
 * İstek Loglama Middleware'i
 * 
 * Gelen HTTP isteklerini loglar, bu sayede API kullanımını izleyebilir
 * ve hata ayıklamayı kolaylaştırabiliriz.
 * 
 * @module middlewares/requestLogger
 */

const { createServiceLogger } = require('../utils/loggerSetup');

// İstek logu için özel logger oluştur
const logger = createServiceLogger('http-requests', { 
  consoleLevel: 'http' 
});

/**
 * HTTP isteklerini loglayan middleware
 * Her istek için yol, metot, durum kodu ve yanıt süresini kaydeder
 * 
 * @param {Object} req - Express istek nesnesi
 * @param {Object} res - Express yanıt nesnesi
 * @param {Function} next - Sonraki middleware fonksiyonu
 */
const requestLogger = (req, res, next) => {
  // İstek başlangıç zamanı
  const startTime = Date.now();
  
  // İstek bilgilerini topla
  const requestInfo = {
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };
  
  // İstek parametrelerini ekle (güvenlik için daha fazla filtreleme gerekebilir)
  if (req.method === 'GET') {
    // GET parametrelerini ekle, hassas verileri filtrele
    const safeQuery = { ...req.query };
    
    // Hassas parametreleri maskele (örn: API anahtarları, parolalar)
    ['password', 'token', 'api_key', 'apikey', 'key', 'secret'].forEach(param => {
      if (safeQuery[param]) {
        safeQuery[param] = '***filtered***';
      }
    });
    
    requestInfo.query = safeQuery;
  }
  
  // İstek başlangıcını logla
  logger.http(`İstek alındı: ${req.method} ${req.originalUrl}`, requestInfo);
  
  // Orijinal res.end fonksiyonunu sakla
  const originalEnd = res.end;
  
  // Yanıt tamamlandığında çalışacak fonksiyon
  res.end = function(chunk, encoding) {
    // Orijinal res.end'i çağır
    originalEnd.call(this, chunk, encoding);
    
    // Yanıt süresini hesapla
    const responseTime = Date.now() - startTime;
    
    // Yanıt bilgilerini ekle
    const responseInfo = {
      ...requestInfo,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    };
    
    // Durum koduna göre log seviyesini belirle
    if (res.statusCode >= 500) {
      logger.error(`Yanıt: ${res.statusCode} (${responseTime}ms)`, responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn(`Yanıt: ${res.statusCode} (${responseTime}ms)`, responseInfo);
    } else {
      logger.http(`Yanıt: ${res.statusCode} (${responseTime}ms)`, responseInfo);
    }
  };
  
  // Sonraki middleware'e geç
  next();
};

module.exports = requestLogger;
