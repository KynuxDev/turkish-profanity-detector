/**
 * Küfür Tespit API Test Dosyası
 */

const axios = require('axios');
const mongoose = require('mongoose');
const SwearWord = require('../models/swearWord');
require('dotenv').config();

// Test yapılandırması
const API_BASE_URL = 'http://localhost:3000/api/swear';

/**
 * Test öncesi hazırlık - Test veritabanı bağlantısı ve örnek küfür verileri
 */
const setupTestDb = async () => {
  try {
    // MongoDB test veritabanı bağlantısı
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Test için veritabanını temizleme
    await SwearWord.deleteMany({});
    
    // Örnek test küfürleri ekleme
    const sampleSwearWords = [
      {
        word: 'amk',
        variations: ['@mk', 'a.m.k', 'amq'],
        category: 'argo',
        severityLevel: 3,
        detectionCount: 5
      },
      {
        word: 'mal',
        variations: ['m@l'],
        category: 'hakaret',
        severityLevel: 2,
        detectionCount: 3
      }
    ];
    
    await SwearWord.insertMany(sampleSwearWords);
    console.log('✅ Test veritabanı hazırlandı');
  } catch (error) {
    console.error('❌ Test veritabanı hazırlama hatası:', error);
    process.exit(1);
  }
};

/**
 * Test sonrası temizlik - Test veritabanı bağlantısını kapatma
 */
const cleanupTestDb = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ Test veritabanı bağlantısı kapatıldı');
  } catch (error) {
    console.error('❌ Test veritabanı kapatma hatası:', error);
  }
};

/**
 * Küfür tespit testi
 */
const testSwearDetection = async () => {
  try {
    console.log('\n🧪 Küfür tespit testleri başlatılıyor...');
    
    // Test 1: Bilinen bir küfür kelimesi
    console.log('\nTest 1: Bilinen bir küfür kelimesi');
    const test1Response = await axios.get(`${API_BASE_URL}/detect`, {
      params: { text: 'bu bir amk test mesajıdır' }
    });
    
    console.log('Yanıt:', JSON.stringify(test1Response.data, null, 2));
    console.assert(test1Response.data.result.isSwear === true, 'Küfür tespit edilmedi');
    console.log(test1Response.data.result.isSwear ? '✅ Test başarılı' : '❌ Test başarısız');
    
    // Test 2: Varyasyonları olan bir küfür kelimesi
    console.log('\nTest 2: Varyasyonu olan bir küfür kelimesi');
    const test2Response = await axios.get(`${API_BASE_URL}/detect`, {
      params: { text: 'bu bir @mk test mesajıdır' }
    });
    
    console.log('Yanıt:', JSON.stringify(test2Response.data, null, 2));
    console.assert(test2Response.data.result.isSwear === true, 'Küfür varyasyonu tespit edilmedi');
    console.log(test2Response.data.result.isSwear ? '✅ Test başarılı' : '❌ Test başarısız');
    
    // Test 3: Küfür içermeyen bir metin
    console.log('\nTest 3: Küfür içermeyen bir metin');
    const test3Response = await axios.get(`${API_BASE_URL}/detect`, {
      params: { text: 'bu tamamen temiz bir mesajdır' }
    });
    
    console.log('Yanıt:', JSON.stringify(test3Response.data, null, 2));
    console.assert(test3Response.data.result.isSwear === false, 'Yanlış pozitif tespit');
    console.log(test3Response.data.result.isSwear === false ? '✅ Test başarılı' : '❌ Test başarısız');
    
    // Test 4: AI modeli ile analiz (daha önce veritabanında olmayan bir kelime)
    console.log('\nTest 4: AI modeli ile analiz');
    const test4Response = await axios.get(`${API_BASE_URL}/detect`, {
      params: { text: 'sen bir gerizekalısın' }
    });
    
    console.log('Yanıt:', JSON.stringify(test4Response.data, null, 2));
    // Not: AI analizi sonucu değişken olabilir
    console.log('⚠️ AI sonuçları değişken olabilir, manuel kontrol:',
      test4Response.data.result.isSwear ? 'Küfür tespit edildi' : 'Küfür tespit edilmedi');
  } catch (error) {
    console.error('❌ Test hatası:', error.response ? error.response.data : error.message);
  }
};

/**
 * İstatistik testi
 */
const testStatistics = async () => {
  try {
    console.log('\n🧪 İstatistik testleri başlatılıyor...');
    
    const statsResponse = await axios.get(`${API_BASE_URL}/stats`);
    console.log('İstatistikler:', JSON.stringify(statsResponse.data, null, 2));
    
    console.assert(statsResponse.data.success === true, 'İstatistikler alınamadı');
    console.assert(statsResponse.data.statistics.totalSwearWords >= 2, 'Test kelimeler eksik');
    
    console.log(
      statsResponse.data.success && statsResponse.data.statistics.totalSwearWords >= 2
        ? '✅ Test başarılı'
        : '❌ Test başarısız'
    );
  } catch (error) {
    console.error('❌ Test hatası:', error.response ? error.response.data : error.message);
  }
};

/**
 * Ana test fonksiyonu
 */
const runTests = async () => {
  try {
    console.log('🚀 Küfür Tespit API Testleri Başlatılıyor');
    
    // Test veritabanını hazırla
    await setupTestDb();
    
    // Testleri çalıştır
    await testSwearDetection();
    await testStatistics();
    
    // Test veritabanını temizle
    await cleanupTestDb();
    
    console.log('\n✅ Tüm testler tamamlandı');
  } catch (error) {
    console.error('❌ Test çalıştırma hatası:', error);
  }
};

// Testleri başlat
runTests();
