/**
 * Küfür Varyasyon Yönetim Servisi
 * 
 * Bu servis, küfür kelimelerinin varyasyonlarını akıllı şekilde yönetir, genişletir ve saklar.
 * Hem veritabanından hem yapay zekadan beslenen hibrit bir varyasyon yönetim sistemi sunar.
 * 
 * @module services/varyasyonService
 */

const SwearWord = require('../models/swearWord');
const { createLogger, format, transports } = require('winston');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

// Winston logger yapılandırması
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'varyasyon-service' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ 
      filename: path.join('logs', 'varyasyon.log'),
      level: 'info'
    }),
    new transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error' 
    })
  ]
});

// API istemcisi yapılandırması
let client;

try {
  client = new OpenAI({
    apiKey: process.env.API_KEY || '',
    baseURL: process.env.AI_API_BASE_URL || 'https://api.claude.gg/v1'
  });
} catch (error) {
  logger.error('OpenAI istemci oluşturma hatası:', error);
}

// Desteklenen modeller
const SUPPORTED_MODELS = [
  'claude-3-haiku',
  'o3-mini',
  'claude-3-7-sonnet',
  'gpt-4.5',
  'gemini-2.0-pro',
  'chatgpt-latest'
];

// Varsayılan model
const DEFAULT_MODEL = 'gpt-4.5';

/**
 * Türkçe küfür kelimelerinin varyasyonlarını yöneten sınıf
 */
class VaryasyonService {
  constructor() {
    // Varyasyon üretim istatistikleri
    this.stats = {
      totalVariations: 0,
      aiGeneratedVariations: 0,
      algorithmicVariations: 0,
      uniquePatterns: new Set(),
      topBaseWords: new Map()
    };
    
    // Periyodik istatistik loglama
    setInterval(() => this._logStats(), 24 * 60 * 60 * 1000); // Günlük log
    
    // Bilinen karakter değişim kalıpları
    this.charPatterns = this._initCharPatterns();
    
    // Öğrenilen kalıplar
    this.learnedPatterns = new Map();
  }
  
