/**
 * Küfür Tespit Servisi - Ultra Sınırsız Varyasyon Algılama
 * 
 * Verilen metni analiz ederek küfür içerip içermediğini belirler,
 * metin içindeki olası küfürleri tespit eder ve veritabanında yönetir.
 * Gelişmiş varyasyon algoritmaları, yapay zeka entegrasyonu ve sınırsız varyasyon desteği içerir.
 * 
 * @module services/swearDetectionService
 */

const SwearWord = require('../models/swearWord');
const varyasyonService = require('./varyasyonService');
const { createLogger, format, transports } = require('winston');
const path = require('path');

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
   * Kelimeyi benzer yazılışları değerlendirerek kontrol eder - Ultra Genişletilmiş Sürüm
   * Önbellek ve veritabanı optimizasyonları ile varyasyon servisi entegrasyonu
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
              $inc: { 'stats.detectionCount': 1 },
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
      // Adım 1: Direkt Veritabanı Kontrolü
      // Bu en hızlı eşleşme yoludur, direkt kelimeyi veya bilinen bir varyasyonu bulur
      let swearWord = await SwearWord.findByWord(word);
      
      // Eğer direkt eşleşme bulunduysa
      if (swearWord) {
        logger.debug(`Küfür tespit edildi: "${word}"`);
        
        // Tespit sayısını ve tarihini güncelle
        await swearWord.updateOne({
          $inc: { 'stats.detectionCount': 1 },
          $set: { lastDetectedAt: new Date() }
        });
        
        const result = { isSwear: true, swearWord };
        
        // Önbelleğe ekle
        swearWordCache.set(word, { result, timestamp: Date.now() });
        
        return result;
      }
      
      // Adım 2: Temel Varyasyon Kontrolü
      // Önceden oluşturulmuş ve veritabanında saklanmış tüm varyasyonları kontrol et
      // Bu adımda VaryasyonService'i kullanarak veritabanındaki tüm kelimeler ve onların varyasyonlarını kontrol ediyoruz
      // Bu nedenle önce veritabanından tüm olası varyasyonları alıyoruz (sadece o kelime için değil, tüm benzer kelimeler için)
      const dbVariations = await varyasyonService.getAllVariationsFromDB(word);
      
      if (dbVariations.length > 0) {
        // Bulunan ilk kelimeyi veritabanından getir
        swearWord = await SwearWord.findByWord(dbVariations[0]);
        
        if (swearWord) {
          logger.debug(`Veritabanı varyasyonu üzerinden küfür tespit edildi: "${word}" -> "${dbVariations[0]}"`);
          
          // Yeni varyasyon ekle ve güncelle (kelime varyasyon olarak öğrensin)
          await swearWord.updateWithVariations([word]);
          
          const result = { isSwear: true, swearWord };
          
          // Önbelleğe ekle
          swearWordCache.set(word, { result, timestamp: Date.now() });
          return result;
        }
      }
      
      // Adım 3: Algoritmik Varyasyon Kontrolü
      // İlk iki adımda bulunamadıysa, üretilen olası tüm varyasyonları kontrol et
      logger.debug(`Algoritmik ve AI varyasyonlar oluşturuluyor: "${word}"`);
      const possibleVariations = this.generatePossibleVariations(word);
      
      for (const variation of possibleVariations) {
        if (variation === word) continue; // Kendisini tekrar kontrol etme
        
        // MongoDB'de bu varyasyonu ara
        swearWord = await SwearWord.findByWord(variation);
        if (swearWord) {
          logger.debug(`Varyasyon üzerinden küfür tespit edildi: "${word}" -> "${variation}"`);
          
          // Kelimeyi ve bu varyasyonla ilgili diğer tüm varyasyonları öğren
          // Bu, veritabanı yükünü artırabilir, bu yüzden arkaplanda yapıyoruz
          setTimeout(async () => {
            try {
              // Yeni tespit edilen kelimeyi ve varyasyonu sakla
              await swearWord.updateWithVariations([word]);
              
              // VaryasyonService ile zenginleştirme yap
              await varyasyonService.enrichVariations(swearWord.word, {
                useAI: true, 
                category: swearWord.category,
                source: 'varyasyon_eşleşmesi'
              });
              
              logger.info(`Yeni tespit edilen küfür varyasyonu veritabanına eklendi ve zenginleştirildi: "${word}"`);
            } catch (enrichError) {
              logger.error(`Varyasyon zenginleştirme hatası: ${enrichError.message}`);
            }
          }, 50); // Minimum gecikme ile arkaplanda çalıştır
          
          const result = { isSwear: true, swearWord };
          
          // Önbelleğe ekle (hem orijinal kelime hem de varyasyon için)
          swearWordCache.set(word, { result, timestamp: Date.now() });
          if (!swearWordCache.has(variation)) {
            swearWordCache.set(variation, { result, timestamp: Date.now() });
          }
          
          return result;
        }
      }
      
      // Adım 4: Küfür olmadığı tespit edildi
      // Sonucu önbelleğe kaydet
      const result = { isSwear: false, swearWord: null };
      swearWordCache.set(word, { result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      logger.error(`Kelime kontrolü sırasında hata: ${error.message}`, { word, stack: error.stack });
      return { isSwear: false, swearWord: null };
    }
  }
  
  /**
   * Olası karakter değişimleriyle varyasyonlar oluşturur - Ultra Genişletilmiş Sürüm (SINIRSIZ)
   * VaryasyonService entegrasyonu ile tamamen sınırsız varyasyon desteği
   * 
   * @param {string} word - Varyasyonları oluşturulacak kelime
   * @returns {Array<string>} Tüm olası varyasyonlar - hiçbir sınırlama olmadan
   */
  generatePossibleVariations(word) {
    // VaryasyonService'i kullanarak algoritmik varyasyonları oluştur
    const algorithmicVariations = varyasyonService.generateAlgorithmicVariations(word);
    
    // Kendi içsel varyasyon oluşturma yöntemlerimizle zenginleştir
    const internalVariations = this._generateInternalVariations(word);
    
    // Tüm varyasyonları birleştir - HİÇBİR SINIRLAMA OLMADAN
    const allVariations = new Set([
      ...algorithmicVariations,
      ...internalVariations
    ]);
    
    // Orijinal kelimeyi hariç tut ama sıralama veya sayı sınırlaması yapma
    const finalVariations = [...allVariations].filter(v => v !== word);
    
    logger.debug(`"${word}" için ${algorithmicVariations.length} algoritmik ve ${internalVariations.length} dahili, toplam ${finalVariations.length} varyasyon oluşturuldu - SINIRSIZ MOD`);
    
    // Tüm varyasyonları döndür - hiçbir sınırlama olmadan
    return [word, ...finalVariations];
  }

  /**
   * İçsel varyasyon üretme algoritmaları (geriye dönük uyumluluk için korundu)
   * @param {string} word - Varyasyonları oluşturulacak kelime
   * @returns {Array<string>} Dahili algoritmayla oluşturulan varyasyonlar
   * @private
   */
  _generateInternalVariations(word) {
    // Ana varyasyonlar kümesini oluştur
    const variations = new Set([word]);
    
    // Türkçe karakterleri de içeren yaygın karakter değişimleri
    const replacements = {
      'a': ['@', '4', 'ä', 'á', 'â', 'à', 'æ'],
      'b': ['8', '6', 'ß'],
      'c': ['ç', 'č', '¢', '('],
      'ç': ['c', 'ch'],
      'd': ['t', 'ð'],
      'e': ['3', '€', 'ë', 'é', 'ê', 'è'],
      'g': ['ğ', '9', '6', 'q'],
      'ğ': ['g', 'gh'],
      'h': ['#', '4'],
      'i': ['1', '!', 'ı', 'í', 'î', 'ï', '|', '¡', ']'],
      'ı': ['i', '1', '!'],
      'j': ['y'],
      'k': ['q', 'c'],
      'l': ['1', '|', '¦', 'ł'],
      'm': ['nn', 'rn'],
      'n': ['ñ'],
      'o': ['0', 'ö', 'ø', 'ó', 'ô', 'ò', 'õ'],
      'ö': ['o', '0'],
      'p': ['þ'],
      'q': ['9'],
      'r': ['®'],
      's': ['5', '$', 'ş', 'ß', 'z'],
      'ş': ['s', 'sh'],
      't': ['7', '+'],
      'u': ['ü', 'ú', 'û', 'ù', 'µ'],
      'ü': ['u'],
      'v': ['w', '\/\/'],
      'w': ['v', '\/\/'],
      'x': ['×', 'ж', 'ks'],
      'y': ['j', 'ÿ'],
      'z': ['s', '2']
    };
    
    // Temel karakter değişimleri
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const possibleReplacements = replacements[char] || [];
      
      for (const replacement of possibleReplacements) {
        variations.add(word.substring(0, i) + replacement + word.substring(i + 1));
      }
    }
    
    // Tekrarlanan karakter işlemleri
    const compressedWord = word.replace(/(.)\1+/g, '$1');
    if (compressedWord !== word) {
      variations.add(compressedWord);
    }
    
    // Boşluk işlemleri
    if (word.includes(' ')) {
      variations.add(word.replace(/\s+/g, ''));
    }
    
    return [...variations];
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
