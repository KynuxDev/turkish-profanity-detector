/**
 * Küfür Tespit Veritabanı Başlatma ve Test Scripti
 * 
 * Bu script, veritabanına temel küfür kelimelerini ekler, varyasyonlarını oluşturur
 * ve tespit sistemini test eder. Ayrıca, yapay zeka ile varyasyon zenginleştirmesi yapar.
 * 
 * Kullanım: node test/swearDbSeeder.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SwearWord = require('../models/swearWord');
const swearDetectionService = require('../services/swearDetectionService');
const OpenAI = require('openai');
const readline = require('readline');

// Renkli konsol çıktıları için
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m'
  }
};

// API istemcisi yapılandırması
let client;

try {
  client = new OpenAI({
    apiKey: process.env.API_KEY || '',
    baseURL: process.env.AI_API_BASE_URL || 'https://api.claude.gg/v1'
  });
} catch (error) {
  console.error(`${colors.fg.red}OpenAI istemci oluşturma hatası:${colors.reset}`, error);
  process.exit(1);
}

// Kullanıcı giriş-çıkış yardımcısı
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Temel küfür kelimeleri listesi (örnek/başlangıç veri seti)
const basicSwearWords = [
  {
    word: 'küfürkelimesi1',
    category: 'hakaret',
    severityLevel: 4,
    variations: ['kufurkelimesi1', 'k*f*rkelimesi1'],
    grammar: { wordType: 'isim', root: 'küfürkelimesi1' }
  },
  {
    word: 'küfürkelimesi2',
    category: 'cinsel',
    severityLevel: 5,
    variations: ['kufurkelimesi2', 'k*f*rkelimesi2'],
    grammar: { wordType: 'fiil', root: 'küfürkelimesi2' }
  },
  {
    word: 'argosöz',
    category: 'argo',
    severityLevel: 2,
    variations: ['argosoz', 'argo söz'],
    grammar: { wordType: 'deyim', root: 'argo' }
  },
  {
    word: 'hakaretkelimesi',
    category: 'hakaret',
    severityLevel: 3,
    variations: ['hakaretkelimesi', 'h*k*r*t'],
    grammar: { wordType: 'sıfat', root: 'hakaret' }
  },
  {
    word: 'küfürkelimesi3',
    category: 'tehdit',
    severityLevel: 4,
    variations: ['kufurkelimesi3', 'k.kelimesi3'],
    grammar: { wordType: 'fiil', root: 'küfür' }
  }
];

/**
 * MongoDB bağlantısını kurar
 */
async function connectToDatabase() {
  try {
    console.log(`${colors.fg.cyan}MongoDB'ye bağlanılıyor...${colors.reset}`);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      retryWrites: true,
      w: 'majority'
    });
    
    console.log(`${colors.fg.green}MongoDB'ye bağlantı başarılı!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.fg.red}MongoDB bağlantı hatası:${colors.reset}`, error);
    process.exit(1);
  }
}

/**
 * Veritabanına temel küfür kelimelerini ekler
 */
async function seedBasicSwearWords() {
  console.log(`\n${colors.fg.cyan}Temel küfür kelimeleri veritabanına ekleniyor...${colors.reset}`);
  let addedCount = 0;
  let skippedCount = 0;
  
  for (const swearWord of basicSwearWords) {
    try {
      // Zaten varsa atla
      const existing = await SwearWord.findOne({ word: swearWord.word });
      
      if (existing) {
        console.log(`${colors.fg.yellow}Atlandı:${colors.reset} "${swearWord.word}" zaten veritabanında mevcut.`);
        skippedCount++;
        continue;
      }
      
      // SwearWord modelinden yeni bir nesne oluştur
      const newWord = new SwearWord({
        word: swearWord.word,
        category: swearWord.category,
        severityLevel: swearWord.severityLevel,
        variations: swearWord.variations || [],
        source: 'manuel',
        grammar: swearWord.grammar || { wordType: 'diğer' },
        confidenceScore: 1.0,
        isActive: true,
        stats: {
          detectionCount: 1,
          variationDetections: 0,
          falsePositiveReports: 0,
          lastUpdated: new Date()
        },
        metadata: {
          creationMethod: 'manuel',
          createdBy: 'seeder-script',
          notes: 'Test scripti ile eklendi'
        }
      });
      
      await newWord.save();
      console.log(`${colors.fg.green}Eklendi:${colors.reset} "${swearWord.word}"`);
      addedCount++;
    } catch (error) {
      console.error(`${colors.fg.red}Hata:${colors.reset} "${swearWord.word}" kelimesi eklenirken hata oluştu:`, error.message);
    }
  }
  
  console.log(`\n${colors.bg.green}${colors.fg.black} Sonuç: ${addedCount} kelime eklendi, ${skippedCount} kelime atlandı. ${colors.reset}\n`);
}

