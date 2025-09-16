/**
 * Application constants
 */

// Ethiopic Unicode ranges
export const ETHIOPIC_RANGES = {
  BASIC: /[\u1200-\u137F]/,
  EXTENDED: /[\u1380-\u139F]/,
  SUPPLEMENT: /[\u2D80-\u2DDF]/,
  ALL: /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/
} as const;

// Common Amharic punctuation
export const AMHARIC_PUNCTUATION = {
  WORD_SEPARATOR: '፡',
  COMMA: '፣',
  SEMICOLON: '፤',
  PERIOD: '።',
  COLON: '፦',
  QUESTION: '፧',
  EXCLAMATION: '፨'
} as const;

// OCR confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  VERY_LOW: 0.3,    // 30% - Very poor quality
  LOW: 0.5,         // 50% - Poor quality
  FAIR: 0.6,        // 60% - Fair quality
  MEDIUM: 0.75,     // 75% - Good quality
  HIGH: 0.85,       // 85% - Very good quality
  EXCELLENT: 0.95   // 95% - Excellent quality
} as const;

// File type constants
export const SUPPORTED_IMAGE_TYPES = {
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  GIF: 'image/gif',
  TIFF: 'image/tiff',
  X_TIFF: 'image/x-tiff',
  BMP: 'image/bmp'
} as const;

// API model constants
export const GEMINI_MODELS = {
  FLASH: 'gemini-1.5-flash',
  PRO: 'gemini-1.5-pro',
  PRO_2_5: 'gemini-2.5-pro'
} as const;

// Language codes
export const LANGUAGE_CODES = {
  AMHARIC: 'am',
  ENGLISH: 'en',
  TIGRINYA: 'ti',
  SOMALI: 'so',
  OROMO: 'om',
  UNKNOWN: 'unknown'
} as const;

// Common Amharic OCR error patterns
export const OCR_ERROR_PATTERNS = {
  MIXED_SCRIPTS: /([\u1200-\u137F]+)[a-zA-Z]+([\u1200-\u137F]*)/g,
  ASCII_NOISE: /([#;:/\\|`~^*_=+])/g,
  NUMBERS_IN_AMHARIC: /([አ-ፚ]+)[0-9]+([አ-ፚ]*)/g,
  REPEATED_CHARS: /(.)\\1{3,}/g
} as const;

// Religious text common terms
export const RELIGIOUS_TERMS = {
  VIRGIN_MARY: 'የመድኃኔዓለም እናት',
  PRAYER_HOUSE: 'ጸሎት ቤት',
  VATICAN: 'ቫቲካን',
  CHAPTER: 'ምዕራፍ',
  SECTION: 'ክፍል',
  FEAST: 'በዓል',
  FAST: 'ጾም'
} as const;

// Export format types
export const EXPORT_FORMATS = {
  TXT: 'txt',
  DOCX: 'docx',
  PDF: 'pdf',
  JSON: 'json',
  CSV: 'csv',
  XLSX: 'xlsx'
} as const;