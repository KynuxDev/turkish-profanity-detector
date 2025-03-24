/**
 * Swagger dokümantasyon yapılandırması
 */

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

// Swagger tanımlaması
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Küfür Tespit API',
      version: '1.0.0',
      description: 'Metin içindeki küfür/hakaret içeren kelimeleri tespit eden ve veritabanına kaydeden API',
      contact: {
        name: 'API Desteği',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Geliştirme sunucusu'
      }
    ],
    components: {
      schemas: {
        SwearDetectionRequest: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Kontrol edilecek metin'
            }
          },
          required: ['text']
        },
        SwearDetectionResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'İşlemin başarı durumu'
            },
            result: {
              type: 'object',
              properties: {
                isSwear: {
                  type: 'boolean',
                  description: 'Küfür tespit edildi mi'
                },
                details: {
                  type: 'object',
                  nullable: true,
                  description: 'Küfür tespit edildiğinde detaylar',
                  properties: {
                    word: {
                      type: 'string',
                      description: 'Tespit edilen küfür kelimesi'
                    },
                    category: {
                      type: 'string',
                      description: 'Küfürün kategorisi'
                    },
                    severityLevel: {
                      type: 'number',
                      description: 'Şiddet seviyesi (1-5)'
                    },
                    detectedWords: {
                      type: 'array',
                      items: {
                        type: 'string'
                      },
                      description: 'Tespit edilen tüm küfür kelimeleri'
                    }
                  }
                },
                aiDetected: {
                  type: 'boolean',
                  description: 'AI modeli tarafından tespit edildi mi'
                }
              }
            }
          }
        },
        StatisticsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'İşlemin başarı durumu'
            },
            statistics: {
              type: 'object',
              properties: {
                totalSwearWords: {
                  type: 'number',
                  description: 'Toplam küfür kelimesi sayısı'
                },
                topSwearWords: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      word: {
                        type: 'string',
                        description: 'Küfür kelimesi'
                      },
                      category: {
                        type: 'string',
                        description: 'Kategori'
                      },
                      severityLevel: {
                        type: 'number',
                        description: 'Şiddet seviyesi'
                      },
                      detectionCount: {
                        type: 'number',
                        description: 'Tespit sayısı'
                      }
                    }
                  },
                  description: 'En çok tespit edilen küfürler'
                },
                categoryCounts: {
                  type: 'object',
                  description: 'Kategorilere göre dağılım'
                }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'İşlemin başarı durumu'
            },
            message: {
              type: 'string',
              description: 'Hata mesajı'
            },
            error: {
              type: 'string',
              description: 'Hata detayı'
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js'], // Rota dosyaları
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = {
  swaggerUI,
  swaggerDocs
};
