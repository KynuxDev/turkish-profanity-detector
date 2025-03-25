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
   * Olası karakter değişimleriyle varyasyonlar oluşturur - Gelişmiş algoritma
   * @param {string} word - Varyasyonları oluşturulacak kelime
   * @returns {Array<string>} Olası varyasyonlar
   */
  generatePossibleVariations(word) {
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
    
    // 1. Temel karakter değişimleri (tek karakter)
    this._applyCharacterReplacements(word, replacements, variations);
    
    // 2. Çoklu karakter değişimleri (birden fazla karakter aynı anda)
    this._applyMultipleReplacements(word, replacements, variations);
    
    // 3. Tekrarlanan karakterleri işleme (aaaaa -> a veya aa)
    this._handleRepeatedCharacters(word, variations);
    
    // 4. Boşluk ve noktalama ekleme/çıkarma varyasyonları
    this._handleSpacingVariations(word, variations);
    
    // 5. Tersine çevirme ve benzer kelimeler
    this._handleReverseAndSimilar(word, variations);
    
    // 6. Benzer sesler ve yazımlar
    this._handlePhoneticVariations(word, variations);
    
    return [...variations];
  }
  
  /**
   * Tek karakter değişimleri uygular
   * @private
   */
  _applyCharacterReplacements(word, replacements, variations) {
    // Tüm olası tek karakter değişimlerini oluştur
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const possibleReplacements = replacements[char] || [];
      
      for (const replacement of possibleReplacements) {
        const variation = word.substring(0, i) + replacement + word.substring(i + 1);
        variations.add(variation);
        
        // Büyük harf versiyonlarını da ekle
        if (replacement.length === 1) {
          const upperVariation = word.substring(0, i) + replacement.toUpperCase() + word.substring(i + 1);
          variations.add(upperVariation);
        }
      }
    }
  }
  
  /**
   * Çoklu karakter değişimleri uygular (kombinasyonları)
   * @private
   */
  _applyMultipleReplacements(word, replacements, variations) {
    // İlk turda oluşturulan varyasyonlar üzerinde ikinci değişim turu
    const firstLevelVariations = [...variations];
    
    // Her bir ilk seviye varyasyon için ek değişim uygula (daha karmaşık kombinasyonlar)
    for (const varWord of firstLevelVariations) {
      if (varWord === word) continue; // Orijinal kelimeyi atla
      
      for (let i = 0; i < varWord.length; i++) {
        const char = varWord[i].toLowerCase();
        const possibleReplacements = replacements[char] || [];
        
        // Sadece birkaç değişim uygula (kombinasyonel patlamayı önlemek için)
        const limitedReplacements = possibleReplacements.slice(0, 2);
        
        for (const replacement of limitedReplacements) {
          if (Math.random() < 0.3) { // Rastgele bazı kombinasyonları ekle (hepsini değil)
            const variation = varWord.substring(0, i) + replacement + varWord.substring(i + 1);
            variations.add(variation);
          }
        }
      }
    }
    
    // Rastgele karakter ekleme ve silme
    if (word.length > 3) {
      // Karakter silme: a[A]a -> aa
      for (let i = 1; i < word.length - 1; i++) {
        // Silme varyasyonu
        const deletion = word.substring(0, i) + word.substring(i + 1);
        variations.add(deletion);
      }
      
      // Karakter ekleme: aa -> a[X]a
      const commonChars = 'aeiouıöüy'; // Yaygın sesli harfler
      for (let i = 1; i < word.length; i++) {
        const randomChar = commonChars[Math.floor(Math.random() * commonChars.length)];
        const insertion = word.substring(0, i) + randomChar + word.substring(i);
        variations.add(insertion);
      }
    }
  }
  
  /**
   * Tekrarlanan karakterleri işler
   * @private
   */
  _handleRepeatedCharacters(word, variations) {
    // Tekrarlanan karakterleri sıkıştır (ör: aaaaa -> a)
    const compressedWord = word.replace(/(.)\1+/g, '$1');
    if (compressedWord !== word) {
      variations.add(compressedWord);
    }
    
    // Tekrarlanan karakterleri ikili grupla (ör: aaaaa -> aa)
    const doubleCompressed = word.replace(/(.)\1{2,}/g, '$1$1');
    if (doubleCompressed !== word && doubleCompressed !== compressedWord) {
      variations.add(doubleCompressed);
    }
    
    // Tek karakterli tekrarlar ekle (ör: as -> aas veya ass)
    for (let i = 0; i < word.length; i++) {
      const doubledChar = word.substring(0, i) + word[i] + word[i] + word.substring(i + 1);
      variations.add(doubledChar);
    }
  }
  
  /**
   * Boşluk ve noktalama işlemleri
   * @private
   */
  _handleSpacingVariations(word, variations) {
    // Boşluk eklemeli varyasyonlar
    for (let i = 1; i < word.length; i++) {
      // Ortaya boşluk ekle
      const withSpace = word.substring(0, i) + ' ' + word.substring(i);
      variations.add(withSpace);
      
      // Nokta ekleme
      const withDot = word.substring(0, i) + '.' + word.substring(i);
      variations.add(withDot);
    }
    
    // Kelimeleri birleştirme (eğer boşluk içeriyorsa)
    if (word.includes(' ')) {
      variations.add(word.replace(/\s+/g, ''));
    }
  }
  
  /**
   * Ters ve benzer kelime işlemleri
   * @private
   */
  _handleReverseAndSimilar(word, variations) {
    // Kelimeyi tersine çevirme (olası palindromlar için)
    const reversed = word.split('').reverse().join('');
    variations.add(reversed);
    
    // Karıştırılmış harfler (sadece kısa kelimeler için)
    if (word.length <= 6) {
      const shuffled = this._shuffleString(word);
      variations.add(shuffled);
    }
  }
  
  /**
   * Kelimenin karakterlerini karıştırır
   * @private
   */
  _shuffleString(str) {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }
  
  /**
   * Fonetik varyasyonlar oluşturur
   * @private
   */
  _handlePhoneticVariations(word, variations) {
    // Türkçe fonetik varyasyonlar
    const phoneticReplacements = {
      'ck': ['k'],
      'ch': ['ç'],
      'sh': ['ş'],
      'gh': ['ğ'],
      'ph': ['f'],
      'qu': ['k'],
      'x': ['ks'],
      'w': ['v'],
      'th': ['t'],
      'kh': ['h'],
      'dj': ['c'],
      'ae': ['e'],
      'oe': ['ö'],
      'ee': ['i'],
      'oo': ['u'],
      'y': ['i']
    };
    
    // Kelimenin içindeki fonetik kalıpları değiştir
    let phonetic = word;
    for (const [pattern, replacements] of Object.entries(phoneticReplacements)) {
      if (phonetic.includes(pattern)) {
        for (const repl of replacements) {
          variations.add(phonetic.replace(new RegExp(pattern, 'g'), repl));
        }
      }
    }
    
    // Türkçe ses benzerliği
    const commonPairs = [
      ['c', 'j'], ['s', 'z'], ['g', 'k'], ['d', 't'], ['b', 'p'], ['v', 'f']
    ];
    
    for (const [char1, char2] of commonPairs) {
      // char1 -> char2 değişimi
      if (word.includes(char1)) {
        variations.add(word.replace(new RegExp(char1, 'g'), char2));
      }
      
      // char2 -> char1 değişimi
      if (word.includes(char2)) {
        variations.add(word.replace(new RegExp(char2, 'g'), char1));
      }
    }
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