  /**
   * Karakter değişim kalıplarını başlatır - Genişletilmiş Sürüm
   * @private
   */
  _initCharPatterns() {
    return {
      // Türkçe karakterleri ve değişimleri - Kapsamlı Varyasyon Seti
      a: ['@', '4', 'ä', 'á', 'â', 'à', 'æ', '*', 'α', 'а', 'ą', 'å', '/\\', '/-\\', '∂', 'ª', 'ä', 'ą', 'ⓐ', '⒜', 'Ⓐ', 'ａ'],
      b: ['8', '6', 'ß', '|3', 'ь', 'в', 'б', '|>', '|:', '|8', 'ß', 'Ь', '฿', 'þ', 'ℬ', 'ⓑ', '⒝', 'Ⓑ', 'ｂ'],
      c: ['ç', 'č', '¢', '(', '<', 'с', 'ć', 'ҫ', '{', '©', '¢', 'ς', '＜', 'ⓒ', '⒞', 'Ⓒ', 'ｃ'],
      ç: ['c', 'ch', 'tch', 'č', 'ҫ', 's', 'ts', 'cz', 'tj', 'ⓒ⒴', 'č'],
      d: ['t', 'ð', 'đ', '|)', '|]', 'ď', 'đ', 'ı>', 'o|', '[)', 'ð', 'ẟ', 'ⓓ', '⒟', 'Ⓓ', 'ｄ'],
      e: ['3', '€', 'ë', 'é', 'ê', 'è', 'ε', 'е', 'ə', 'ę', 'ė', '[-', '£', 'ℯ', 'ℰ', 'ⓔ', '⒠', 'Ⓔ', 'ｅ'],
      f: ['ph', 'ƒ', '|=', 'φ', 'ф', '(f)', '₣', 'ⓕ', '⒡', 'Ⓕ', 'ｆ'],
      g: ['ğ', '9', '6', 'q', 'ǧ', 'ģ', 'г', 'ɠ', '&', 'gee', 'ⓖ', '⒢', 'Ⓖ', 'ｇ'],
      ğ: ['g', 'gh', 'ǧ', 'q', 'gu', 'guh', 'gj', 'ⓖ'],
      h: ['#', '4', '|-|', 'н', 'ħ', 'ĥ', 'ћ', '[-]', ']-[', '}-{', '(-)', 'ꓧ', 'ⓗ', '⒣', 'Ⓗ', 'ｈ'],
      i: ['1', '!', 'ı', 'í', 'î', 'ï', '|', '¡', ']', '|', 'ί', 'и', 'і', ':', ';', 'ⓘ', '⒤', 'Ⓘ', 'ｉ', 'ī', 'ĭ', '𝒊'],
      ı: ['i', '1', '!', 'ί', 'и', 'і', '|', '!', 'l', 'ⓘ', ':'],
      j: ['y', 'ј', 'ζ', '_|', 'й', 'ʝ', 'ⓙ', '⒥', 'Ⓙ', 'ｊ', 'ſ'],
      k: ['q', 'c', '|<', 'к', 'κ', '|{', '|c', 'ⓚ', '⒦', 'Ⓚ', 'ｋ', '|{', 'ʞ', '|<'],
      l: ['1', '|', '¦', 'ł', '£', '|_', 'л', '7', '|', '£', '1', '|_', 'ⓛ', '⒧', 'Ⓛ', 'ｌ', 'ḷ', 'ℓ'],
      m: ['nn', 'rn', '|v|', 'м', 'м', '^/^', '/\\/\\', '/|\\', '|\\/|', '^^', 'ⓜ', '⒨', 'Ⓜ', 'ｍ', '/V\\'],
      n: ['ñ', 'η', 'и', 'ñ', 'п', '/\\/', '^/', 'ⓝ', '⒩', 'Ⓝ', 'ｎ', 'ᾐ', 'ℵ', '|\|'],
      o: ['0', 'ö', 'ø', 'ó', 'ô', 'ò', 'õ', '()', '*', 'о', 'ð', '[]', '<>', '°', 'ⓞ', '⒪', 'Ⓞ', 'ｏ', 'ø'],
      ö: ['o', '0', 'ø', 'ð', 'oe', 'ø', 'ȫ', 'ⓞⓔ', '⒪⒠'],
      p: ['þ', '|°', '|>', 'п', 'р', '|o', '|*', '|^', 'ⓟ', '⒫', 'Ⓟ', 'ｐ', '|"', '¶', '₱'],
      q: ['9', 'ԛ', 'φ', 'ⓠ', '⒬', 'Ⓠ', 'ｑ', 'ҩ', 'φ', '¶', 'ƍ'],
      r: ['®', 'я', 'ř', 'ŕ', 'р', '|2', '|?', '/2', '|-', 'ⓡ', '⒭', 'Ⓡ', 'ｒ'],
      s: ['5', '$', 'ş', 'ß', 'z', 'с', 'ѕ', 'š', '$', 'ⓢ', '⒮', 'Ⓢ', 'ｓ', 'ʂ'],
      ş: ['s', 'sh', 'š', 'sch', 'shh', 'ⓢⓗ', 'ⓢ̧'],
      t: ['7', '+', '†', 'т', 'τ', '-|-', "']['", '†', 'ⓣ', '⒯', 'Ⓣ', 'ｔ'],
      u: ['ü', 'ú', 'û', 'ù', 'µ', '|_|', 'у', 'ц', 'ⓤ', '⒰', 'Ⓤ', 'ｕ', 'บ', 'ū', 'υ', 'µ', 'ʉ', 'ủ'],
      ü: ['u', 'ü', 'ù', 'ú', 'û', 'ue', 'ⓤⓔ', '⒰⒠', 'μ', 'ỹ'],
      v: ['w', '\\/\\/', 'ν', 'в', '\\/', '|/', '\\/\\', 'ⓥ', '⒱', 'Ⓥ', 'ｖ'],
      w: ['v', '\\/\\/', 'ω', 'ш', 'щ', '\\^/', '\\/\\/', '\\|\\|', 'ⓦ', '⒲', 'Ⓦ', 'ｗ'],
      x: ['×', 'ж', 'ks', '*', '><', 'х', ')*(', '][', '}{', 'ⓧ', '⒳', 'Ⓧ', 'ｘ'],
      y: ['j', 'ÿ', 'γ', 'у', 'ў', '`/', '\\|/', 'ⓨ', '⒴', 'Ⓨ', 'ｙ', 'ч', 'λ', 'ƴ'],
      z: ['s', '2', 'ž', '7_', 'з', 'ʒ', '≥', 'ⓩ', '⒵', 'Ⓩ', 'ｚ', '~/_', '%'],

      // Sayılar ve semboller için özel değişimler
      '0': ['o', 'O', '()', '[]', '{}', '<>', 'ο', 'Ο', '°', 'ⓞ', '⒪', 'Ⓞ', 'ｏ'],
      '1': ['i', 'l', 'I', '|', '!', 'ⓘ', '⒤', 'Ⓘ', 'ｉ'],
      '2': ['z', 'Z', 'ⓩ', '⒵', 'Ⓩ', 'ｚ', 'ƻ'],
      '3': ['e', 'E', 'ⓔ', '⒠', 'Ⓔ', 'ｅ', 'ε'],
      '4': ['a', 'A', 'ⓐ', '⒜', 'Ⓐ', 'ａ', '/-\\'],
      '5': ['s', 'S', 'ⓢ', '⒮', 'Ⓢ', 'ｓ', '$'],
      '6': ['g', 'G', 'ⓖ', '⒢', 'Ⓖ', 'ｇ', 'б'],
      '7': ['t', 'T', 'ⓣ', '⒯', 'Ⓣ', 'ｔ', '+'],
      '8': ['b', 'B', 'ⓑ', '⒝', 'Ⓑ', 'ｂ', 'ß'],
      '9': ['g', 'G', 'ⓖ', '⒢', 'Ⓖ', 'ｇ', 'ğ'],

      // Özel Türkçe karakter varyasyonları
      'ğ': ['g', 'gh', 'ǧ', 'q', 'guh', 'gu', 'ⓖⓗ'],
      'ş': ['s', 'sh', 'sch', 'sz', 'shh', 'ⓢⓗ'],
      'ç': ['c', 'ch', 'tch', 'ts', 'cz', 'tj', 'ⓒⓗ'],
      'ö': ['o', 'oe', 'oh', 'eu', 'ⓞⓔ'],
      'ü': ['u', 'ue', 'uh', 'yu', 'ⓤⓔ']
    };
  }
  
