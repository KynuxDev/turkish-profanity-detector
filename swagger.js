/**
 * Swagger dokümantasyon yapılandırması - Gelişmiş Sürüm
 * 
 * Modern UI ve geliştirilmiş dokümantasyon ile tam kapsamlı API arayüzü.
 */

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

// Desteklenen AI modelleri
const supportedModels = [
  "gpt-4.5",
  "o3-mini",
  "claude-3-7-sonnet",
  "claude-3-5-sonnet", 
  "chatgpt-latest",
  "gpt-4o",
  "gpt-4",
  "gpt-4-turbo",
  "claude-v3-opus",
  "claude-3-haiku",
  "gemini-2.0-pro",
  "gemini-2.0-flash",
  "command-r-plus",
  "command-r"
];

// Swagger tanımlaması
const swaggerOptions = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Küfür Tespit API',
      version: '1.2.0',
      description: `
## Gelişmiş Türkçe Küfür Tespit API'si

Yapay zeka destekli, yüksek doğruluklu küfür/hakaret tespit sistemi. Karakter değişimi yapılmış tüm varyasyonları yakalayan, otomatik öğrenen ve veritabanını sürekli zenginleştiren API.

### Temel Özellikler
- Ultra hassas küfür tespiti
- Kapsamlı varyasyon tanıma (6 farklı algoritma)
- Otomatik öğrenme ve veritabanı zenginleştirme
- İlişkisel veri modeli ile gelişmiş analiz
- Çoklu AI model desteği`,
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      contact: {
        name: 'API Desteği',
        email: 'support@example.com',
        url: 'https://github.com/kynuxdev/turkish-profanity-detector'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Geliştirme sunucusu'
      },
      {
        url: 'https://api.example.com',
        description: 'Üretim sunucusu'
      }
    ],
    tags: [
      {
        name: "Küfür Tespiti",
        description: "Metin içindeki küfürleri tespit etme APIleri"
      },
      {
        name: "Küfür Yönetimi",
        description: "Küfür veritabanı yönetimi için APIler"
      },
      {
        name: "İstatistikler ve Analiz",
        description: "Tespit istatistikleri ve veri analizi"
      },
      {
        name: "Varyasyon Yönetimi",
        description: "Küfür kelimelerinin varyasyonlarını yönetme ve zenginleştirme APIleri"
      },
      {
        name: "Yapay Zeka",
        description: "Yapay zeka model yönetimi"
      }
    ],
    externalDocs: {
      description: "GitHub Repository",
      url: "https://github.com/kynuxdev/turkish-profanity-detector"
    },
    components: {
      schemas: {
        SwearDetectionRequest: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Kontrol edilecek metin',
              example: 'Bu bir test cümlesidir'
            },
            useAI: {
              type: 'boolean',
              description: 'Yapay zeka kullanılsın mı?',
              default: true
            },
            model: {
              type: 'string',
              description: 'Kullanılacak yapay zeka modeli',
              enum: supportedModels,
              default: 'claude-3-haiku'
            },
            confidence: {
              type: 'number',
              description: 'Minimum güven eşiği (0-1 arası)',
              minimum: 0,
              maximum: 1,
              default: 0.7
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
                      description: 'Küfürün kategorisi',
                      enum: ['hakaret', 'cinsel', 'dini', 'argo', 'ırkçı', 'cinsiyetçi', 'homofobik', 'tehdit', 'politik', 'ayrımcı', 'diğer']
                    },
                    severityLevel: {
                      type: 'number',
                      description: 'Şiddet seviyesi (1-5)',
                      enum: [1, 2, 3, 4, 5]
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
                  description: 'Yapay zeka tarafından tespit edildi mi'
                },
                aiConfidence: {
                  type: 'number',
                  description: 'Yapay zeka güven skoru (0-1 arası)',
                  nullable: true
                },
                fromCache: {
                  type: 'boolean',
                  description: 'Önbellekten mi geldi',
                  nullable: true
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
                activeSwearWords: {
                  type: 'number',
                  description: 'Aktif küfür kelimesi sayısı'
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
                      variations: {
                        type: 'array',
                        items: {
                          type: 'string'
                        },
                        description: 'Kelime varyasyonları'
                      },
                      stats: {
                        type: 'object',
                        properties: {
                          detectionCount: {
                            type: 'number',
                            description: 'Tespit sayısı'
                          },
                          variationDetections: {
                            type: 'number',
                            description: 'Varyasyon tespit sayısı'
                          }
                        }
                      },
                      source: {
                        type: 'string',
                        description: 'Tespit kaynağı',
                        enum: ['manuel', 'ai_detected', 'kullanıcı_bildirimi', 'otomatik_tespit', 'varyasyon_eşleşmesi']
                      },
                      confidenceScore: {
                        type: 'number',
                        description: 'Güven puanı'
                      }
                    }
                  },
                  description: 'En çok tespit edilen küfürler'
                },
                recentlyAdded: {
                  type: 'array',
                  items: {
                    type: 'object'
                  },
                  description: 'Son eklenen küfürler'
                },
                categoryCounts: {
                  type: 'object',
                  description: 'Kategorilere göre dağılım'
                },
                severityCounts: {
                  type: 'object',
                  description: 'Şiddet seviyesine göre dağılım'
                },
                sourceCounts: {
                  type: 'object',
                  description: 'Kaynaklara göre dağılım'
                },
                topVariationCounts: {
                  type: 'array',
                  items: {
                    type: 'object'
                  },
                  description: 'En çok varyasyona sahip kelimeler'
                }
              }
            }
          }
        },
        AddSwearWordRequest: {
          type: 'object',
          properties: {
            word: {
              type: 'string',
              description: 'Eklenecek küfür kelimesi',
              example: 'örnek_küfür_kelimesi'
            },
            category: {
              type: 'string',
              description: 'Kategori',
              enum: ['hakaret', 'cinsel', 'dini', 'argo', 'ırkçı', 'cinsiyetçi', 'homofobik', 'tehdit', 'politik', 'ayrımcı', 'diğer'],
              default: 'diğer'
            },
            severityLevel: {
              type: 'integer',
              description: 'Şiddet seviyesi (1-5)',
              minimum: 1,
              maximum: 5,
              default: 3
            },
            variations: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Kelime varyasyonları',
              example: ['0rnek_kufur', 'örnek_k*f*r']
            },
            alternatives: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Alternatif kelimeler',
              example: ['uygun_kelime']
            }
          },
          required: ['word']
        },
        FalsePositiveRequest: {
          type: 'object',
          properties: {
            word: {
              type: 'string',
              description: 'Yanlış positif olarak rapor edilecek kelime',
              example: 'yanlis_tespit_edilen_kelime'
            }
          },
          required: ['word']
        },
        BulkImportRequest: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'İçe aktarılacak dosyanın yolu',
              example: '/path/to/swearwords.json'
            },
            format: {
              type: 'string',
              enum: ['json', 'csv', 'text'],
              default: 'json',
              description: 'Dosya formatı'
            },
            overwrite: {
              type: 'boolean',
              default: false,
              description: 'Mevcut kayıtlar üzerine yazılsın mı?'
            }
          },
          required: ['filePath']
        },
        ModelList: {
          type: 'object',
          properties: {
            object: {
              type: 'string',
              default: 'list'
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Model ID'
                  },
                  object: {
                    type: 'string',
                    default: 'model'
                  },
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
              description: 'İşlemin başarı durumu',
              default: false
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
      },
      parameters: {
        TextParam: {
          name: 'text',
          in: 'query',
          description: 'Kontrol edilecek metin',
          required: true,
          schema: {
            type: 'string'
          }
        },
        UseAIParam: {
          name: 'useAI',
          in: 'query',
          description: 'Yapay zeka kullanılsın mı?',
          required: false,
          schema: {
            type: 'boolean',
            default: true
          }
        },
        ModelParam: {
          name: 'model',
          in: 'query',
          description: 'Kullanılacak yapay zeka modeli',
          required: false,
          schema: {
            type: 'string',
            enum: supportedModels,
            default: 'gpt-4.5'
          }
        },
        ConfidenceParam: {
          name: 'confidence',
          in: 'query',
          description: 'Minimum güven eşiği (0-1 arası)',
          required: false,
          schema: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 0.7
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Geçersiz istek',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Sunucu hatası',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        TooManyRequests: {
          description: 'Çok fazla istek',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    example: 429
                  },
                  message: {
                    type: 'string',
                    example: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'
                  }
                }
              }
            }
          }
        }
      },
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-KEY',
          description: 'Admin işlemleri için API güvenlik anahtarı'
        }
      }
    },
    paths: {
      '/api/swear/detect': {
        get: {
          summary: 'Metinde küfür tespiti yapar',
          description: 'Verilen metinde küfür/hakaret olup olmadığını tespit eder, gerekirse yapay zeka kullanır',
          tags: ['Küfür Tespiti'],
          parameters: [
            { $ref: '#/components/parameters/TextParam' },
            { $ref: '#/components/parameters/UseAIParam' },
            { $ref: '#/components/parameters/ModelParam' },
            { $ref: '#/components/parameters/ConfidenceParam' }
          ],
          responses: {
            '200': {
              description: 'Başarılı tespit',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SwearDetectionResponse'
                  },
                  examples: {
                    'Küfür Tespit Edildi': {
                      value: {
                        success: true,
                        result: {
                          isSwear: true,
                          details: {
                            word: 'ornek_kufur',
                            category: 'argo',
                            severityLevel: 3,
                            detectedWords: ['ornek_kufur']
                          },
                          aiDetected: false
                        }
                      }
                    },
                    'Küfür Tespit Edilmedi': {
                      value: {
                        success: true,
                        result: {
                          isSwear: false,
                          details: null,
                          aiDetected: false
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '429': { $ref: '#/components/responses/TooManyRequests' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/stats': {
        get: {
          summary: 'Küfür istatistiklerini getirir',
          description: 'Veritabanındaki küfür kelimelerinin detaylı istatistiklerini getirir - filtreler ve sıralama seçenekleriyle',
          tags: ['İstatistikler ve Analiz'],
          security: [
            { ApiKeyAuth: [] }
          ],
          parameters: [
            {
              name: 'category',
              in: 'query',
              description: 'Kategori filtresi',
              required: false,
              schema: {
                type: 'string'
              }
            },
            {
              name: 'minSeverity',
              in: 'query',
              description: 'Minimum şiddet seviyesi',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 5
              }
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Sonuç limiti',
              required: false,
              schema: {
                type: 'integer',
                default: 20
              }
            },
            {
              name: 'source',
              in: 'query',
              description: 'Kaynak filtresi',
              required: false,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Başarılı',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StatisticsResponse'
                  }
                }
              }
            },
            '429': { $ref: '#/components/responses/TooManyRequests' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/word': {
        post: {
          summary: 'Yeni bir küfür kelimesi ekler',
          description: 'Veritabanına yeni bir küfür kelimesi ve ilişkili bilgilerini ekler',
          tags: ['Küfür Yönetimi'],
          security: [
            { ApiKeyAuth: [] }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AddSwearWordRequest'
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Kelime başarıyla eklendi',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      message: {
                        type: 'string',
                        example: 'Küfür kelimesi başarıyla eklendi'
                      },
                      word: {
                        type: 'object'
                      }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '409': {
              description: 'Kelime zaten mevcut',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false
                      },
                      message: {
                        type: 'string',
                        example: 'Bu kelime zaten veritabanında mevcut'
                      },
                      existingWord: {
                        type: 'object'
                      }
                    }
                  }
                }
              }
            },
            '429': { $ref: '#/components/responses/TooManyRequests' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/word/{id}': {
        delete: {
          summary: 'Bir küfür kelimesini siler veya devre dışı bırakır',
          description: 'Bir küfür kelimesini veritabanından tamamen siler veya devre dışı bırakır',
          tags: ['Küfür Yönetimi'],
          security: [
            { ApiKeyAuth: [] }
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Silinecek kelimenin ID\'si'
            },
            {
              name: 'deactivateOnly',
              in: 'query',
              required: false,
              schema: {
                type: 'boolean',
                default: true
              },
              description: 'Sadece devre dışı bırak (true) veya tamamen sil (false)'
            }
          ],
          responses: {
            '200': {
              description: 'Kelime başarıyla silindi veya devre dışı bırakıldı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      message: {
                        type: 'string',
                        example: 'Kelime başarıyla devre dışı bırakıldı'
                      },
                      word: {
                        type: 'object'
                      }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': {
              description: 'Kelime bulunamadı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false
                      },
                      message: {
                        type: 'string',
                        example: 'Belirtilen kelime bulunamadı'
                      }
                    }
                  }
                }
              }
            },
            '429': { $ref: '#/components/responses/TooManyRequests' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/report-false-positive': {
        post: {
          summary: 'Yanlış pozitif tespiti rapor eder',
          description: 'Hatalı şekilde küfür olarak tespit edilen bir kelimeyi rapor eder',
          tags: ['Küfür Tespiti'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FalsePositiveRequest'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Yanlış pozitif başarıyla rapor edildi',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      message: {
                        type: 'string',
                        example: 'Yanlış pozitif başarıyla rapor edildi'
                      },
                      word: {
                        type: 'object'
                      }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': {
              description: 'Kelime bulunamadı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false
                      },
                      message: {
                        type: 'string',
                        example: 'Rapor edilecek kelime veritabanında bulunamadı'
                      }
                    }
                  }
                }
              }
            },
            '429': { $ref: '#/components/responses/TooManyRequests' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/bulk-import': {
        post: {
          summary: 'Toplu küfür listesi içe aktarır',
          description: 'CSV, JSON veya metin dosyasından toplu küfür listesi içe aktarır',
          tags: ['Küfür Yönetimi'],
          security: [
            { ApiKeyAuth: [] }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BulkImportRequest'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'İçe aktarım başarıyla tamamlandı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      message: {
                        type: 'string',
                        example: 'Toplu içe aktarım tamamlandı'
                      },
                      results: {
                        type: 'object',
                        properties: {
                          totalProcessed: {
                            type: 'integer'
                          },
                          added: {
                            type: 'integer'
                          },
                          updated: {
                            type: 'integer'
                          },
                          skipped: {
                            type: 'integer'
                          },
                          errors: {
                            type: 'array',
                            items: {
                              type: 'object'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': {
              description: 'Dosya bulunamadı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false
                      },
                      message: {
                        type: 'string',
                        example: 'Belirtilen dosya bulunamadı veya erişilemedi'
                      }
                    }
                  }
                }
              }
            },
            '429': { $ref: '#/components/responses/TooManyRequests' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/enrich-variations': {
        post: {
          summary: 'AI ile varyasyonları zenginleştirir',
          description: 'Yapay zeka kullanarak küfür kelimelerinin varyasyonlarını otomatik olarak zenginleştirir',
          tags: ['Küfür Yönetimi'],
          security: [
            { ApiKeyAuth: [] }
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'integer',
                default: 5
              },
              description: 'İşlenecek kelime sayısı'
            },
            {
              name: 'minDetections',
              in: 'query',
              required: false,
              schema: {
                type: 'integer',
                default: 2
              },
              description: 'Minimum tespit sayısı'
            },
            {
              name: 'model',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: supportedModels,
                default: 'claude-3-haiku'
              },
              description: 'Kullanılacak yapay zeka modeli'
            }
          ],
          responses: {
            '200': {
              description: 'Varyasyon zenginleştirme başarıyla tamamlandı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      message: {
                        type: 'string',
                        example: 'Varyasyon zenginleştirme tamamlandı'
                      },
                      results: {
                        type: 'object',
                        properties: {
                          totalProcessed: {
                            type: 'integer'
                          },
                          enriched: {
                            type: 'integer'
                          },
                          newVariationsAdded: {
                            type: 'integer'
                          },
                          errors: {
                            type: 'array',
                            items: {
                              type: 'object'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'İşlenecek kelime bulunamadı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false
                      },
                      message: {
                        type: 'string',
                        example: 'İşleme alınacak kelime bulunamadı'
                      }
                    }
                  }
                }
              }
            },
            '429': { $ref: '#/components/responses/TooManyRequests' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/models': {
        get: {
          summary: 'Desteklenen AI modellerini getirir',
          description: 'API tarafından desteklenen tüm yapay zeka modellerinin listesini getirir',
          tags: ['Yapay Zeka'],
          responses: {
            '200': {
              description: 'Model listesi başarıyla getirildi',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ModelList'
                  },
                  example: {
                    "object": "list",
                    "data": supportedModels.map(model => ({
                      "id": model,
                      "object": "model",
                    }))
                  }
                }
              }
            }
          }
        }
      },
      '/api/swear/variations/{word}': {
        get: {
          summary: 'Kelime için varyasyonları getirir',
          description: 'Belirli bir kelimenin tüm kaydedilmiş varyasyonlarını veritabanından getirir',
          tags: ['Varyasyon Yönetimi'],
          parameters: [
            {
              name: 'word',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Varyasyonları getirilecek kelime'
            }
          ],
          responses: {
            '200': {
              description: 'Varyasyonlar başarıyla getirildi',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'object',
                        properties: {
                          baseWord: {
                            type: 'string',
                            description: 'Ana kelime'
                          },
                          variations: {
                            type: 'array',
                            items: {
                              type: 'string'
                            },
                            description: 'Kelime varyasyonları'
                          },
                          count: {
                            type: 'integer',
                            description: 'Varyasyon sayısı'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'Kelime bulunamadı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false
                      },
                      message: {
                        type: 'string',
                        example: 'Belirtilen kelime için varyasyon bulunamadı'
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/variations/{word}/enrich': {
        post: {
          summary: 'Belirli bir kelime için varyasyonları zenginleştirir',
          description: 'Algoritma ve yapay zeka kullanarak bir kelimenin varyasyonlarını zenginleştirir ve veritabanına kaydeder',
          tags: ['Varyasyon Yönetimi'],
          security: [
            { ApiKeyAuth: [] }
          ],
          parameters: [
            {
              name: 'word',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Varyasyonları zenginleştirilecek kelime'
            },
            {
              name: 'useAI',
              in: 'query',
              required: false,
              schema: {
                type: 'boolean',
                default: true
              },
              description: 'Yapay zeka kullanılsın mı?'
            },
            {
              name: 'model',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: supportedModels
              },
              description: 'Kullanılacak yapay zeka modeli'
            }
          ],
          responses: {
            '200': {
              description: 'Varyasyon zenginleştirme başarıyla tamamlandı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      message: {
                        type: 'string',
                        example: 'Varyasyon zenginleştirme başarıyla tamamlandı'
                      },
                      result: {
                        type: 'object',
                        properties: {
                          baseWord: {
                            type: 'string',
                            description: 'Ana kelime'
                          },
                          variationsCount: {
                            type: 'integer',
                            description: 'Toplam varyasyon sayısı'
                          },
                          newVariationsAdded: {
                            type: 'integer',
                            description: 'Yeni eklenen varyasyon sayısı'
                          },
                          variations: {
                            type: 'array',
                            items: {
                              type: 'string'
                            },
                            description: 'Tüm varyasyonlar'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '404': {
              description: 'Kelime bulunamadı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false
                      },
                      message: {
                        type: 'string',
                        example: 'Belirtilen kelime veritabanında bulunamadı'
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/variations/generate': {
        get: {
          summary: 'Varyasyon önerileri oluşturur',
          description: 'Verilen kelime için olası tüm varyasyonları üretir (veritabanına kaydetmeden)',
          tags: ['Varyasyon Yönetimi'],
          parameters: [
            {
              name: 'word',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Varyasyonları oluşturulacak kelime'
            },
            {
              name: 'useAI',
              in: 'query',
              required: false,
              schema: {
                type: 'boolean',
                default: true
              },
              description: 'Yapay zeka kullanılsın mı?'
            },
            {
              name: 'model',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: supportedModels
              },
              description: 'Kullanılacak yapay zeka modeli'
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'integer'
              },
              description: 'Döndürülecek maksimum varyasyon sayısı'
            },
            {
              name: 'categories',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                default: 'all'
              },
              description: 'Filtrelenecek varyasyon kategorileri (all veya algorithmic,ai,phonetic,spacing,replacement)'
            }
          ],
          responses: {
            '200': {
              description: 'Varyasyonlar başarıyla oluşturuldu',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      data: {
                        type: 'object',
                        properties: {
                          originalWord: {
                            type: 'string',
                            description: 'Orijinal kelime'
                          },
                          stats: {
                            type: 'object',
                            properties: {
                              algorithmicVariationsCount: {
                                type: 'integer',
                                description: 'Algoritma ile oluşturulan varyasyon sayısı'
                              },
                              aiVariationsCount: {
                                type: 'integer',
                                description: 'AI ile oluşturulan varyasyon sayısı'
                              },
                              totalUniqueVariations: {
                                type: 'integer',
                                description: 'Toplam benzersiz varyasyon sayısı'
                              },
                              categoryCounts: {
                                type: 'object',
                                description: 'Kategori başına varyasyon sayısı'
                              }
                            }
                          },
                          variations: {
                            type: 'array',
                            items: {
                              type: 'string'
                            },
                            description: 'Oluşturulan tüm varyasyonlar'
                          },
                          categorizedVariations: {
                            type: 'object',
                            description: 'Kategoriye göre gruplandırılmış varyasyonlar'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/variations/stats': {
        get: {
          summary: 'Varyasyon istatistiklerini getirir',
          description: 'Veritabanındaki tüm küfür varyasyonları hakkında istatistiksel bilgileri getirir',
          tags: ['Varyasyon Yönetimi', 'İstatistikler ve Analiz'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'integer',
                default: 20
              },
              description: 'En çok varyasyona sahip kelimelerden kaç tanesinin getirileceği'
            }
          ],
          responses: {
            '200': {
              description: 'İstatistikler başarıyla getirildi',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      statistics: {
                        type: 'object',
                        properties: {
                          totalWords: {
                            type: 'integer',
                            description: 'Toplam kelime sayısı'
                          },
                          totalVariations: {
                            type: 'integer',
                            description: 'Toplam varyasyon sayısı'
                          },
                          averageVariationsPerWord: {
                            type: 'string',
                            description: 'Kelime başına ortalama varyasyon sayısı'
                          },
                          topVariedWords: {
                            type: 'array',
                            items: {
                              type: 'object'
                            },
                            description: 'En çok varyasyona sahip kelimeler'
                          },
                          variationDistribution: {
                            type: 'object',
                            description: 'Varyasyon sayısı dağılımı'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      },
      '/api/swear/variations/bulk-enrich': {
        post: {
          summary: 'Toplu varyasyon zenginleştirme çalıştırır',
          description: 'Veritabanındaki tüm aktif küfür kelimeleri için toplu varyasyon zenginleştirme işlemi başlatır',
          tags: ['Varyasyon Yönetimi'],
          security: [
            { ApiKeyAuth: [] }
          ],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'integer',
                default: 100
              },
              description: 'İşlenecek maksimum kelime sayısı'
            }
          ],
          responses: {
            '200': {
              description: 'Toplu zenginleştirme başarıyla tamamlandı',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true
                      },
                      message: {
                        type: 'string',
                        example: 'Toplu varyasyon zenginleştirme tamamlandı'
                      },
                      results: {
                        type: 'object',
                        properties: {
                          processed: {
                            type: 'integer',
                            description: 'İşlenen kelime sayısı'
                          },
                          enriched: {
                            type: 'integer',
                            description: 'Zenginleştirilen kelime sayısı'
                          },
                          totalNewVariations: {
                            type: 'integer',
                            description: 'Toplam eklenen yeni varyasyon sayısı'
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': { $ref: '#/components/responses/InternalServerError' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js'], // Rota dosyaları
};

// Özel CSS ile Swagger UI'ı ultra modern ve animasyonlu hale getir
const swaggerUIOptions = {
  explorer: true,
  customCss: `
    /* Modern Renk Paleti ve Temel Stil */
    :root {
      --primary-color: #4f46e5;
      --primary-hover: #4338ca;
      --secondary-color: #06b6d4;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --danger-color: #ef4444;
      --light-bg: #f9fafb;
      --dark-bg: #18181b;
      --text-color: #1f2937;
      --border-radius: 8px;
      --box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --transition-speed: 0.3s;
    }
    
    /* Genel Animasyon ve Modern Görünüm */
    .swagger-ui * {
      transition: all var(--transition-speed) ease-in-out;
    }
    
    .swagger-ui .topbar {
      background-image: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      padding: 15px 0;
      box-shadow: var(--box-shadow);
    }
    
    .swagger-ui .topbar .download-url-wrapper .select-label select {
      border-color: var(--primary-color);
      border-radius: var(--border-radius);
      transition: all 0.3s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .swagger-ui .topbar .download-url-wrapper .select-label select:focus {
      border-color: var(--secondary-color);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3);
      outline: none;
    }
    
    /* Başlık Animasyonları */
    .swagger-ui .info {
      margin: 30px 0;
      position: relative;
      padding: 15px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border-radius: var(--border-radius);
      box-shadow: var(--box-shadow);
      border-left: 4px solid var(--primary-color);
    }
    
    .swagger-ui .info .title {
      color: var(--primary-color);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans', sans-serif;
      font-weight: 700;
      letter-spacing: -0.5px;
      font-size: 2.2rem;
      animation: fadeIn 0.8s ease-in-out;
    }
    
    /* Yöntem Blokları */
    .swagger-ui .opblock {
      border-radius: var(--border-radius);
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      transition: transform 0.3s, box-shadow 0.3s;
      border: none;
    }
    
    .swagger-ui .opblock:hover {
      transform: translateY(-2px);
      box-shadow: var(--box-shadow);
    }
    
    /* GET Metodu */
    .swagger-ui .opblock.opblock-get {
      background: linear-gradient(to right, rgba(79, 70, 229, 0.05), rgba(79, 70, 229, 0.1));
      border-left: 4px solid var(--primary-color);
    }
    
    .swagger-ui .opblock.opblock-get .opblock-summary-method {
      background: var(--primary-color);
      box-shadow: 0 0 10px rgba(79, 70, 229, 0.4);
    }
    
    /* POST Metodu */
    .swagger-ui .opblock.opblock-post {
      background: linear-gradient(to right, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.1));
      border-left: 4px solid var(--success-color);
    }
    
    .swagger-ui .opblock.opblock-post .opblock-summary-method {
      background: var(--success-color);
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
    }
    
    /* DELETE Metodu */
    .swagger-ui .opblock.opblock-delete {
      background: linear-gradient(to right, rgba(239, 68, 68, 0.05), rgba(239, 68, 68, 0.1));
      border-left: 4px solid var(--danger-color);
    }
    
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {
      background: var(--danger-color);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
    }
    
    /* PUT Metodu */
    .swagger-ui .opblock.opblock-put {
      background: linear-gradient(to right, rgba(245, 158, 11, 0.05), rgba(245, 158, 11, 0.1));
      border-left: 4px solid var(--warning-color);
    }
    
    .swagger-ui .opblock.opblock-put .opblock-summary-method {
      background: var(--warning-color);
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
    }
    
    /* Düğme Stilleri */
    .swagger-ui .btn {
      border-radius: var(--border-radius);
      transition: all 0.3s ease;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
      font-size: 0.85rem;
    }
    
    .swagger-ui .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .swagger-ui .btn.execute {
      background-color: var(--primary-color);
    }
    
    .swagger-ui .btn.execute:hover {
      background-color: var(--primary-hover);
    }
    
    .swagger-ui .btn.authorize {
      background-color: var(--success-color);
    }
    
    .swagger-ui .btn.authorize:hover {
      background-color: #0ca678;
    }
    
    /* Etiket Animasyonları */
    .swagger-ui .opblock-tag {
      font-size: 1.2rem;
      font-weight: 600;
      margin-top: 30px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .swagger-ui .opblock-tag:hover {
      color: var(--primary-color);
      transform: translateX(5px);
    }
    
    /* Şema Bölümü */
    .swagger-ui .scheme-container {
      background: var(--light-bg);
      box-shadow: none;
      border-bottom: 1px solid #e5e7eb;
      margin: 0 0 20px;
      padding: 20px 0;
      animation: fadeIn 0.5s ease-in-out;
    }
    
    /* Modeller Bölümü */
    .swagger-ui section.models {
      border-radius: var(--border-radius);
      border: 1px solid rgba(0, 0, 0, 0.1);
      margin: 30px 0;
    }
    
    .swagger-ui section.models .model-container {
      background: white;
      border-radius: var(--border-radius);
      margin: 10px 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: all 0.3s;
    }
    
    .swagger-ui section.models .model-container:hover {
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
    }
    
    /* Form Alanları */
    .swagger-ui input[type=text], 
    .swagger-ui textarea,
    .swagger-ui select {
      border-radius: var(--border-radius);
      border: 1px solid #e2e8f0;
      padding: 10px;
      transition: all 0.3s;
    }
    
    .swagger-ui input[type=text]:focus, 
    .swagger-ui textarea:focus,
    .swagger-ui select:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
      outline: none;
    }
    
    .swagger-ui textarea {
      min-height: 180px;
    }
    
    /* Kod Blokları */
    .swagger-ui .markdown code, 
    .swagger-ui .renderedMarkdown code {
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 5px;
    }
    
    /* Tablo Stilleri */
    .swagger-ui table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
    }
    
    .swagger-ui table tbody tr {
      transition: all 0.2s;
    }
    
    .swagger-ui table tbody tr:hover {
      background-color: rgba(79, 70, 229, 0.05);
    }
    
    .swagger-ui table tbody tr td {
      padding: 12px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    /* Animasyon Keyframes */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(79, 70, 229, 0); }
      100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
    }
    
    /* Responsivite İyileştirmeleri */
    @media (max-width: 768px) {
      .swagger-ui .info .title {
        font-size: 1.8rem;
      }
      
      .swagger-ui .opblock-tag {
        font-size: 1rem;
      }
    }
  `,
  docExpansion: 'none',
  defaultModelsExpandDepth: 2,
  defaultModelExpandDepth: 3,
  displayRequestDuration: true,
  filter: true,
  syntaxHighlight: {
    theme: 'monokai',
    activate: true
  }
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = {
  swaggerUI,
  swaggerDocs,
  swaggerUIOptions
};
