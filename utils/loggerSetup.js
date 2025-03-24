/**
 * Loglama Yapılandırması
 * Winston logger yapılandırmasını ve log dizinlerini oluşturur
 * 
 * @module utils/loggerSetup
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

// Log dizinini oluştur
const createLogDir = () => {
  const logDir = path.join(process.cwd(), 'logs');
  
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir);
      console.log('Logs dizini oluşturuldu:', logDir);
    } catch (error) {
      console.error('Logs dizini oluşturulamadı:', error.message);
    }
  }
  
  return logDir;
};

// Loglama seviyelerini ayarla
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  },
};

/**
 * Servis için logger oluştur
 * @param {string} serviceName - Servis adı
 * @param {Object} options - İsteğe bağlı yapılandırma seçenekleri
 * @returns {winston.Logger} Yapılandırılmış logger
 */
const createServiceLogger = (serviceName, options = {}) => {
  // Log dizinini oluştur
  createLogDir();
  
  // Varsayılan log seviyeleri
  const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  
  // Format tanımlamaları
  const baseFormat = format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.errors({ stack: true }),
    format.splat()
  );
  
  // Konsol formatı
  const consoleFormat = format.combine(
    baseFormat,
    format.colorize({ all: true }),
    format.printf(({ timestamp, level, message, service, ...rest }) => {
      const restString = Object.keys(rest).length > 0 
        ? `\n${JSON.stringify(rest, null, 2)}` 
        : '';
      return `[${timestamp}] ${level} [${service}]: ${message}${restString}`;
    })
  );
  
  // Dosya formatı (JSON)
  const fileFormat = format.combine(
    baseFormat,
    format.json()
  );
  
  // Loggerı oluştur
  return createLogger({
    level: options.level || logLevel,
    levels: logLevels.levels,
    format: baseFormat,
    defaultMeta: { service: serviceName },
    transports: [
      // Konsol transport
      new transports.Console({
        format: consoleFormat,
        level: options.consoleLevel || 'debug',
      }),
      
      // Hata dosyası
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: fileFormat,
      }),
      
      // Servis özel log dosyası
      new transports.File({
        filename: `logs/${serviceName}.log`,
        format: fileFormat,
      }),
      
      // Tüm loglar
      new transports.File({
        filename: 'logs/combined.log',
        format: fileFormat,
      }),
    ],
  });
};

module.exports = {
  createLogDir,
  createServiceLogger,
};
