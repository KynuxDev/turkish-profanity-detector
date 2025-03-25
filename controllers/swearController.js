/**
 * Küfür Tespit API Kontrolcüsü
 * 
 * API isteklerini karşılayan, küfür tespit servisini kullanan ve
 * yapay zeka entegrasyonuyla tespit doğruluğunu artıran kontrolcü sınıfı.
 * 
 * @module controllers/swearController
 */

const swearDetectionService = require('../services/swearDetectionService');
const SwearWord = require('../models/swearWord');
const OpenAI = require('openai');
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
  defaultMeta: { service: 'swear-controller' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
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
  'claude-3-sonnet',
  'claude-3-opus',
  'gpt-4o', 
  'gpt-4-turbo'
];

// Varsayılan model (hız ve doğruluk dengesine göre)
const DEFAULT_MODEL = 'claude-3-haiku';

class SwearController {
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

      // Metin analizi yap
      const analysis = await swearDetectionService.analyzeText(text);
      
      // Eğer küfür tespit edilmezse, AI modelini kullanarak analiz et
      if (!analysis.isSwear && text.length > 2) {
        // Kullanıcının model seçmesine izin ver (isteğe bağlı)
        const model = req.query.model && SUPPORTED_MODELS.includes(req.query.model) 
          ? req.query.model 
          : DEFAULT_MODEL;
        
        const aiAnalysisResult = await this.analyzeWithAI(text, model);
        
        // Eğer AI küfür tespit ettiyse, veritabanına ekle
        if (aiAnalysisResult.isSwear && aiAnalysisResult.word) {
          await swearDetectionService.saveNewSwearWord(aiAnalysisResult.word, {
            category: aiAnalysisResult.category || 'diğer',
            severityLevel: aiAnalysisResult.severityLevel || 3,
            variations: aiAnalysisResult.variations || []
          });
          
          // Sonuçları güncelle
          analysis.isSwear = true;
          analysis.aiDetected = true;
          analysis.aiResult = aiAnalysisResult;
        }
      }
      
      return res.status(200).json({
        success: true,
        result: {
          isSwear: analysis.isSwear,
          details: analysis.isSwear ? {
            word: analysis.result ? analysis.result.word : (analysis.aiResult ? analysis.aiResult.word : null),
            category: analysis.result ? analysis.result.category : (analysis.aiResult ? analysis.aiResult.category : null),
            severityLevel: analysis.result ? analysis.result.severityLevel : (analysis.aiResult ? analysis.aiResult.severityLevel : null),
            detectedWords: analysis.detectedWords.map(dw => dw.original)
          } : null,
          aiDetected: analysis.aiDetected || false
        }
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
   * Yapay zeka modelini kullanarak metni analiz eder
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
            content: `Sen Türkçe küfür, hakaret ve argo kelimeleri tespit etmek için tasarlanmış bir sistemsin. 
            Verilen metinde küfür veya hakaret olup olmadığını analiz et. 
            Eğer küfür veya hakaret varsa, aşağıdaki JSON formatında cevap ver:
            {
              "isSwear": true,
              "word": "tespit ettiğin küfür kelimesi",
              "category": "hakaret|cinsel|dini|argo|diğer",
              "severityLevel": 1-5 arası şiddet seviyesi,
              "variations": ["olası", "varyasyonlar"]
            }
            
            Eğer küfür veya hakaret yoksa:
            {
              "isSwear": false
            }
            
            Sadece JSON döndür, ek açıklama yapma.`
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
        logger.info(`AI analizi tamamlandı: ${parsedResponse.isSwear ? 'Küfür tespit edildi' : 'Küfür tespit edilmedi'}`);
        return parsedResponse;
      } catch (parseError) {
        logger.error('AI yanıtı JSON olarak ayrıştırılamadı:', { error: parseError.message, response: aiResponse });
        return { isSwear: false };
      }
    } catch (error) {
      logger.error('AI analiz hatası:', { error: error.message });
      return { isSwear: false };
    }
  }
  
  /**
   * Veritabanından küfür istatistiklerini getirir
   * @param {Object} req - Express isteği
   * @param {Object} res - Express yanıtı
   */
  getStatistics = async (req, res) => {
    try {
      // En çok tespit edilen küfürler
      const topSwearWords = await SwearWord.find()
        .sort({ detectionCount: -1 })
        .limit(10)
        .select('word category severityLevel detectionCount');
      
      // Toplam küfür sayısı
      const totalCount = await SwearWord.countDocuments();
      
      // Kategorilere göre dağılım
      const categoryCounts = await SwearWord.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);
      
      return res.status(200).json({
        success: true,
        statistics: {
          totalSwearWords: totalCount,
          topSwearWords,
          categoryCounts: categoryCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
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
}

module.exports = new SwearController();
