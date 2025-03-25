const mongoose = require('mongoose');

/**
 * Küfür Kelimesi Şeması - Gelişmiş Varyasyon Yakalama ve AI Entegrasyonu
 * 
 * Varyasyonları, ilişkisel yapıları ve istatistikleri yöneten genişletilmiş model.
 * Akıllı küfür tespiti ve veritabanı optimizasyonları içerir.
 */
const swearWordSchema = new mongoose.Schema({
  // Ana küfür kelimesi
  word: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  // Olası varyasyonlar (farklı yazılış biçimleri)
  variations: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Kaynakça ve tespit bilgisi
  source: {
    // Kelimenin tespit edildiği kaynak
    type: String,
    enum: ['manuel', 'ai_detected', 'kullanıcı_bildirimi', 'otomatik_tespit', 'varyasyon_eşleşmesi'],
    default: 'manuel'
  },
  
  // Diğer dillerdeki karşılıklar
  translations: [{
    language: {
      type: String,
      enum: ['en', 'de', 'fr', 'es', 'ar', 'ru'],
      required: true
    },
    word: {
      type: String,
      required: true
    }
  }],
  
  // İlişkili kelimeler (tematik olarak bağlantılı veya aynı kökten gelen)
  relatedWords: [{
    word: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SwearWord'
    },
    relationStrength: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    relationType: {
      type: String,
      enum: ['kök', 'türev', 'benzer', 'eşanlamlı'],
      default: 'benzer'
    }
  }],
  
  // Kategorisi (genişletilmiş)
  category: {
    type: String,
    enum: [
      'hakaret', 'cinsel', 'dini', 'argo', 'ırkçı', 'cinsiyetçi', 
      'homofobik', 'tehdit', 'politik', 'ayrımcı', 'diğer'
    ],
    default: 'diğer'
  },
  
  // Alt kategoriler (daha spesifik sınıflandırma)
  subCategories: [{
    type: String,
    trim: true
  }],
  
  // Şiddet seviyesi (1-5)
  severityLevel: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  
  // Dil bilgisi özellikleri
  grammar: {
    // Kelimenin dilbilgisi tipi
    wordType: {
      type: String,
      enum: ['isim', 'sıfat', 'fiil', 'ünlem', 'deyim', 'diğer'],
      default: 'diğer'
    },
    
    // Kök kelime
    root: {
      type: String,
      trim: true
    }
  },
  
  // Alternatif öneriler (sansürlü veya uygun versiyonlar)
  alternatives: [{
    word: {
      type: String,
      required: true,
      trim: true
    },
    suitability: {
      type: Number, // 1-5, ne kadar yüksekse o kadar uygun
      min: 1,
      max: 5,
      default: 3
    }
  }],
  
  // Kullanım konumu bilgisi
  usageContexts: [{
    context: {
      type: String,
      enum: ['sosyal_medya', 'oyun', 'forum', 'yorum', 'haber', 'mesajlaşma', 'diğer'],
      required: true
    },
    frequency: {
      type: Number, // 0-1 arası yoğunluk
      min: 0,
      max: 1,
      default: 0.5
    }
  }],
  
  // Doğruluk puanı (0-1 arası, yüksek değer daha doğru tespit)
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.85
  },
  
  // Aktiflik durumu (yanlış tespitler için devre dışı bırakma)
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Tespit istatistikleri
  stats: {
    // Toplam tespit sayısı
    detectionCount: {
      type: Number,
      default: 1
    },
    
    // Varyasyon tespitleri
    variationDetections: {
      type: Number,
      default: 0
    },
    
    // Yanlış pozitif raporlamaları
    falsePositiveReports: {
      type: Number,
      default: 0
    },
    
    // Son güncellenme bilgisi
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // İlk tespit edilme tarihi
  firstDetectedAt: {
    type: Date,
    default: Date.now
  },
  
  // Son tespit edilme tarihi
  lastDetectedAt: {
    type: Date,
    default: Date.now
  },
  
  // Ek meta veriler
  metadata: {
    // Oluşturulma yöntemi (manuel/otomatik)
    creationMethod: {
      type: String,
      enum: ['manuel', 'otomatik', 'ai'],
      default: 'manuel'
    },
    
    // Oluşturan kişi/sistem
    createdBy: {
      type: String,
      default: 'admin'
    },
    
    // Ek notlar
    notes: {
      type: String
    }
  }
}, {
  timestamps: true
});

// İndekslemeleri oluştur (performans için)
swearWordSchema.index({ word: 1, 'variations': 1 });
swearWordSchema.index({ category: 1, isActive: 1 });
swearWordSchema.index({ 'stats.detectionCount': -1 });
swearWordSchema.index({ 'grammar.wordType': 1 });

// Küfür kelimesini arama yöntemi - gelişmiş
swearWordSchema.statics.findByWord = async function(word) {
  if (!word) return null;
  
  const normalizedWord = word.toLowerCase().trim();
  
  // Ana kelimede veya varyasyonlarda ara (sadece aktif olanlar)
  return this.findOne({
    $and: [
      { 
        $or: [
          { word: normalizedWord },
          { variations: normalizedWord }
        ]
      },
      { isActive: true }
    ]
  });
};