  /**
   * İstatistikleri loglar
   * @private
   */
  _logStats() {
    const topPatterns = [...this.stats.uniquePatterns].slice(0, 10);
    const topWords = [...this.stats.topBaseWords.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
      
    logger.info('Varyasyon istatistikleri:', {
      totalVariations: this.stats.totalVariations,
      aiGenerated: this.stats.aiGeneratedVariations,
      algorithmic: this.stats.algorithmicVariations,
      uniquePatternCount: this.stats.uniquePatterns.size,
      topPatterns,
      topBaseWords: Object.fromEntries(topWords)
    });
  }
  
  /**
   * Belirli bir küfür kelimesinin tüm varyasyonlarını veritabanından çeker
   * @param {string} word - Aranacak küfür kelimesi
   * @returns {Promise<Array<string>>} Bulunan tüm varyasyonlar
   */
  async getAllVariationsFromDB(word) {
    if (!word) return [];
    
    try {
      const normalizedWord = word.toLowerCase().trim();
      
      // Ana kelimeyi veya herhangi bir varyasyonu bul
      const swearWord = await SwearWord.findOne({
        $or: [
          { word: normalizedWord },
          { variations: normalizedWord }
        ],
        isActive: true
      });
      
      if (!swearWord) return [];
      
      // Ana kelime ve tüm varyasyonlarını döndür
      return [swearWord.word, ...swearWord.variations];
    } catch (error) {
      logger.error(`Veritabanından varyasyon çekilirken hata: ${error.message}`);
      return [];
    }
  }
  
  /**
   * İki kelimenin ne kadar benzer olduğunu ölçer (Levenshtein mesafesi)
   * @param {string} str1 - İlk kelime
   * @param {string} str2 - İkinci kelime
   * @returns {number} Benzerlik oranı (0-1 arası, 1 tam eşleşme)
   * @private
   */
  _similarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Levenshtein mesafesi için matris hazırla
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    // Matris başlangıç değerlerini ayarla
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    // Levenshtein mesafesini hesapla
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // Silme
          matrix[i][j - 1] + 1,      // Ekleme
          matrix[i - 1][j - 1] + cost // Değiştirme
        );
      }
    }
    
    // Mesafeyi 0-1 arası bir benzerlik skoruna dönüştür
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - (matrix[len1][len2] / maxLen);
  }
  
  /**
   * Varyasyon oluşturmak için kullanılan bir kalıbı öğrenir ve saklar
   * @param {string} baseWord - Orijinal kelime
   * @param {string} variation - Varyasyon
   * @private
   */
  _learnPattern(baseWord, variation) {
    if (!baseWord || !variation || baseWord === variation) return;
    
    // Değişiklik kalıbını analiz et
    let pattern = '';
    let changes = [];
    
    // Kelimeler arasındaki karakter değişimlerini incele
    for (let i = 0; i < Math.min(baseWord.length, variation.length); i++) {
      if (baseWord[i] !== variation[i]) {
        changes.push({
          index: i,
          from: baseWord[i],
          to: variation[i]
        });
        pattern += `${baseWord[i]}->${variation[i]},`;
      }
    }
    
    // Boy farkı varsa ekstra değişiklik olarak hesapla
    if (baseWord.length !== variation.length) {
      const diff = baseWord.length - variation.length;
      pattern += diff > 0 ? `trim:${diff}` : `add:${-diff}`;
    }
    
    // Kalıbı sakla ve istatistiklere ekle
    if (pattern) {
      this.stats.uniquePatterns.add(pattern);
      
      // Kelime bazında kalıpları izle
      if (!this.learnedPatterns.has(baseWord)) {
        this.learnedPatterns.set(baseWord, new Set());
      }
      this.learnedPatterns.get(baseWord).add(pattern);
      
      // Top kelime istatistiklerini güncelle
      this.stats.topBaseWords.set(
        baseWord, 
        (this.stats.topBaseWords.get(baseWord) || 0) + 1
      );
    }
  }
  
  /**
   * Kelimenin olası varyasyonlarını algoritmik olarak oluşturur
   * @param {string} word - Varyasyonları oluşturulacak kelime
   * @returns {Array<string>} Oluşturulan varyasyonlar
   */
  generateAlgorithmicVariations(word) {
    if (!word || typeof word !== 'string' || word.length < 2) {
      return [];
    }
    
    const normalizedWord = word.toLowerCase().trim();
    const variations = new Set([normalizedWord]);
    
    // 1. Karakter değişimleri
    this._applyCharacterReplacements(normalizedWord, variations);
    
    // 2. Tekrarlanan karakterleri işleme
    this._handleRepeatedCharacters(normalizedWord, variations);
    
    // 3. Boşluk ve noktalama ekleme/çıkarma varyasyonları
    this._handleSpacingVariations(normalizedWord, variations);
    
    // 4. Tersine çevirme ve benzer kelimeler
    this._handleReverseAndSimilar(normalizedWord, variations);
    
    // 5. Sessiz harf düşürmeler veya ekstra harf ekleme
    this._handleLetterDropping(normalizedWord, variations);
    
    // 6. Öğrenilmiş kalıplardan varyasyonlar üretme
    this._applyLearnedPatterns(normalizedWord, variations);
    
    // İstatistikleri güncelle
    const newVariations = [...variations].filter(v => v !== normalizedWord);
    this.stats.algorithmicVariations += newVariations.length;
    this.stats.totalVariations += newVariations.length;
    
    return [...variations];
  }
  
  /**
   * Karakter değişimleri uygular
   * @param {string} word - Orijinal kelime
   * @param {Set<string>} variations - Üretilen varyasyonların saklandığı set
   * @private
   */
  _applyCharacterReplacements(word, variations) {
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const possibleReplacements = this.charPatterns[char] || [];
      
      for (const replacement of possibleReplacements) {
        // Tek karakter değişimi
        const variation = word.substring(0, i) + replacement + word.substring(i + 1);
        variations.add(variation);
        
        // Çift karakter değişimi (maksimum iki değişim için)
        if (i < word.length - 1) {
          const nextChar = word[i + 1].toLowerCase();
          const nextReplacements = this.charPatterns[nextChar] || [];
          
          // İkinci değişimi sadece bazı durumlarda uygula (tüm kombinasyonları hesaplama)
          if (Math.random() < 0.3 && nextReplacements.length > 0) {
            const nextReplacement = nextReplacements[Math.floor(Math.random() * nextReplacements.length)];
            const doubleVariation = word.substring(0, i) + replacement + 
                                   nextReplacement + word.substring(i + 2);
            variations.add(doubleVariation);
          }
        }
      }
    }
    
    // Rastgele karakter çıkarma veya ekleme
    if (word.length > 3) {
      // Karakter çıkarma
      for (let i = 1; i < word.length - 1; i++) {
        if (Math.random() < 0.2) { // Rastgele olarak bazı pozisyonlardan karakter çıkar
          const deletion = word.substring(0, i) + word.substring(i + 1);
          variations.add(deletion);
        }
      }
      
      // Sadece bazı karakter ekleme denemeleri yap
      const commonChars = '*@$#.+_-';
      for (let i = 1; i < word.length; i++) {
        if (Math.random() < 0.1) { // Daha düşük olasılıkla karakter ekle
          const randomChar = commonChars[Math.floor(Math.random() * commonChars.length)];
          const insertion = word.substring(0, i) + randomChar + word.substring(i);
          variations.add(insertion);
        }
      }
    }
  }
  
  /**
   * Tekrarlanan karakterleri işler
   * @param {string} word - Orijinal kelime
   * @param {Set<string>} variations - Üretilen varyasyonların saklandığı set
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
    
    // Karakter tekrarlama varyasyonları (üçlü)
    for (let i = 0; i < word.length; i++) {
      if ("aeioöüıuğş".includes(word[i])) { // Daha çok sesli harfleri tekrarla
        const repeatedChar = word.substring(0, i) + 
                            word[i].repeat(3) + 
                            word.substring(i + 1);
        variations.add(repeatedChar);
      }
    }
  }
  
  /**
   * Boşluk ve noktalama işlemleri
   * @param {string} word - Orijinal kelime
   * @param {Set<string>} variations - Üretilen varyasyonların saklandığı set
   * @private
   */
  _handleSpacingVariations(word, variations) {
    // Uzun kelimelerde ortaya boşluk veya noktalama ekle
    if (word.length >= 5) {
      // Ortaya boşluk ekle
      const mid = Math.floor(word.length / 2);
      variations.add(word.substring(0, mid) + ' ' + word.substring(mid));
      
      // Nokta, yıldız ve benzeri karakterler ekle
      const punctuations = ['.', '*', '-', '_', '+'];
      for (const punct of punctuations) {
        variations.add(word.substring(0, mid) + punct + word.substring(mid));
      }
      
      // Her karakter arasına boşluk ekle (örn: k ü f ü r)
      let spacedWord = '';
      for (let i = 0; i < word.length; i++) {
        spacedWord += word[i] + (i < word.length - 1 ? ' ' : '');
      }
      variations.add(spacedWord);
    }
    
    // Kelimeleri birleştirme (eğer boşluk içeriyorsa)
    if (word.includes(' ')) {
      variations.add(word.replace(/\s+/g, ''));
    }
  }
  
  /**
   * Tersine çevirme ve benzer kelime işlemleri
   * @param {string} word - Orijinal kelime
   * @param {Set<string>} variations - Üretilen varyasyonların saklandığı set
   * @private
   */
  _handleReverseAndSimilar(word, variations) {
    // Kısa kelimeler için tersine çevirme
    if (word.length <= 6) {
      const reversed = word.split('').reverse().join('');
      variations.add(reversed);
    }
  }
  
  /**
   * Sessiz harf düşürme
   * @param {string} word - Orijinal kelime
   * @param {Set<string>} variations - Üretilen varyasyonların saklandığı set
   * @private
   */
  _handleLetterDropping(word, variations) {
    const consonants = 'bcçdfgğhjklmnprsştvyz';
    
    // Sessiz harflerin çıkarıldığı varyasyonlar (bazıları)
    for (let i = 0; i < word.length; i++) {
      if (consonants.includes(word[i]) && Math.random() < 0.3) {
        variations.add(word.substring(0, i) + word.substring(i + 1));
      }
    }
    
    // Sesli harflerin atlandığı varyasyonlar
    const vowels = 'aeıioöuü';
    for (let i = 0; i < word.length; i++) {
      if (vowels.includes(word[i]) && Math.random() < 0.2) {
        variations.add(word.substring(0, i) + word.substring(i + 1));
      }
    }
  }
  
  /**
   * Öğrenilmiş kalıpları uygular
   * @param {string} word - Orijinal kelime
   * @param {Set<string>} variations - Üretilen varyasyonların saklandığı set
   * @private
   */
  _applyLearnedPatterns(word, variations) {
    // Tüm öğrenilmiş kalıplar için kelime benzerliği kontrol et
    for (const [baseWord, patterns] of this.learnedPatterns.entries()) {
      // Kelimeler benzer mi kontrol et
      const similarity = this._similarity(word, baseWord);
      
      // Benzerlik skoruna göre kalıpları uygula (%70 veya üzeri benzerlik)
      if (similarity >= 0.7) {
        for (const patternStr of patterns) {
          try {
            // Kalıbı parçala ve uygula
            if (patternStr.includes('->')) {
              // Karakter değişimi
              const changes = patternStr.split(',').filter(p => p.includes('->'));
              
              let newVariation = word;
              for (const change of changes) {
                const [from, to] = change.split('->');
                if (from && to) {
                  newVariation = newVariation.replace(new RegExp(from, 'g'), to);
                }
              }
              
              if (newVariation !== word) {
                variations.add(newVariation);
              }
            } else if (patternStr.startsWith('trim:')) {
              // Karakter çıkarma
              const trimCount = parseInt(patternStr.split(':')[1]);
              if (!isNaN(trimCount) && trimCount > 0 && trimCount < word.length) {
                variations.add(word.substring(0, word.length - trimCount));
              }
            } else if (patternStr.startsWith('add:')) {
              // Karakter ekleme (basit çoğaltma olarak uygula)
              const addCount = parseInt(patternStr.split(':')[1]);
              if (!isNaN(addCount) && addCount > 0) {
                const lastChar = word[word.length - 1];
                variations.add(word + lastChar.repeat(addCount));
              }
            }
          } catch (error) {
            logger.error(`Kalıp uygulama hatası: ${error.message}`, { pattern: patternStr });
          }
        }
      }
    }
  }
  
  /**
   * Yapay zeka kullanarak sınırsız varyasyon önerileri alır - Ultra Genişletilmiş Sürüm
   * @param {string} word - Varyasyonları oluşturulacak kelime
   * @param {string} model - Kullanılacak AI modeli
   * @returns {Promise<Array<string>>} AI tarafından önerilen varyasyonlar
   */
  async generateAIVariations(word, model = DEFAULT_MODEL) {
    if (!word || !client) return [];
    
    try {
      const selectedModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;
      
      const prompt = `"${word}" kelimesi için Türkçe'de kullanılan tüm olası yazım varyasyonlarını, 
      sansürleme şekillerini ve karakter değişimleriyle yazılabilecek her türlü alternatifi oluştur.
      
      Herhangi bir sayı sınırlaması olmadan, mümkün olan en kapsamlı varyasyon listesini oluşturmalısın.
      Özellikle şunları içeren geniş kapsamlı bir varyasyon kümesi oluştur:
      
      1. Tüm karakter değişimleri (a→@, o→0, s→$, vb.)
      2. Şekil benzerliği olan karakterler (İ→1, O→0, B→8, vb.)
      3. Sesli ve sessiz harf değişimleri, düşürmeleri
      4. Her türlü boşluk/noktalama manipülasyonları (o.r.n.e.k, o-r-n-e-k, o r n e k)
      5. Harf tekrarları (örneeek, örnekkkk, örneeeeeek)
      6. Harf sıra değişimleri (örenk, önerk)
      7. Fonetik olarak benzer alternatifler
      8. Yüksek/küçük harf kombinasyonları (OrNeK, oRnEk)
      9. Türkçe karakterlerin ASCII karşılıkları (ö→o, ü→u, ş→s, ç→c, ı→i, ğ→g)
      10. Özel karakter yerleştirmeleri (*örnek*, ö.r.n.e.k, ö_r_n_e_k)
      11. Unicode karakterler ve emojiler
      12. Tersine yazım şekilleri
      13. 1337 (leet) konuşma stili varyasyonları
      
      Lütfen mümkün olan her tekniği uygula ve küfürlerin tespitini engellemek için kullanılabilecek en yaratıcı varyasyonları da dahil et.
      Sayı veya miktar sınırlaması olmaksızın, bir küfür kelimesinin tespitini atlatmak için düşünülebilecek tüm varyasyonları oluştur.
      
      Yalnızca varyasyonları JSON dizisi formatında döndür:
      ["varyasyon1", "varyasyon2", "varyasyon3", ...]`;
      
      logger.info(`AI ile "${word}" için varyasyon oluşturuluyor. Model: ${selectedModel}`);
      
      const response = await client.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: `Sen Türkçe küfür, hakaret ve argo kelimelerinin farklı yazım varyasyonlarını tespit etmekte uzman bir asistansın. 
            Yazım varyasyonları, karakter değişimleri, harf tekrarları, benzer sesler, fonetik benzerlikler ve sansürleme yöntemlerini 
            dikkate alarak mümkün olduğunca kapsamlı varyasyon listeleri oluştur. Sadece JSON formatında cevap ver.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const aiResponse = response.choices[0].message.content;
      
      try {
        // JSON yanıtı ayrıştır
        let variations = JSON.parse(aiResponse);
        
        if (Array.isArray(variations)) {
          // Geçerli ve benzersiz varyasyonları filtrele
          variations = variations
            .filter(v => typeof v === 'string' && v.trim().length > 1)
            .map(v => v.toLowerCase().trim());
          
          // Varyasyon başına kalıp öğren
          variations.forEach(variation => {
            this._learnPattern(word, variation);
          });
          
          // İstatistikleri güncelle
          this.stats.aiGeneratedVariations += variations.length;
          this.stats.totalVariations += variations.length;
          
          logger.info(`AI, "${word}" için ${variations.length} varyasyon oluşturdu.`);
          return variations;
        }
      } catch (parseError) {
        logger.error(`AI yanıtı JSON olarak ayrıştırılamadı: ${parseError.message}`, { response: aiResponse });
      }
      
      return [];
    } catch (error) {
      logger.error(`AI varyasyon oluşturma hatası: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Hem algoritma hem AI kullanarak kapsamlı varyasyon listesi oluşturur ve veritabanına kaydeder
   * @param {string} word - Varyasyonları oluşturulacak kelime
   * @param {Object} options - Ek seçenekler (model, useAI vs.)
   * @returns {Promise<{baseWord: string, variations: Array<string>, added: number}>} Oluşturulan varyasyonlar ve sonuçlar
   */
  async enrichVariations(word, options = {}) {
    if (!word) {
      return { baseWord: '', variations: [], added: 0 };
    }
    
    try {
      const normalizedWord = word.toLowerCase().trim();
      const useAI = options.useAI !== false; // Varsayılan olarak AI kullan
      const model = options.model && SUPPORTED_MODELS.includes(options.model) 
        ? options.model 
        : DEFAULT_MODEL;
      
      // Mevcut SwearWord kaydını bul veya oluştur
      let swearWord = await SwearWord.findByWord(normalizedWord);
      
      if (!swearWord) {
        // Kelime bulunamadı, yeni bir kayıt oluştur
        logger.info(`"${normalizedWord}" için veritabanında kayıt bulunamadı, yeni kayıt oluşturuluyor.`);
        
        swearWord = new SwearWord({
          word: normalizedWord,
          variations: [],
          category: options.category || 'diğer',
          source: options.source || 'manuel',
          isActive: true
        });
      }
      
      // Mevcut varyasyonları al
      const existingVariations = new Set(swearWord.variations);
      const allVariations = new Set([...existingVariations]);
      let addedCount = 0;
      
      // 1. Algoritmik varyasyonlar oluştur
      const algorithmicVariations = this.generateAlgorithmicVariations(normalizedWord);
      
      // Yeni varyasyonları ekle
      for (const variation of algorithmicVariations) {
        if (variation !== normalizedWord && !existingVariations.has(variation)) {
          allVariations.add(variation);
          addedCount++;
        }
      }
      
      // 2. AI varyasyonları (eğer etkinse)
      if (useAI && client) {
        const aiVariations = await this.generateAIVariations(normalizedWord, model);
        
        // Yeni AI varyasyonlarını ekle
        for (const variation of aiVariations) {
          if (variation !== normalizedWord && !allVariations.has(variation)) {
            allVariations.add(variation);
            addedCount++;
          }
        }
      }
      
      // Veritabanını güncelle
      swearWord.variations = [...allVariations].filter(v => v !== normalizedWord);
      
      // İstatistikleri güncelle
      if (!swearWord.stats) {
        swearWord.stats = {
          variationDetections: swearWord.variations.length,
          lastUpdated: new Date()
        };
      } else {
        swearWord.stats.variationDetections = swearWord.variations.length;
        swearWord.stats.lastUpdated = new Date();
      }
      
      await swearWord.save();
      
      logger.info(`"${normalizedWord}" kelimesi için varyasyon zenginleştirme tamamlandı. Toplam ${swearWord.variations.length} varyasyon, ${addedCount} yeni ekleme.`);
      
      // Sonuçları döndür
      return {
        baseWord: normalizedWord,
        variations: swearWord.variations,
        added: addedCount
      };
    } catch (error) {
      logger.error(`Varyasyon zenginleştirme hatası: ${error.message}`);
      return { baseWord: word, variations: [], added: 0 };
    }
  }
  
  /**
   * Veritabanından en çok varyasyona sahip küfürleri getirir
   * @param {number} limit - Maksimum sonuç sayısı
   * @returns {Promise<Array<Object>>} En fazla varyasyona sahip küfürler
   */
  async getMostVariedWords(limit = 20) {
    try {
      // Varyasyon sayısına göre sırala
      const results = await SwearWord.aggregate([
        { $match: { isActive: true } },
        { 
          $project: { 
            word: 1,
            category: 1,
            variationCount: { $size: { $ifNull: ['$variations', []] } },
            stats: 1
          }
        },
        { $sort: { variationCount: -1 } },
        { $limit: limit }
      ]);
      
      return results;
    } catch (error) {
      logger.error(`En çok varyasyona sahip kelimeler alınırken hata: ${error.message}`);
      return [];
    }
  }
  
  /**
   * İlgili kelimeler ve bunların varyasyonlarını toplu olarak getirir
   * @param {Array<string>} words - Varyasyonları getirilecek kelimeler
   * @returns {Promise<Map<string, Array<string>>>} Kelime -> varyasyonlar eşlemesi
   */
  async getVariationsForMultipleWords(words) {
    if (!Array.isArray(words) || words.length === 0) {
      return new Map();
    }
    
    const results = new Map();
    
    try {
      // Her kelime için varyasyon getir
      for (const word of words) {
        const variations = await this.getAllVariationsFromDB(word);
        if (variations.length > 0) {
          results.set(word, variations);
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Toplu varyasyon getirme hatası: ${error.message}`);
      return results;
    }
  }
  
  /**
   * Otomatik varyasyon zenginleştirme işlemi
   * @param {number} limit - İşlenecek maksimum kelime sayısı
   * @returns {Promise<{processed: number, enriched: number, totalNewVariations: number}>}
   */
  async runBulkEnrichment(limit = 100) {
    logger.info(`Toplu varyasyon zenginleştirme başlatılıyor. İşlenecek maksimum kelime: ${limit}`);
    
    try {
      // En çok tespit edilen aktif küfür kelimelerini getir
      const words = await SwearWord.find({ isActive: true })
        .sort({ 'stats.detectionCount': -1 })
        .limit(limit)
        .select('_id word variations stats');
      
      if (!words.length) {
        logger.warn('İşlenecek kelime bulunamadı.');
        return { processed: 0, enriched: 0, totalNewVariations: 0 };
      }
      
      let enrichedCount = 0;
      let totalNewVariations = 0;
      
      // Her kelime için zenginleştirme yap
      for (const word of words) {
        const result = await this.enrichVariations(word.word, { useAI: true });
        
        if (result.added > 0) {
          enrichedCount++;
          totalNewVariations += result.added;
        }
      }
      
      logger.info(`Toplu zenginleştirme tamamlandı. İşlenen: ${words.length}, Zenginleştirilen: ${enrichedCount}, Yeni varyasyon: ${totalNewVariations}`);
      
      return {
        processed: words.length,
        enriched: enrichedCount,
        totalNewVariations
      };
    } catch (error) {
      logger.error(`Toplu zenginleştirme hatası: ${error.message}`);
      return { processed: 0, enriched: 0, totalNewVariations: 0 };
    }
  }
}

module.exports = new VaryasyonService();
