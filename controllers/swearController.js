/**
 * Küfür Tespit API Kontrolcüsü - Gelişmiş Sürüm
 * 
 * API isteklerini karşılayan, küfür tespit servisini kullanan ve
 * yapay zeka entegrasyonuyla tespit doğruluğunu artıran kontrolcü sınıfı.
 * Gelişmiş veritabanı yönetimi ve kapsamlı varyasyon algoritmaları içerir.
 * 
 * @module controllers/swearController
 */

const swearDetectionService = require('../services/swearDetectionService');
const varyasyonService = require('../services/varyasyonService');
const SwearWord = require('../models/swearWord');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { createLogger, format, transports } = require('winston');
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
  defaultMeta: { service: 'swear-controller' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/ai-detection.log', level: 'info' }),
    new transports.File({ filename: 'logs/combined.log' })
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

// Desteklenen modeller ve varsayılan model
const SUPPORTED_MODELS = [
  'claude-3-haiku',
  'o3-mini',
  'claude-3-7-sonnet',
  'gpt-4.5',
  'gemini-2.0-pro',
  'chatgpt-latest',
  'claude-3-opus',
  'gpt-4o', 
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo'
];

// Varsayılan model (en yüksek doğruluk için)
const DEFAULT_MODEL = 'gpt-4.5';

// Analiz sonuçları önbelleği
const analysisCache = new Map();
const ANALYSIS_CACHE_TTL = 30 * 60 * 1000; // 30 dakika

class SwearController {
  constructor() {
    // Önbellek temizleme işlemi
    setInterval(() => this._cleanAnalysisCache(), ANALYSIS_CACHE_TTL);
    
    // DB verimlilik sayacı ve optimizasyon
    this.dbHitCounter = 0;
    this.cacheHitCounter = 0;
    
    // İstatistikleri periyodik olarak logla
    setInterval(() => this._logPerformanceStats(), 60 * 60 * 1000); // Her saat
  }
  
  /**
   * Önbelleği temizler
   * @private
   */
  _cleanAnalysisCache() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, value] of analysisCache.entries()) {
      if (now - value.timestamp > ANALYSIS_CACHE_TTL) {
        analysisCache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`Önbellekten ${expiredCount} süresi dolmuş analiz sonucu temizlendi`);
    }
  }
  
  /**
   * Performans istatistiklerini loglar
   * @private
   */
  _logPerformanceStats() {
    const cacheHitRate = this.dbHitCounter + this.cacheHitCounter > 0 
      ? (this.cacheHitCounter / (this.dbHitCounter + this.cacheHitCounter) * 100).toFixed(2) 
      : 0;
      
    logger.info(`Performans İstatistikleri: DB Çağrı: ${this.dbHitCounter}, Önbellek Hit: ${this.cacheHitCounter}, Önbellek Hit Oranı: %${cacheHitRate}`);
    
    // Sayaçları sıfırla
    this.dbHitCounter = 0;
    this.cacheHitCounter = 0;
  }
  
  /**
   * Metin içindeki küfürleri tespit eder
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  detectSwear = async (req, res) => {
    try {
      const { text } = req.query;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Text parametresi gerekli'
        });
      }
      
      // Önbellek anahtarı oluştur
      const cacheKey = `${text.substring(0, 100)}_${Date.now()}`;
      
      // Önbellekte kontrol et
      if (analysisCache.has(cacheKey)) {
        this.cacheHitCounter++;
        logger.debug(`Önbellekten analiz sonucu bulundu: "${text.substring(0, 30)}..."`);
        return res.status(200).json({
          success: true,
          result: analysisCache.get(cacheKey).result,
          fromCache: true
        });
      }
      
      this.dbHitCounter++;

      // Gelişmiş analiz seçenekleri
      const options = {
        useAI: req.query.useAI !== 'false', // Varsayılan olarak AI kullan
        model: req.query.model && SUPPORTED_MODELS.includes(req.query.model) ? req.query.model : DEFAULT_MODEL,
        confidenceThreshold: parseFloat(req.query.confidence) || 0.7,
        saveDetections: req.query.save !== 'false' // Varsayılan olarak tespit edilen küfürleri kaydet
      };

      // Metin analizi yap
      const analysis = await swearDetectionService.analyzeText(text);
      
      // Analiz sonuçlarını içeren nesne
      let result = {
        isSwear: analysis.isSwear,
        details: analysis.isSwear ? {
          word: analysis.result ? analysis.result.word : null,
          category: analysis.result ? analysis.result.category : null,
          severityLevel: analysis.result ? analysis.result.severityLevel : null,
          detectedWords: analysis.detectedWords.map(dw => dw.original)
        } : null,
        aiDetected: false
      };
      
      // Eğer küfür tespit edilmezse ve AI kullanımı açıksa, AI modelini kullanarak analiz et
      if (!analysis.isSwear && options.useAI && text.length > 2) {
        logger.info(`DB'de küfür bulunamadı, AI analizi başlatılıyor: "${text.substring(0, 30)}..."`);
        
        const aiAnalysisResult = await this.analyzeWithAI(text, options.model);
        
        // Eğer AI küfür tespit ettiyse, veritabanına ekle
        if (aiAnalysisResult.isSwear && aiAnalysisResult.word && options.saveDetections) {
          try {
            const savedWord = await this._saveOrUpdateAIDetection(aiAnalysisResult);
            
            if (savedWord) {
              logger.info(`AI'nin tespit ettiği yeni küfür kaydedildi: "${aiAnalysisResult.word}"`);
            }
            
            // Sonuçları güncelle
            result.isSwear = true;
            result.aiDetected = true;
            result.details = {
              word: aiAnalysisResult.word,
              category: aiAnalysisResult.category || 'diğer',
              severityLevel: aiAnalysisResult.severityLevel || 3,
              detectedWords: [aiAnalysisResult.word]
            };
            result.aiConfidence = aiAnalysisResult.confidence || 0.85;
          } catch (dbError) {
            logger.error('AI tespiti kaydedilemedi:', { error: dbError.message });
          }
        }
      }
      
      // Önbelleğe ekle
      analysisCache.set(cacheKey, { 
        result, 
        timestamp: Date.now()
      });
      
      return res.status(200).json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Küfür tespit hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Küfür tespiti sırasında bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * AI tarafından tespit edilen küfür kelimesini veritabanına ekler veya günceller
   * @private
   * @param {Object} aiData - AI tespit sonucu
   * @returns {Promise<Object>} Kaydedilen veya güncellenen kelime
   */
  async _saveOrUpdateAIDetection(aiData) {
    if (!aiData.word) return null;
    
    // Normalleştir
    const normalizedWord = aiData.word.toLowerCase().trim();
    
    try {
      // Var olan kaydı kontrol et
      let existingWord = await SwearWord.findByWord(normalizedWord);
      
      if (existingWord) {
        // Mevcut kelimeyi AI verileriyle güncelle
        await existingWord.updateWithAiData({
          category: aiData.category,
          severityLevel: aiData.severityLevel,
          alternatives: aiData.alternatives,
          variations: aiData.variations
        });
        
        return existingWord;
      } else {
        // Yeni kayıt oluştur
        const variations = Array.isArray(aiData.variations) ? aiData.variations : [];
        
        // Alternatifler
        const alternatives = Array.isArray(aiData.alternatives) 
          ? aiData.alternatives.map(alt => typeof alt === 'string' ? { word: alt, suitability: 3 } : alt)
          : [];
        
        // Kelime tipi ve gramer bilgisi
        let grammar = {
          wordType: aiData.wordType || 'diğer',
          root: aiData.root || normalizedWord
        };
        
        // Yeni küfür kelimesi oluştur
        const newSwearWord = new SwearWord({
          word: normalizedWord,
          variations,
          category: aiData.category || 'diğer',
          severityLevel: aiData.severityLevel || 3,
          alternatives,
          grammar,
          source: 'ai_detected',
          confidenceScore: aiData.confidence || 0.85,
          metadata: {
            creationMethod: 'ai',
            createdBy: aiData.model || DEFAULT_MODEL,
            notes: `AI tarafından tespit edildi. Tarih: ${new Date().toISOString()}`
          }
        });
        
        // Kullanım bağlamı ekle
        if (aiData.context) {
          newSwearWord.usageContexts = [{
            context: aiData.context,
            frequency: 0.5
          }];
        }
        
        return await newSwearWord.save();
      }
    } catch (error) {
      logger.error('AI tespiti kaydedilemedi:', { error: error.message, word: normalizedWord });
      throw error;
    }
  }
  
  /**
   * Yapay zeka modelini kullanarak metni analiz eder - Gelişmiş Sürüm
   * @param {string} text - Analiz edilecek metin
   * @param {string} [model] - Kullanılacak yapay zeka modeli (varsayılan: DEFAULT_MODEL)
   * @returns {Promise<Object>} AI analiz sonucu
   */
  analyzeWithAI = async (text, model = DEFAULT_MODEL) => {
    if (!client) {
      logger.error('AI analizi yapılamıyor: API istemcisi oluşturulamadı');
      return { isSwear: false };
    }
    
    // Geçerli model kontrolü
    const selectedModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    
    try {
      logger.info(`AI analizi başlatılıyor: "${text.substring(0, 30)}..." (Model: ${selectedModel})`);
      
      const response = await client.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: `Sen Türkçe küfür, hakaret ve argo kelimeleri tespit etmek için tasarlanmış uzman bir sistemsin. 
            Verilen metinde potansiyel küfür, hakaret, argo veya uygunsuz ifadeleri analiz et ve en yüksek hassasiyetle değerlendir.
            
            Eğer küfür, hakaret veya argo ifade tespit edersen, aşağıdaki JSON formatında detaylı bir cevap ver:
            {
              "isSwear": true,
              "word": "tespit ettiğin küfür kelimesi (ana form)",
              "category": "hakaret|cinsel|dini|argo|ırkçı|cinsiyetçi|homofobik|tehdit|politik|ayrımcı|diğer",
              "severityLevel": 1-5 arası şiddet seviyesi (5 en şiddetli),
              "variations": ["olası", "varyasyonlar", "ve", "yazım", "şekilleri"],
              "wordType": "isim|sıfat|fiil|ünlem|deyim|diğer",
              "root": "kelimenin kökü (varsa)",
              "alternatives": ["kibar", "alternatif", "kelimeler"],
              "context": "sosyal_medya|oyun|forum|yorum|haber|mesajlaşma|diğer",
              "confidence": 0-1 arası tespit güven değeri (0.95 gibi)
            }
            
            Eğer küfür, hakaret veya argo ifade bulamazsan:
            {
              "isSwear": false,
              "confidence": 0-1 arası güven değeri (0.95 gibi)
            }
            
            Sadece JSON formatında cevap ver, hiçbir ek açıklama ekleme. Analiz sırasında Türkçe dil yapısını, değiştirilmiş harfleri ve karakter değişimleri ile gizlenmeye çalışılan küfürleri de hesaba kat. İfadenin bağlamını dikkate al ve şüpheli durumlarda detaylı değerlendirme yap.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1, // Daha tutarlı sonuçlar için düşük sıcaklık
        max_tokens: 2000
      });
      
      const aiResponse = response.choices[0].message.content;
      
      try {
        // JSON yanıtı ayrıştır
        const parsedResponse = JSON.parse(aiResponse);
        logger.info(`AI analizi tamamlandı: ${parsedResponse.isSwear ? 'Küfür tespit edildi' : 'Küfür tespit edilmedi'}, Güven: ${parsedResponse.confidence || 'belirtilmemiş'}`);
        
        // Modeli ekle (veri zenginleştirme)
        parsedResponse.model = selectedModel;
        
        // Tespit zamanı
        parsedResponse.detectedAt = new Date().toISOString();
        
        return parsedResponse;
      } catch (parseError) {
        logger.error('AI yanıtı JSON olarak ayrıştırılamadı:', { error: parseError.message, response: aiResponse });
        return { isSwear: false, confidence: 0.1 };
      }
    } catch (error) {
      logger.error('AI analiz hatası:', { error: error.message });
      return { isSwear: false, confidence: 0 };
    }
  }
  
  /**
   * Veritabanından kapsamlı küfür istatistiklerini getirir
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  getStatistics = async (req, res) => {
    try {
      // İsteğe bağlı filtreler
      const { category, minSeverity, limit = 20, source } = req.query;
      
      // Filtreleme seçenekleri
      const filter = { isActive: true };
      
      if (category) {
        filter.category = category;
      }
      
      if (minSeverity) {
        filter.severityLevel = { $gte: parseInt(minSeverity) };
      }
      
      if (source) {
        filter.source = source;
      }
      
      // En çok tespit edilen küfürler
      const topSwearWords = await SwearWord.find(filter)
        .sort({ 'stats.detectionCount': -1 })
        .limit(parseInt(limit))
        .select('word category severityLevel stats.detectionCount variations source confidenceScore');
      
      // Toplam küfür sayısı
      const totalCount = await SwearWord.countDocuments();
      const activeCount = await SwearWord.countDocuments({ isActive: true });
      
      // Kategorilere göre dağılım
      const categoryCounts = await SwearWord.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);
      
      // Şiddet seviyesine göre dağılım 
      const severityCounts = await SwearWord.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$severityLevel', count: { $sum: 1 } } }
      ]);
      
      // Kaynak dağılımı
      const sourceCounts = await SwearWord.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]);
      
      // Varyasyon sayıları
      const variationStats = await SwearWord.aggregate([
        { $match: { isActive: true } },
        { 
          $project: { 
            word: 1,
            variationCount: { $size: '$variations' }
          }
        },
        { $sort: { variationCount: -1 } },
        { $limit: 10 }
      ]);
      
      // En son eklenen 10 küfür
      const recentlyAdded = await SwearWord.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('word category severityLevel source createdAt');
      
      return res.status(200).json({
        success: true,
        statistics: {
          totalSwearWords: totalCount,
          activeSwearWords: activeCount,
          topSwearWords,
          recentlyAdded,
          categoryCounts: categoryCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          severityCounts: severityCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          sourceCounts: sourceCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          topVariationCounts: variationStats
        }
      });
    } catch (error) {
      logger.error('İstatistik hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'İstatistikler alınırken bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Yeni bir küfür kelimesini veritabanına ekler
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  addSwearWord = async (req, res) => {
    try {
      const { word, category, severityLevel, variations, alternatives } = req.body;
      
      if (!word) {
        return res.status(400).json({
          success: false,
          message: 'Kelime parametresi gerekli'
        });
      }
      
      // Kelimenin zaten var olup olmadığını kontrol et
      const existing = await SwearWord.findByWord(word);
      
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Bu kelime zaten veritabanında mevcut',
          existingWord: {
            id: existing._id,
            word: existing.word,
            category: existing.category,
            variations: existing.variations
          }
        });
      }
      
      // Yeni küfür kelimesi oluştur
      const newSwearWord = new SwearWord({
        word: word.toLowerCase().trim(),
        category: category || 'diğer',
        severityLevel: severityLevel || 3,
        variations: variations || [],
        source: 'manuel',
        confidenceScore: 1.0, // Manuel eklenen kelimeler %100 güvenilir
        stats: {
          detectionCount: 1
        },
        metadata: {
          creationMethod: 'manuel',
          createdBy: req.body.createdBy || 'admin',
          notes: req.body.notes || 'Manuel olarak eklendi'
        }
      });
      
      // Alternatifler ekle (eğer belirtilmişse)
      if (alternatives && Array.isArray(alternatives)) {
        newSwearWord.alternatives = alternatives.map(alt => 
          typeof alt === 'string' ? { word: alt, suitability: 3 } : alt
        );
      }
      
      // Kaydet
      const saved = await newSwearWord.save();
      
      // Servis önbelleğini güncelle
      // swearDetectionService.updateCache(word);
      
      return res.status(201).json({
        success: true,
        message: 'Küfür kelimesi başarıyla eklendi',
        word: saved
      });
    } catch (error) {
      logger.error('Kelime ekleme hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false, 
        message: 'Kelime eklenirken bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Bir küfür kelimesini veritabanından siler veya devre dışı bırakır
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  deleteSwearWord = async (req, res) => {
    try {
      const { id } = req.params;
      const { deactivateOnly = true } = req.query;
      
      // ID kontrolü
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Geçerli bir kelime ID\'si gerekli'
        });
      }
      
      // Kelimeyi bul
      const word = await SwearWord.findById(id);
      
      if (!word) {
        return res.status(404).json({
          success: false,
          message: 'Belirtilen kelime bulunamadı'
        });
      }
      
      // Devre dışı bırak veya tamamen sil
      if (deactivateOnly === true || deactivateOnly === 'true') {
        word.isActive = false;
        await word.save();
        
        return res.status(200).json({
          success: true,
          message: 'Kelime başarıyla devre dışı bırakıldı',
          word: {
            id: word._id,
            word: word.word
          }
        });
      } else {
        // Tamamen sil
        await SwearWord.deleteOne({ _id: id });
        
        return res.status(200).json({
          success: true,
          message: 'Kelime başarıyla silindi'
        });
      }
    } catch (error) {
      logger.error('Kelime silme hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Kelime silinirken bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Yanlış pozitif tespiti rapor eder
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  reportFalsePositive = async (req, res) => {
    try {
      const { word } = req.body;
      
      if (!word) {
        return res.status(400).json({
          success: false,
          message: 'Kelime parametresi gerekli'
        });
      }
      
      // Kelimeyi bul
      const swearWord = await SwearWord.findByWord(word);
      
      if (!swearWord) {
        return res.status(404).json({
          success: false,
          message: 'Rapor edilecek kelime veritabanında bulunamadı'
        });
      }
      
      // Yanlış pozitif olarak işaretle
      await swearWord.reportFalsePositive();
      
      return res.status(200).json({
        success: true,
        message: 'Yanlış pozitif başarıyla rapor edildi',
        word: {
          id: swearWord._id,
          word: swearWord.word,
          isActive: swearWord.isActive,
          falsePositiveReports: swearWord.stats?.falsePositiveReports || 1
        }
      });
    } catch (error) {
      logger.error('Yanlış pozitif raporlama hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Yanlış pozitif rapor edilirken bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * CSV, JSON veya metin dosyasından toplu küfür listesi içe aktarır
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  bulkImport = async (req, res) => {
    try {
      const { filePath, format = 'json', overwrite = false } = req.body;
      
      if (!filePath) {
        return res.status(400).json({
          success: false,
          message: 'Dosya yolu parametresi gerekli'
        });
      }
      
      // Dosya var mı kontrol et
      try {
        await fs.access(filePath);
      } catch (e) {
        return res.status(404).json({
          success: false,
          message: 'Belirtilen dosya bulunamadı veya erişilemedi',
          error: e.message
        });
      }
      
      // Dosya içeriğini oku
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      let swearWords = [];
      
      // Dosya formatına göre işle
      if (format === 'json') {
        try {
          swearWords = JSON.parse(fileContent);
          
          // Geçerlilik kontrolü
          if (!Array.isArray(swearWords)) {
            return res.status(400).json({
              success: false,
              message: 'JSON dosyası bir dizi içermelidir'
            });
          }
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            message: 'JSON dosyası ayrıştırılamadı',
            error: parseError.message
          });
        }
      } else if (format === 'csv') {
        // CSV işleme
        swearWords = fileContent
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [word, category, severityLevel, ...rest] = line.split(',').map(item => item.trim());
            return {
              word,
              category: category || 'diğer',
              severityLevel: parseInt(severityLevel) || 3,
              variations: rest
            };
          });
      } else if (format === 'text') {
        // Basit metin işleme (her satır bir kelime)
        swearWords = fileContent
          .split('\n')
          .filter(line => line.trim())
          .map(word => ({ word: word.trim() }));
      } else {
        return res.status(400).json({
          success: false,
          message: 'Desteklenmeyen dosya formatı. json, csv veya text kullanın'
        });
      }
      
      // Sonuçları sakla
      const results = {
        totalProcessed: swearWords.length,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };
      
      // Her kelimeyi işle
      for (const item of swearWords) {
        if (!item.word) {
          results.skipped++;
          continue;
        }
        
        try {
          // Kelimeyi normalleştir
          const normalizedWord = item.word.toLowerCase().trim();
          
          // Zaten var mı kontrol et
          const existing = await SwearWord.findByWord(normalizedWord);
          
          if (existing && !overwrite) {
            // Var olan kelimeyi atla
            results.skipped++;
          } else if (existing && overwrite) {
            // Var olan kelimeyi güncelle
            existing.category = item.category || existing.category;
            existing.severityLevel = item.severityLevel || existing.severityLevel;
            
            // Yeni varyasyonları ekle
            if (item.variations && Array.isArray(item.variations)) {
              existing.variations = [...new Set([
                ...existing.variations,
                ...item.variations.map(v => v.toLowerCase().trim())
              ])];
            }
            
            // Metatada ekle
            if (!existing.metadata) {
              existing.metadata = {};
            }
            existing.metadata.notes = (existing.metadata.notes || '') + ' | Toplu içe aktarımla güncellendi';
            
            await existing.save();
            results.updated++;
          } else {
            // Yeni kelime ekle
            const newSwearWord = new SwearWord({
              word: normalizedWord,
              category: item.category || 'diğer',
              severityLevel: item.severityLevel || 3,
              variations: Array.isArray(item.variations) ? item.variations.map(v => v.toLowerCase().trim()) : [],
              source: 'manuel',
              confidenceScore: 0.9,
              stats: {
                detectionCount: 1
              },
              metadata: {
                creationMethod: 'bulk_import',
                createdBy: 'admin',
                notes: 'Toplu içe aktarım ile eklendi'
              }
            });
            
            await newSwearWord.save();
            results.added++;
          }
        } catch (itemError) {
          results.errors.push({
            word: item.word,
            error: itemError.message
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Toplu içe aktarım tamamlandı',
        results
      });
    } catch (error) {
      logger.error('Toplu içe aktarım hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Toplu içe aktarım sırasında bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * AI ile aktif küfür varyasyonlarını otomatik olarak zenginleştirir
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  enrichVariationsWithAI = async (req, res) => {
    try {
      const { limit = 5, minDetections = 2, model = DEFAULT_MODEL } = req.query;
      
      // İşleme alınacak kelimeleri bul
      const words = await SwearWord.find({
        isActive: true,
        'stats.detectionCount': { $gte: parseInt(minDetections) }
      })
      .sort({ 'stats.detectionCount': -1 })
      .limit(parseInt(limit))
      .select('_id word variations');
      
      if (!words.length) {
        return res.status(404).json({
          success: false,
          message: 'İşleme alınacak kelime bulunamadı'
        });
      }
      
      const results = {
        totalProcessed: words.length,
        enriched: 0,
        newVariationsAdded: 0,
        errors: []
      };
      
      // Her kelime için AI ile varyasyon zenginleştirmesi yap
      for (const word of words) {
        try {
          // Halihazırda var olan varyasyon sayısı
          const existingVariationsCount = word.variations.length;
          
          // AI ile varyasyon analizi
          const prompt = `"${word.word}" kelimesi için Türkçe'de kullanılan farklı yazım varyasyonlarını, 
          sansürleme şekillerini ve karakter değişimleriyle yazılabilecek olası tüm alternatiflerini düşün.
          Şu anda bilinen varyasyonlar: ${word.variations.join(', ')}
          
          Yalnızca yeni varyasyonları JSON dizisi formatında döndür:
          ["varyasyon1", "varyasyon2", ...]`;
          
          const response = await client.chat.completions.create({
            model: model,
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
            let newVariations = JSON.parse(aiResponse);
            
            if (Array.isArray(newVariations)) {
              // Geçerli ve benzersiz varyasyonları filtrele
              newVariations = newVariations
                .filter(v => typeof v === 'string' && v.trim().length > 1)
                .map(v => v.toLowerCase().trim());
              
              // Mevcut kelime veya varyasyonlar listesinde olmayanları seç
              const uniqueNewVariations = newVariations.filter(v => 
                v !== word.word && !word.variations.includes(v)
              );
              
              if (uniqueNewVariations.length > 0) {
                // Yeni varyasyonları ekle
                word.variations = [...word.variations, ...uniqueNewVariations];
                
                // İstatistikleri güncelle
                if (!word.stats) {
                  word.stats = { variationDetections: uniqueNewVariations.length };
                } else {
                  word.stats.variationDetections = (word.stats.variationDetections || 0) + uniqueNewVariations.length;
                }
                
                await word.save();
                
                results.enriched++;
                results.newVariationsAdded += uniqueNewVariations.length;
                
                logger.info(`"${word.word}" kelimesi için ${uniqueNewVariations.length} yeni varyasyon eklendi`);
              }
            }
          } catch (parseError) {
            results.errors.push({
              word: word.word,
              error: `AI yanıtı JSON olarak ayrıştırılamadı: ${parseError.message}`
            });
          }
        } catch (wordError) {
          results.errors.push({
            word: word.word,
            error: wordError.message
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Varyasyon zenginleştirme tamamlandı',
        results
      });
    } catch (error) {
      logger.error('Varyasyon zenginleştirme hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Varyasyon zenginleştirme sırasında bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Belirli bir kelime için varyasyonları zenginleştirir
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  enrichVariationsForWord = async (req, res) => {
    try {
      const { word } = req.params;
      const { useAI = true, model } = req.query;
      
      if (!word) {
        return res.status(400).json({
          success: false,
          message: 'Varyasyonları zenginleştirilecek kelime parametresi gerekli'
        });
      }
      
      // Kelimeyi veritabanında bul
      const swearWord = await SwearWord.findByWord(word);
      
      if (!swearWord) {
        return res.status(404).json({
          success: false,
          message: 'Belirtilen kelime veritabanında bulunamadı'
        });
      }
      
      // Varyasyonları zenginleştir
      logger.info(`"${word}" kelimesi için varyasyon zenginleştirme başlatılıyor`);
      
      const result = await varyasyonService.enrichVariations(word, {
        useAI: useAI === 'true' || useAI === true,
        model: model
      });
      
      return res.status(200).json({
        success: true,
        message: 'Varyasyon zenginleştirme başarıyla tamamlandı',
        result: {
          baseWord: result.baseWord,
          variationsCount: result.variations.length,
          newVariationsAdded: result.added,
          variations: result.variations
        }
      });
    } catch (error) {
      logger.error('Varyasyon zenginleştirme hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Varyasyon zenginleştirme sırasında bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Belirli bir kelime için tüm varyasyonları getirir
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  getVariationsForWord = async (req, res) => {
    try {
      const { word } = req.params;
      
      if (!word) {
        return res.status(400).json({
          success: false,
          message: 'Varyasyonları getirilecek kelime parametresi gerekli'
        });
      }
      
      // Kelimeyi ve varyasyonlarını getir
      const variations = await varyasyonService.getAllVariationsFromDB(word);
      
      if (!variations.length) {
        return res.status(404).json({
          success: false,
          message: 'Belirtilen kelime için varyasyon bulunamadı'
        });
      }
      
      // Veri yapısını düzenle
      const baseWord = variations[0]; // İlk kelime ana kelimedir
      const variationList = variations.slice(1); // Geri kalanlar varyasyonlardır
      
      return res.status(200).json({
        success: true,
        data: {
          baseWord,
          variations: variationList,
          count: variationList.length
        }
      });
    } catch (error) {
      logger.error('Varyasyon getirme hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Varyasyonlar getirilirken bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Varyasyon istatistiklerini getirir
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  getVariationStatistics = async (req, res) => {
    try {
      const { limit = 20 } = req.query;
      
      // En çok varyasyona sahip kelimeleri getir
      const topVariedWords = await varyasyonService.getMostVariedWords(parseInt(limit));
      
      // Genel istatistikleri hesapla
      const totalWords = await SwearWord.countDocuments({ isActive: true });
      
      // Varyasyon sayısı dağılımı (kaç kelimenin X varyasyonu var)
      const variationDistribution = await SwearWord.aggregate([
        { $match: { isActive: true } },
        {
          $project: {
            variationCount: { $size: { $ifNull: ['$variations', []] } }
          }
        },
        {
          $group: {
            _id: '$variationCount',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Toplam varyasyon sayısı
      const totalVariationsResult = await SwearWord.aggregate([
        { $match: { isActive: true } },
        {
          $project: {
            variationCount: { $size: { $ifNull: ['$variations', []] } }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$variationCount' }
          }
        }
      ]);
      
      const totalVariations = totalVariationsResult.length > 0 ? totalVariationsResult[0].total : 0;
      
      return res.status(200).json({
        success: true,
        statistics: {
          totalWords,
          totalVariations,
          averageVariationsPerWord: totalWords > 0 ? (totalVariations / totalWords).toFixed(2) : 0,
          topVariedWords,
          variationDistribution: variationDistribution.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
        }
      });
    } catch (error) {
      logger.error('Varyasyon istatistikleri hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Varyasyon istatistikleri alınırken bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Verilen kelime için süper zenginleştirilmiş sınırsız varyasyon önerileri oluşturur (veritabanına kaydetmeden)
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  generateVariations = async (req, res) => {
    try {
      const { word } = req.query;
      const { 
        useAI = true, // Varsayılan olarak yapay zeka kullanılsın (en kapsamlı sonuçlar için)
        model,
        limit, // Opsiyonel: API yanıtında döndürülecek maksimum varyasyon sayısı
        categories = 'all' // all veya comma-separated lista: algorithmic,ai,phonetic,spacing,replacement
      } = req.query;
      
      if (!word) {
        return res.status(400).json({
          success: false,
          message: 'Varyasyonları oluşturulacak kelime parametresi gerekli'
        });
      }
      
      logger.info(`"${word}" kelimesi için sınırsız varyasyon oluşturma isteği. AI: ${useAI}, Model: ${model || 'varsayılan'}`);
      
      // Kategori filtresini ayarla
      const categoryFilter = categories === 'all' ? null : categories.split(',');
      
      // Algoritmik varyasyonları oluştur (hiçbir sınırlama olmadan)
      const algorithmicVariations = varyasyonService.generateAlgorithmicVariations(word);
      
      let aiVariations = [];
      
      // Eğer AI kullanılacaksa, sınırsız AI varyasyonları oluştur
      if (useAI === 'true' || useAI === true) {
        aiVariations = await varyasyonService.generateAIVariations(word, model);
      }
      
      // Tüm benzersiz varyasyonları birleştir
      let allVariations = [...new Set([
        ...algorithmicVariations.filter(v => v !== word),
        ...aiVariations
      ])];
      
      // Kategori filtreleme varsa uygula
      if (categoryFilter) {
        // Farklı kategorilere göre varyasyon türleri
        const categories = {
          algorithmic: algorithmicVariations, 
          ai: aiVariations,
          replacement: algorithmicVariations.filter(v => v.length === word.length), // Karakter değişimi
          spacing: algorithmicVariations.filter(v => v.includes(' ') || v.includes('.') || v.includes('-')), // Boşluk/noktalama
          phonetic: algorithmicVariations.filter(v => {
            // Fonetik benzerlik - Türkçe sesli harf değişimi
            const vowels = 'aeıioöuü';
            let phoneticDifference = false;
            
            for (let i = 0; i < Math.min(v.length, word.length); i++) {
              if (vowels.includes(v[i]) && vowels.includes(word[i]) && v[i] !== word[i]) {
                phoneticDifference = true;
                break;
              }
            }
            
            return phoneticDifference;
          })
        };
        
        // Sadece seçilen kategorileri dahil et
        const filteredVariations = categoryFilter.flatMap(cat => categories[cat] || []);
        allVariations = [...new Set(filteredVariations)];
      }
      
      // İstenirse varyasyon sayısını sınırla
      if (limit && !isNaN(parseInt(limit)) && parseInt(limit) > 0) {
        allVariations = allVariations.slice(0, parseInt(limit));
      }
      
      // Varyasyonları gruplayabilmek için kategorize et
      const categorizedVariations = {
        characterReplacement: allVariations.filter(v => v.length === word.length && !v.includes(' ') && !v.includes('.')), // Karakter değişimi
        spacing: allVariations.filter(v => v.includes(' ') || v.includes('.') || v.includes('-')), // Boşluk/noktalama
        lengthChange: allVariations.filter(v => v.length !== word.length && !v.includes(' ') && !v.includes('.')) // Uzunluk değişimi
      };
      
      return res.status(200).json({
        success: true,
        data: {
          originalWord: word,
          stats: {
            algorithmicVariationsCount: algorithmicVariations.length - 1, // Ana kelimeyi çıkar
            aiVariationsCount: aiVariations.length,
            totalUniqueVariations: allVariations.length,
            categoryCounts: {
              characterReplacement: categorizedVariations.characterReplacement.length,
              spacing: categorizedVariations.spacing.length,
              lengthChange: categorizedVariations.lengthChange.length
            }
          },
          variations: allVariations,
          // İsteğe bağlı olarak kategorize edilmiş varyasyonları da döndür
          categorizedVariations
        }
      });
    } catch (error) {
      logger.error('Varyasyon oluşturma hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Varyasyonlar oluşturulurken bir hata oluştu',
        error: error.message
      });
    }
  }
  
  /**
   * Toplu olarak varyasyon zenginleştirme işlemi çalıştırır
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  runBulkVariationEnrichment = async (req, res) => {
    try {
      const { limit = 100 } = req.query;
      
      logger.info(`Toplu varyasyon zenginleştirme başlatılıyor. Limit: ${limit}`);
      
      // Varyasyon servisindeki toplu zenginleştirme fonksiyonunu çağır
      const result = await varyasyonService.runBulkEnrichment(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        message: 'Toplu varyasyon zenginleştirme tamamlandı',
        results: result
      });
    } catch (error) {
      logger.error('Toplu varyasyon zenginleştirme hatası:', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Toplu varyasyon zenginleştirme sırasında bir hata oluştu',
        error: error.message
      });
    }
  }
}

module.exports = new SwearController();
