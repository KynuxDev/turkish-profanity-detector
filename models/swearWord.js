const mongoose = require('mongoose');

// Küfür kelimesi şeması
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
  
  // Kategorisi (ör: hakaret, cinsel, dini, vb.)
  category: {
    type: String,
    enum: ['hakaret', 'cinsel', 'dini', 'argo', 'diğer'],
    default: 'diğer'
  },
  
  // Şiddet seviyesi (1-5)
  severityLevel: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  
  // Alternatif öneriler (sansürlü versiyonlar)
  alternatives: [{
    type: String,
    trim: true
  }],
  
  // Tespit sayısı
  detectionCount: {
    type: Number,
    default: 1
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
  }
}, {
  timestamps: true
});

// Küfür kelimesini arama yöntemi
swearWordSchema.statics.findByWord = async function(word) {
  if (!word) return null;
  
  const normalizedWord = word.toLowerCase().trim();
  
  // Ana kelimede veya varyasyonlarda ara
  return this.findOne({
    $or: [
      { word: normalizedWord },
      { variations: normalizedWord }
    ]
  });
};

// Varyasyonları güncelleme yöntemi
swearWordSchema.methods.updateWithVariations = async function(variations = []) {
  // Önceki varyasyonları koru, yenileri ekle
  const uniqueVariations = [...new Set([
    ...this.variations,
    ...variations.map(v => v.toLowerCase().trim())
  ])];
  
  // Kendisini varyasyon olarak ekleme
  const uniqueFiltered = uniqueVariations.filter(v => v !== this.word);
  
  this.variations = uniqueFiltered;
  this.detectionCount += 1;
  this.lastDetectedAt = new Date();
  
  return this.save();
};

const SwearWord = mongoose.model('SwearWord', swearWordSchema);

module.exports = SwearWord;
