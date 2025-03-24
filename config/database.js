/**
 * Veritabanı Bağlantı Yapılandırması
 * MongoDB bağlantısını ve ortak yapılandırmaları yönetir
 * 
 * @module config/database
 */

const mongoose = require('mongoose');
const { createLogger, format, transports } = require('winston');
require('dotenv').config();

// Winston logger yapılandırması
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'database-config' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/db-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/database.log' })
  ]
});

/**
 * MongoDB'ye bağlanır ve bağlantıyı yapılandırır
 * @returns {Promise<mongoose.Connection>} MongoDB bağlantısı
 */
const connectDB = async () => {
  try {
    // MongoDB bağlantı URI'sini kontrol et
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI çevre değişkeni tanımlanmamış');
    }

    // Bağlantı seçenekleri
    const options = {
      // Mongoose 6+ için bağlantı seçenekleri
      // useNewUrlParser, useUnifiedTopology gibi seçenekler
      // artık varsayılan olduğundan belirtmeye gerek yok
    };

    // MongoDB'ye bağlan
    await mongoose.connect(uri, options);
    
    // Bağlantı olaylarını dinle
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB bağlantı hatası:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB bağlantısı kesildi');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB ile yeniden bağlantı kuruldu');
    });
    
    // Bağlantı tamamlandığında bilgi ver
    logger.info('MongoDB veritabanına başarıyla bağlandı');
    
    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB bağlantısı kurulamadı:', { 
      message: error.message,
      stack: error.stack
    });
    
    // Uygulama kritik bir bileşeni olmadan çalışamaz, 
    // bu nedenle process.exit kullanıyoruz
    process.exit(1);
  }
};

module.exports = {
  connectDB,
  logger
};
