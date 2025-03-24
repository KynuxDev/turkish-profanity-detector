/**
 * Küfür Tespit Servisi
 * 
 * Verilen metni analiz ederek küfür içerip içermediğini belirler,
 * metin içindeki olası küfürleri tespit eder ve veritabanında yönetir.
 * Gelişmiş varyasyon algoritmaları ve optimizasyonlar içerir.
 * 
 * @module services/swearDetectionService
 */

const SwearWord = require('../models/swearWord');
const { createLogger, format, transports } = require('winston');

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
  defaultMeta: { service: 'swear-detection-service' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/detection.log' })
  ]
});

// İşlemleri hızlandırmak için kelime önbelleği
const CACHE_TTL = 60 * 60 * 1000; // 1 saat
const swearWordCache = new Map(); // { kelime: { sonuç, timestamp } }

class SwearDetectionService {
  constructor() {
    // Periyodik önbellek temizleme
    setInterval(() => this.cleanCache(), CACHE_TTL);
  }
  
  /**
   * Önbelleği temizler (eski girişleri kaldırır)
   * @private
   */
  cleanCache() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, value] of swearWordCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        swearWordCache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.info(`Önbellekten ${expiredCount} süresi dolmuş küfür kaydı temizlendi`);
    }
  }
  /**
   * Metni analiz eder ve küfür içerip içermediğini kontrol eder
   * @param {string} text - Kontrol edilecek metin
   * @returns {Promise<{isSwear: boolean, result: Object, detectedWords: Array}>} Tespit sonuçları
   */
  async analyzeText(text) {
    if (!text || typeof text !== 'string') {
      return { isSwear: false, result: null, detectedWords: [] };
    }

    // Metni küçük harfe çevir ve noktalama işaretlerini temizle
    const normalizedText = this.normalizeText(text);
    
    // Metni kelimelere ayır
    const words = normalizedText.split(/\s+/);
    
    // Tespit edilen küfürler
    const detectedWords = [];
    
    // Her kelimeyi kontrol et
    for (const word of words) {
      if (word.length < 2) continue; // Çok kısa kelimeleri atla
      
      const result = await this.checkWord(word);
      if (result.isSwear) {
        detectedWords.push({
          original: word,
          swearWord: result.swearWord
        });
      }
    }
    
    return {
      isSwear: detectedWords.length > 0,
      result: detectedWords.length > 0 ? detectedWords[0].swearWord : null,
      detectedWords
    };
  }
  
  /**
   * Metni normalleştirir (küçük harf, noktalama temizleme)
   * @param {string} text - Normalleştirilecek metin
   * @returns {string} Normalleştirilmiş metin
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\wğüşıöçĞÜŞİÖÇ\s]/g, '') // Türkçe karakterler korunarak noktalama temizlenir
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Kelimeyi benzer yazılışları değerlendirerek kontrol eder
   * Önbellek kullanarak performansı artırır
   * 
   * @param {string} word - Kontrol edilecek kelime
   * @returns {Promise<{isSwear: boolean, swearWord: Object}>} Tespit sonucu
   */
  async checkWord(word) {
    if (!word || word.length < 2) {
      return { isSwear: false, swearWord: null };
    }
    
    // Önbellekte kontrol et
    if (swearWordCache.has(word)) {
      const cached = swearWordCache.get(word);
      logger.debug(`Önbellekten kelime bulundu: "${word}"`);
      
      // Önbellekte bulunan kelime bir küfür ise, tespit sayısını güncelle
      if (cached.result.isSwear) {
        try {
          await SwearWord.updateOne(
            { _id: cached.result.swearWord._id },
            { 
              $inc: { detectionCount: 1 },
              $set: { lastDetectedAt: new Date() }
            }
          );
        } catch (error) {
          logger.error(`Tespit sayısı güncellenirken hata: ${error.message}`);
        }
      }
      
      return cached.result;
    }
    
    try {
      // Temel kontrol
      let swearWord = await SwearWord.findByWord(word);
      
      // Eğer direkt eşleşme bulunduysa
      if (swearWord) {
        logger.debug(`Küfür tespit edildi: "${word}"`);
        
        // Tespit sayısını artır
        await swearWord.updateOne({
          $inc: { detectionCount: 1 },
          $set: { lastDetectedAt: new Date() }
        });
        
        const result = { isSwear: true, swearWord };
        
        // Önbelleğe ekle
        swearWordCache.set(word, { result, timestamp: Date.now() });
        
        return result;
      }
      
      // Temel sansürleme teknikleri kontrolü (örn: a -> @, o -> 0)
      logger.debug(`Varyasyonlar oluşturuluyor: "${word}"`);
      const possibleVariations = this.generatePossibleVariations(word);
      
      for (const variation of possibleVariations) {
        if (variation === word) continue; // Kendisini tekrar kontrol etme
        
        swearWord = await SwearWord.findByWord(variation);
        if (swearWord) {
          logger.debug(`Varyasyon üzerinden küfür tespit edildi: "${word}" -> "${variation}"`);
          
          // Yeni varyasyon ekle ve güncelle
          await swearWord.updateWithVariations([word]);
          
          const result = { isSwear: true, swearWord };
          
          // Önbelleğe ekle (hem orijinal kelime hem de varyasyon için)
          swearWordCache.set(word, { result, timestamp: Date.now() });
          if (!swearWordCache.has(variation)) {
            swearWordCache.set(variation, { result, timestamp: Date.now() });
          }
          
          return result;
        }
      }
      
      // Küfür değil - sonucu önbelleğe kaydet
      const result = { isSwear: false, swearWord: null };
      swearWordCache.set(word, { result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      logger.error(`Kelime kontrolü sırasında hata: ${error.message}`, { word, stack: error.stack });
      return { isSwear: false, swearWord: null };
    }
  }
  
  /**
   * Olası karakter değişimleriyle varyasyonlar oluşturur
   * @param {string} word - Varyasyonları oluşturulacak kelime
   * @returns {Array<string>} Olası varyasyonlar
   */
  generatePossibleVariations(word) {
    const variations = [word];
    
    // Yaygın karakter değişimlerini tanımla
    const replacements = {
      'a': ['@', '4'],
      'e': ['3'],
      'i': ['1', '!'],
      'o': ['0'],
      's': ['5', '$'],
      'ş': ['s'],
      'ç': ['c'],
      'ğ': ['g'],
      'ü': ['u'],
      'ö': ['o'],
      'ı': ['i']
    };
    
    // Tüm olası tek karakter değişimlerini oluştur
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const possibleReplacements = replacements[char] || [];
      
      for (const replacement of possibleReplacements) {
        const variation = word.substring(0, i) + replacement + word.substring(i + 1);
        variations.push(variation);
      }
    }
    
    // Tekrarlanan karakterleri sıkıştır (ör: aaaaa -> a)
    const compressedWord = word.replace(/(.)\1+/g, '$1');
    if (compressedWord !== word) {
      variations.push(compressedWord);
    }
    
    return variations;
  }
  
  /**
   * Yeni bir küfür kelimesini veritabanına kaydeder
   * @param {string} word - Kaydedilecek küfür kelimesi
   * @param {Object} options - Ek bilgiler (kategori, şiddet seviyesi, vb.)
   * @returns {Promise<Object>} Kaydedilen küfür kelimesi
   */
  async saveNewSwearWord(word, options = {}) {
    if (!word) return null;
    
    const normalizedWord = word.toLowerCase().trim();
    
    // Kelime zaten var mı kontrol et
    let existing = await SwearWord.findByWord(normalizedWord);
    if (existing) {
      // Varsa sadece tespit sayısını artır
      return existing.updateOne({
        $inc: { detectionCount: 1 },
        $set: { lastDetectedAt: new Date() }
      });
    }
    
    // Yeni kelime oluştur
    const newSwearWord = new SwearWord({
      word: normalizedWord,
      variations: options.variations || [],
      category: options.category || 'diğer',
      severityLevel: options.severityLevel || 3,
      alternatives: options.alternatives || []
    });
    
    return newSwearWord.save();
  }
}

module.exports = new SwearDetectionService();