// Küfür kelimesini kategori ve seviyeye göre arama
swearWordSchema.statics.findByCategory = async function(category, severityLevel = null) {
  const query = { category, isActive: true };
  
  // Eğer belirtilmişse şiddet seviyesine göre filtreleme yap
  if (severityLevel) {
    query.severityLevel = severityLevel;
  }
  
  return this.find(query).sort({ 'stats.detectionCount': -1 });
};

// Fuzzy arama - benzer kelimeler için bulanık arama
swearWordSchema.statics.fuzzySearch = async function(searchTerm, threshold = 0.7) {
  if (!searchTerm) return [];
  
  // MongoDB $text indeksi ile arama yapar
  // Bu optimizasyon için `word` alanına text indeksi eklenmelidir
  const results = await this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
  .select('word variations category severityLevel stats.detectionCount')
  .sort({ score: { $meta: 'textScore' } })
  .limit(10);
  
  return results;
};

// En çok tespit edilen küfürleri getir
swearWordSchema.statics.getMostDetected = async function(limit = 20) {
  return this.find({ isActive: true })
    .sort({ 'stats.detectionCount': -1 })
    .limit(limit)
    .select('word category severityLevel stats.detectionCount variations');
};

// Varyasyonları güncelleme yöntemi - geliştirilmiş
swearWordSchema.methods.updateWithVariations = async function(variations = []) {
  // Önceki varyasyonları koru, yenileri ekle
  const uniqueVariations = [...new Set([
    ...this.variations,
    ...variations.map(v => v.toLowerCase().trim())
  ])];
  
  // Kendisini varyasyon olarak ekleme
  const uniqueFiltered = uniqueVariations.filter(v => v !== this.word);
  
  this.variations = uniqueFiltered;
  
  // İstatistikleri güncelle
  if (!this.stats) {
    this.stats = {
      detectionCount: 1,
      variationDetections: 0,
      falsePositiveReports: 0,
      lastUpdated: new Date()
    };
  } else {
    this.stats.detectionCount += 1;
    this.stats.variationDetections += 1;
    this.stats.lastUpdated = new Date();
  }
  
  this.lastDetectedAt = new Date();
  
  return this.save();
};

// Yanlış pozitif rapor etme
swearWordSchema.methods.reportFalsePositive = async function() {
  if (!this.stats) {
    this.stats = { 
      falsePositiveReports: 1,
      lastUpdated: new Date()
    };
  } else {
    this.stats.falsePositiveReports = (this.stats.falsePositiveReports || 0) + 1;
    this.stats.lastUpdated = new Date();
  }
  
  // Yanlış pozitif sayısı belirli bir eşiği aşarsa, kelimeyi devre dışı bırak
  if (this.stats.falsePositiveReports > 20 && 
      this.stats.falsePositiveReports > this.stats.detectionCount * 0.3) {
    this.isActive = false;
  }
  
  return this.save();
};

// AI ile tespit edilen bilgileri ekleme
swearWordSchema.methods.updateWithAiData = async function(aiData) {
  // AI tespit bilgilerini ekle
  if (aiData.category && this.category === 'diğer') {
    this.category = aiData.category;
  }
  
  if (aiData.severityLevel) {
    this.severityLevel = aiData.severityLevel;
  }
  
  if (aiData.alternatives && aiData.alternatives.length) {
    // Halihazırda var olan alternatiflere yeni gelenleri ekle
    const existingAlts = this.alternatives.map(alt => 
      typeof alt === 'string' ? alt : alt.word
    );
    
    // Yeni alternatifler
    const newAlts = aiData.alternatives.filter(alt => 
      !existingAlts.includes(typeof alt === 'string' ? alt : alt.word)
    );
    
    // Obje formatına dönüştür
    const formattedAlts = newAlts.map(alt => 
      typeof alt === 'string' ? { word: alt, suitability: 3 } : alt
    );
    
    this.alternatives = [...this.alternatives, ...formattedAlts];
  }
  
  // Tespit edilme zamanını güncelle
  this.lastDetectedAt = new Date();
  
  // Güven puanını güncelle (AI verilerine dayanarak)
  if (this.confidenceScore < 0.95) {
    this.confidenceScore = Math.min(0.95, this.confidenceScore + 0.05);
  }
  
  return this.save();
};

// İlişkili kelime ekleme
swearWordSchema.methods.addRelatedWord = async function(relatedWordId, relationType = 'benzer', relationStrength = 0.5) {
  // Zaten ilişkili mi kontrol et
  const existingRelation = this.relatedWords.find(rel => 
    rel.word.toString() === relatedWordId.toString()
  );
  
  if (existingRelation) {
    // Mevcut ilişkiyi güncelle
    existingRelation.relationStrength = Math.min(1, existingRelation.relationStrength + 0.1);
    existingRelation.relationType = relationType;
  } else {
    // Yeni ilişki ekle
    this.relatedWords.push({
      word: relatedWordId,
      relationType,
      relationStrength
    });
  }
  
  return this.save();
};

const SwearWord = mongoose.model('SwearWord', swearWordSchema);

module.exports = SwearWord;
