/**
 * API Yetkilendirme Middleware'i
 * 
 * API isteklerine yetkilendirme işlemi uygular. Admin işlemlerini sadece
 * doğru API anahtarına sahip kullanıcıların yapmasını sağlar.
 */

const { createServiceLogger } = require('../utils/loggerSetup');
const logger = createServiceLogger('auth-middleware');

// Admin API anahtarı
const ADMIN_API_KEY = 'Kynux3131';

/**
 * Admin API anahtarını kontrol eder
 * @param {*} req Express istek nesnesi
 * @param {*} res Express yanıt nesnesi
 * @param {*} next Sonraki middleware
 */
const requireAdminAuth = (req, res, next) => {
  // API anahtarını header'dan al
  const apiKey = req.header('X-API-KEY');
  
  if (!apiKey) {
    logger.warn('API anahtarı header\'da bulunamadı', { 
      path: req.path, 
      ip: req.ip 
    });
    
    return res.status(401).json({
      success: false,
      message: 'Bu işlem için yetkilendirme gerekiyor',
      error: 'API anahtarı sağlanmadı'
    });
  }
  
  // Admin API anahtarını kontrol et
  if (apiKey !== ADMIN_API_KEY) {
    logger.warn('Geçersiz API anahtarı', { 
      path: req.path, 
      ip: req.ip,
      providedKey: apiKey.substring(0, 3) + '****' // Güvenlik için anahtarın tamamını loglama
    });
    
    return res.status(403).json({
      success: false,
      message: 'Bu işlem için yetkiniz yok',
      error: 'Geçersiz API anahtarı'
    });
  }
  
  logger.info('Admin API kimlik doğrulaması başarılı', { 
    path: req.path, 
    ip: req.ip 
  });
  
  // API anahtarı doğru, işleme devam et
  next();
};

module.exports = {
  requireAdminAuth
};
