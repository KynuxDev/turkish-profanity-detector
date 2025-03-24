/**
 * Merkezi Hata İşleme Middleware'i
 * 
 * Express uygulamasında oluşan tüm hataları yakalar ve standart
 * bir format ile kullanıcıya ve loglara iletir.
 * 
 * @module middlewares/errorHandler
 */

const { createServiceLogger } = require('../utils/loggerSetup');

// Hata logu için özel logger oluştur
const logger = createServiceLogger('error-handler');

/**
 * Özel API Hatası sınıfı
 * Tüm uygulama genelinde tutarlı hata mesajları için kullanılabilir
 */
class APIError extends Error {
  /**
   * @param {string} message - Hata mesajı
   * @param {number} statusCode - HTTP durum kodu
   * @param {boolean} isOperational - İşlemsel hata mı (true) yoksa programlama hatası mı (false)
   * @param {string} [code] - Hata kodu (opsiyonel)
   */
  constructor(message, statusCode, isOperational = true, code = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational; // İşlemsel hata mı yoksa programlama hatası mı
    this.code = code; // Özel hata kodu
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Hata formatını standartlaştıran yardımcı fonksiyon
 * @private
 */
const formatError = (err) => {
  return {
    status: err.status || 'error',
    statusCode: err.statusCode || 500,
    message: err.message || 'Bir hata oluştu',
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    isOperational: err.isOperational
  };
};

/**
 * Standart olmayan hataları API hatasına dönüştürür
 * @private
 */
const normalizeError = (err) => {
  // Zaten APIError türündeyse olduğu gibi döndür
  if (err instanceof APIError) return err;

  // MongoDB doğrulama hataları
  if (err.name === 'ValidationError') {
    return new APIError(
      `Doğrulama hatası: ${err.message}`,
      400,
      true,
      'VALIDATION_ERROR'
    );
  }

  // MongoDB duplicate key hatası
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return new APIError(
      `${field} değeri zaten kullanılıyor: ${err.keyValue[field]}`,
      409,
      true,
      'DUPLICATE_KEY'
    );
  }

  // JSON ayrıştırma hataları
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new APIError(
      'Geçersiz JSON formatı',
      400,
      true,
      'INVALID_JSON'
    );
  }

  // Bilinmeyen hatalar
  return new APIError(
    err.message || 'Sunucu hatası',
    err.statusCode || 500, 
    false // İşlemsel olmayan hata
  );
};

/**
 * Hataları yakalayan ve işleyen merkezi hata işleyici middleware
 * 
 * @param {Error} err - Hata nesnesi
 * @param {Object} req - Express istek nesnesi
 * @param {Object} res - Express yanıt nesnesi
 * @param {Function} next - Sonraki middleware fonksiyonu
 */
const errorHandler = (err, req, res, next) => {
  // Hata nesnesini normalize et
  const normalizedError = normalizeError(err);
  
  // Hatayı logla
  const logLevel = normalizedError.isOperational ? 'warn' : 'error';
  logger[logLevel]('Hata yakalandı:', { 
    error: normalizedError.message,
    statusCode: normalizedError.statusCode,
    code: normalizedError.code,
    stack: normalizedError.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    isOperational: normalizedError.isOperational
  });
  
  // İstemciye yanıt gönder
  const formattedError = formatError(normalizedError);
  
  res.status(formattedError.statusCode).json({
    status: formattedError.status,
    message: formattedError.message,
    code: formattedError.code,
    stack: formattedError.stack
  });
};

module.exports = {
  errorHandler,
  APIError
};