/**
 * Yapay zeka ile varyasyon zenginleştirme testi
 */
async function enrichVariationsWithAI() {
  console.log(`\n${colors.fg.cyan}Yapay zeka ile varyasyon zenginleştirme başlatılıyor...${colors.reset}`);
  
  try {
    // Aktif küfür kelimelerini bul
    const words = await SwearWord.find({ isActive: true })
      .sort({ 'stats.detectionCount': -1 })
      .limit(5);
    
    if (!words.length) {
      console.log(`${colors.fg.yellow}İşlenecek kelime bulunamadı.${colors.reset}`);
      return;
    }
    
    console.log(`${colors.fg.cyan}${words.length} kelime işlenecek.${colors.reset}`);
    
    let totalNewVariations = 0;
    
    for (const word of words) {
      console.log(`\n${colors.bright}${colors.fg.blue}"${word.word}" kelimesi için varyasyonlar oluşturuluyor...${colors.reset}`);
      
      // Halihazırda var olan varyasyonları göster
      if (word.variations.length) {
        console.log(`${colors.dim}Mevcut varyasyonlar: ${word.variations.join(', ')}${colors.reset}`);
      }
      
      // AI ile varyasyon analizi
      const prompt = `"${word.word}" kelimesi için Türkçe'de kullanılan farklı yazım varyasyonlarını, 
        sansürleme şekillerini ve karakter değişimleriyle yazılabilecek olası tüm alternatiflerini düşün.
        Şu anda bilinen varyasyonlar: ${word.variations.join(', ')}
        
        Yalnızca yeni varyasyonları JSON dizisi formatında döndür:
        ["varyasyon1", "varyasyon2", ...]`;
      
      try {
        console.log(`${colors.dim}AI'ye sorgu gönderiliyor...${colors.reset}`);
        
        const response = await client.chat.completions.create({
          model: 'o3-mini',
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
          
          // Yeni varyasyonları göster
          if (uniqueNewVariations.length > 0) {
            console.log(`${colors.fg.green}Yeni varyasyonlar:${colors.reset} ${uniqueNewVariations.join(', ')}`);
            
            // Varyasyon sayısını artır
            totalNewVariations += uniqueNewVariations.length;
            
            // Yeni varyasyonları ekle
            word.variations = [...word.variations, ...uniqueNewVariations];
            
            // İstatistikleri güncelle
            if (!word.stats) {
              word.stats = { variationDetections: uniqueNewVariations.length };
            } else {
              word.stats.variationDetections = (word.stats.variationDetections || 0) + uniqueNewVariations.length;
            }
            
            await word.save();
            console.log(`${colors.fg.green}Varyasyonlar başarıyla kaydedildi.${colors.reset}`);
          } else {
            console.log(`${colors.fg.yellow}Yeni varyasyon bulunamadı.${colors.reset}`);
          }
        }
      } catch (aiError) {
        console.error(`${colors.fg.red}AI varyasyon hatası:${colors.reset}`, aiError.message);
      }
    }
    
    console.log(`\n${colors.bg.green}${colors.fg.black} Toplam ${totalNewVariations} yeni varyasyon eklendi. ${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.fg.red}Varyasyon zenginleştirme hatası:${colors.reset}`, error.message);
  }
}

/**
 * Sistemin tespit yeteneklerini test eder
 */
async function testDetectionSystem() {
  console.log(`\n${colors.fg.cyan}Küfür tespit sistemi test ediliyor...${colors.reset}`);
  
  const testCases = [
    // Normal test (temel kelimeler)
    ...basicSwearWords.map(sw => sw.word),
    
    // Varyasyon testleri (karakterleri değiştirilmiş kelimeler)
    'k*f*rkelimesi1',
    'küfürk3lim3si2',
    'ar-go-söz',
    'hakar.et',
    'k ü f ü r kelimesi3',
    
    // AI testleri (hiç olmayan kelimeler - AI tespit etmeli)
    'BURAYA KÜFÜR YAZ BU AI İLE TEST İÇİN',
    'BURAYA KÜFÜR YAZ BU AI İLE TEST İÇİN'
  ];
  
  for (const testText of testCases) {
    console.log(`\n${colors.bright}${colors.fg.blue}Test metni: "${testText}"${colors.reset}`);
    
    try {
      // Metni analiz et
      const result = await swearDetectionService.analyzeText(testText);
      
      if (result.isSwear) {
        console.log(`${colors.bg.red}${colors.fg.white} KÜFÜR TESPİT EDİLDİ ${colors.reset}`);
        console.log(`${colors.fg.yellow}Tespit edilen kelime:${colors.reset} ${result.result.word}`);
        console.log(`${colors.fg.yellow}Kategori:${colors.reset} ${result.result.category}`);
        console.log(`${colors.fg.yellow}Şiddet seviyesi:${colors.reset} ${result.result.severityLevel}`);
        
        if (result.detectedWords.length > 0) {
          console.log(`${colors.fg.yellow}Tespit edilen tüm kelimeler:${colors.reset} ${result.detectedWords.map(dw => dw.original).join(', ')}`);
        }
      } else {
        console.log(`${colors.bg.green}${colors.fg.black} KÜFÜR TESPİT EDİLMEDİ ${colors.reset}`);
      }
    } catch (error) {
      console.error(`${colors.fg.red}Test hatası:${colors.reset}`, error.message);
    }
  }
}

/**
 * Ana seeder fonksiyonu
 */
async function runSeeder() {
  try {
    // Veritabanına bağlan
    await connectToDatabase();
    
    console.log(`
${colors.bright}${colors.fg.magenta}=================================================
      KÜFÜR TESPİT SİSTEMİ - TEST ARAÇLARI
==================================================${colors.reset}

Bu script, veritabanı işlemleri ve tespit yeteneğini test eder.
`);
    
    // Menü oluştur
    const showMenu = () => {
      console.log(`\n${colors.fg.cyan}Lütfen bir işlem seçin:${colors.reset}`);
      console.log(`${colors.fg.white}1)${colors.reset} Temel küfür kelimelerini ekle`);
      console.log(`${colors.fg.white}2)${colors.reset} Yapay zeka ile varyasyon zenginleştir`);
      console.log(`${colors.fg.white}3)${colors.reset} Tespit sistemini test et`);
      console.log(`${colors.fg.white}4)${colors.reset} Tüm işlemleri sırayla çalıştır`);
      console.log(`${colors.fg.white}0)${colors.reset} Çıkış\n`);
      
      rl.question(`${colors.fg.yellow}Seçiminiz (0-4):${colors.reset} `, async (answer) => {
        switch (answer.trim()) {
          case '1':
            await seedBasicSwearWords();
            showMenu();
            break;
          case '2':
            await enrichVariationsWithAI();
            showMenu();
            break;
          case '3':
            await testDetectionSystem();
            showMenu();
            break;
          case '4':
            await seedBasicSwearWords();
            await enrichVariationsWithAI();
            await testDetectionSystem();
            showMenu();
            break;
          case '0':
            console.log(`\n${colors.fg.green}İşlem tamamlandı. İyi günler!${colors.reset}`);
            await mongoose.connection.close();
            rl.close();
            break;
          default:
            console.log(`\n${colors.fg.red}Geçersiz seçim. Lütfen tekrar deneyin.${colors.reset}`);
            showMenu();
            break;
        }
      });
    };
    
    showMenu();
  } catch (error) {
    console.error(`${colors.fg.red}Seeder çalıştırma hatası:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Scripti çalıştır
runSeeder();
